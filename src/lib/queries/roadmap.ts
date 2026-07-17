import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { RoadmapProposalNode } from '@/lib/ai'

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

export function useMergeRoadmap(targetNodeId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      flat,
      selectedKeys,
    }: {
      flat: FlatProposalNode[]
      selectedKeys: Set<string>
    }) => {
      if (!user) throw new Error('Not signed in')
      const selected = flat.filter((f) => selectedKeys.has(f.key))
      if (selected.length === 0) return { createdIds: new Map<string, string>() }

      // Map proposal key -> created DB node id, resolving to nearest selected ancestor (or target).
      const createdIds = new Map<string, string>()
      const byKey = new Map(flat.map((f) => [f.key, f]))

      const resolveParentDbId = (parentKey: string | null): string => {
        let cursor = parentKey
        while (cursor) {
          if (createdIds.has(cursor)) return createdIds.get(cursor)!
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
