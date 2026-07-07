import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { NodeRow, NodeStatus } from '@/types/db'

const NODES_KEY = ['nodes'] as const

export function useNodes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: NODES_KEY,
    enabled: !!user,
    queryFn: async (): Promise<NodeRow[]> => {
      const { data, error } = await supabase
        .from('nodes')
        .select('*')
        .order('order_index', { ascending: true })
      if (error) throw error
      return data as NodeRow[]
    },
  })
}

export function useNode(id: string | undefined) {
  const { data: nodes } = useNodes()
  return nodes?.find((n) => n.id === id)
}

export function useCreateNode() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: {
      title: string
      parent_id?: string | null
      description?: string
      node_kind?: NodeRow['node_kind']
      order_index?: number
    }) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('nodes')
        .insert({
          user_id: user.id,
          title: input.title,
          parent_id: input.parent_id ?? null,
          description: input.description ?? null,
          node_kind: input.node_kind ?? 'topic',
          order_index: input.order_index ?? 0,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as NodeRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NODES_KEY }),
  })
}

export function useUpdateNode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<NodeRow> }) => {
      const { data, error } = await supabase
        .from('nodes')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data as NodeRow
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: NODES_KEY })
      const previous = queryClient.getQueryData<NodeRow[]>(NODES_KEY)
      queryClient.setQueryData<NodeRow[]>(NODES_KEY, (old) =>
        old?.map((n) => (n.id === id ? { ...n, ...patch } : n))
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(NODES_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: NODES_KEY }),
  })
}

export function useDeleteNode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('nodes').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NODES_KEY }),
  })
}

export function useSetNodeStatus() {
  const update = useUpdateNode()
  return (id: string, status: NodeStatus) => update.mutate({ id, patch: { status } })
}

export function useTouchLastVisited() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('nodes')
        .update({ last_visited_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NODES_KEY }),
  })
}

// ── Tree helpers (pure functions, operate on the full flat list) ──

export interface TreeNode extends NodeRow {
  children: TreeNode[]
}

export function buildTree(nodes: NodeRow[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  nodes.forEach((n) => byId.set(n.id, { ...n, children: [] }))
  const roots: TreeNode[] = []
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortChildren = (list: TreeNode[]) => {
    list.sort((a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title))
    list.forEach((n) => sortChildren(n.children))
  }
  sortChildren(roots)
  return roots
}

/** Compact "id: title" text list, indented by depth, for AI prompts. Depth-limited to keep it small. */
export function serializeTreeForAI(nodes: NodeRow[], maxDepth = 4): string {
  const tree = buildTree(nodes)
  const lines: string[] = []
  const walk = (items: TreeNode[], depth: number) => {
    if (depth > maxDepth) return
    for (const n of items) {
      lines.push(`${'  '.repeat(depth)}${n.id}: ${n.title}`)
      walk(n.children, depth + 1)
    }
  }
  walk(tree, 0)
  return lines.join('\n')
}

export function getAncestors(nodes: NodeRow[], nodeId: string): NodeRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const chain: NodeRow[] = []
  let current = byId.get(nodeId)
  while (current?.parent_id) {
    const parent = byId.get(current.parent_id)
    if (!parent) break
    chain.unshift(parent)
    current = parent
  }
  return chain
}

export function getDescendantIds(nodes: NodeRow[], nodeId: string): string[] {
  const byParent = new Map<string, NodeRow[]>()
  nodes.forEach((n) => {
    if (!n.parent_id) return
    const list = byParent.get(n.parent_id) ?? []
    list.push(n)
    byParent.set(n.parent_id, list)
  })
  const result: string[] = []
  const walk = (id: string) => {
    for (const child of byParent.get(id) ?? []) {
      result.push(child.id)
      walk(child.id)
    }
  }
  walk(nodeId)
  return result
}

/** Progress % = done descendants / total descendants. Leaf nodes count themselves via status. */
export function computeProgress(nodes: NodeRow[], nodeId: string): number {
  const descendantIds = getDescendantIds(nodes, nodeId)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const self = byId.get(nodeId)
  const leafIds = descendantIds.length > 0 ? descendantIds : self ? [nodeId] : []
  if (leafIds.length === 0) return 0
  const relevant = descendantIds.length > 0 ? descendantIds : [nodeId]
  const done = relevant.filter((id) => byId.get(id)?.status === 'done').length
  return Math.round((done / relevant.length) * 100)
}
