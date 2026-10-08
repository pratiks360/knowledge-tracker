import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { RoadmapProposalNode, RoadmapAddition } from '@/lib/ai'
import type { NodeRow } from '@/types/db'

export interface FlatProposalNode {
  key: string
  parentKey: string | null
  title: string
  description?: string
  prerequisites: string[]
  siblingIndex: number
}

export function flattenProposal(
  nodes: RoadmapProposalNode[],
  parentKey: string | null = null
): FlatProposalNode[] {
  const result: FlatProposalNode[] = []
  nodes.forEach((n, i) => {
    const key = `${parentKey ?? 'root'}-${i}`
    result.push({
      key,
      parentKey,
      title: n.title,
      description: n.description,
      prerequisites: n.prerequisites ?? [],
      siblingIndex: i,
    })
    if (n.children?.length) {
      result.push(...flattenProposal(n.children, key))
    }
  })
  return result
}

/**
 * Seeds the builder from an already-merged subtree. Existing nodes keep their real DB id as
 * their proposal key (via `existingIds`), so new topics attach under the right existing parent
 * and nothing already in the graph is duplicated.
 */
export function buildRoadmapSeed(allNodes: NodeRow[], rootId: string) {
  const childrenOf = (pid: string) =>
    allNodes
      .filter((n) => n.parent_id === pid)
      .sort((a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title))

  const flat: FlatProposalNode[] = []
  const walk = (nodeId: string, parentKey: string | null) => {
    for (const c of childrenOf(nodeId)) {
      flat.push({
        key: c.id,
        parentKey,
        title: c.title,
        description: c.description ?? undefined,
        prerequisites: [],
        siblingIndex: flat.length,
      })
      walk(c.id, c.id)
    }
  }
  walk(rootId, null)

  const existingIds = new Map(flat.map((f) => [f.key, f.key]))
  const existingTitles = new Set(flat.map((f) => f.title.trim().toLowerCase()))
  return { flat, existingIds, existingTitles }
}

/**
 * Turns the model's additions into proposal nodes hung off an existing subtree: each top-level
 * addition's `parentTitle` is matched (case-insensitively) to an existing node, or to null →
 * directly under the roadmap's root. Unmatched parent titles fall back to the root rather than
 * being dropped, so a slightly misnamed parent never loses the topic.
 */
export function additionsToFlat(
  additions: RoadmapAddition[],
  existing: FlatProposalNode[]
): FlatProposalNode[] {
  const keyByTitle = new Map(existing.map((f) => [f.title.trim().toLowerCase(), f.key]))
  const out: FlatProposalNode[] = []
  additions.forEach((a, i) => {
    const parentKey = a.parentTitle ? (keyByTitle.get(a.parentTitle.trim().toLowerCase()) ?? null) : null
    const key = `add-${i}`
    out.push({
      key,
      parentKey,
      title: a.title,
      description: a.description,
      prerequisites: a.prerequisites ?? [],
      siblingIndex: i,
    })
    // flattenProposal keys children `${key}-N`, which can't collide with other `add-N` keys.
    if (a.children?.length) out.push(...flattenProposal(a.children, key))
  })
  return out
}

export function useMergeRoadmap(targetNodeId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      flat,
      selectedKeys,
      existingIds,
    }: {
      flat: FlatProposalNode[]
      selectedKeys: Set<string>
      /**
       * When editing an existing roadmap, maps a proposal key to the real DB node id
       * it already represents. Such nodes are treated as already-created (used as
       * parents) and are never re-inserted.
       */
      existingIds?: Map<string, string>
    }) => {
      if (!user) throw new Error('Not signed in')
      // Never recreate nodes that already exist in the graph.
      const selected = flat.filter((f) => selectedKeys.has(f.key) && !existingIds?.has(f.key))
      if (selected.length === 0) return { createdIds: new Map<string, string>() }

      // Map proposal key -> created DB node id, resolving to nearest selected ancestor,
      // an existing node, or the target root.
      const createdIds = new Map<string, string>()
      const byKey = new Map(flat.map((f) => [f.key, f]))

      const resolveParentDbId = (parentKey: string | null): string => {
        let cursor = parentKey
        while (cursor) {
          if (createdIds.has(cursor)) return createdIds.get(cursor)!
          if (existingIds?.has(cursor)) return existingIds.get(cursor)!
          cursor = byKey.get(cursor)?.parentKey ?? null
        }
        return targetNodeId
      }

      // Preserve top-down order so parents are created before children. Depth is
      // walked via parentKey rather than parsed out of the key string, so keys
      // added by the preview editor order correctly too.
      const depthOf = (f: FlatProposalNode): number => {
        let depth = 0
        let cursor = f.parentKey
        while (cursor && depth < flat.length) {
          depth++
          cursor = byKey.get(cursor)?.parentKey ?? null
        }
        return depth
      }
      const ordered = [...selected].sort((a, b) => depthOf(a) - depthOf(b))

      // Track order_index per resolved DB parent.
      const orderCounters = new Map<string, number>()

      for (const item of ordered) {
        const parentDbId = resolveParentDbId(item.parentKey)
        const orderIndex = orderCounters.get(parentDbId) ?? 0
        orderCounters.set(parentDbId, orderIndex + 1)

        const { data, error } = await supabase
          .from('nodes')
          .insert({
            user_id: user.id,
            parent_id: parentDbId,
            title: item.title,
            description: item.description ?? null,
            order_index: orderIndex,
          })
          .select('id')
          .single()
        if (error) throw error
        createdIds.set(item.key, data.id as string)
      }

      // Prerequisite links — only between nodes that were actually created in this merge.
      const titleToKey = new Map(selected.map((f) => [f.title.toLowerCase(), f.key]))
      const linkRows: {
        user_id: string
        from_node: string
        to_node: string
        link_type: 'prerequisite'
      }[] = []
      for (const item of selected) {
        for (const prereqTitle of item.prerequisites) {
          const prereqKey = titleToKey.get(prereqTitle.toLowerCase())
          if (!prereqKey) continue
          const fromId = createdIds.get(prereqKey)
          const toId = createdIds.get(item.key)
          if (fromId && toId && fromId !== toId) {
            linkRows.push({
              user_id: user.id,
              from_node: fromId,
              to_node: toId,
              link_type: 'prerequisite',
            })
          }
        }
      }
      if (linkRows.length > 0) {
        const { error } = await supabase.from('node_links').insert(linkRows)
        if (error) throw error
      }

      return { createdIds }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nodes'] }),
  })
}
