import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { LinkType, NodeLinkRow } from '@/types/db'

const linksKey = (nodeId: string) => ['node_links', nodeId] as const

export function useNodeLinks(nodeId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: linksKey(nodeId ?? ''),
    enabled: !!user && !!nodeId,
    queryFn: async (): Promise<NodeLinkRow[]> => {
      const { data, error } = await supabase
        .from('node_links')
        .select('*')
        .or(`from_node.eq.${nodeId},to_node.eq.${nodeId}`)
      if (error) throw error
      return data as NodeLinkRow[]
    },
  })
}

/** All of the user's node_links, unscoped — for the global graph view. */
export function useAllNodeLinks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['node_links', 'all'],
    enabled: !!user,
    queryFn: async (): Promise<NodeLinkRow[]> => {
      const { data, error } = await supabase.from('node_links').select('*')
      if (error) throw error
      return data as NodeLinkRow[]
    },
  })
}

export function useAddNodeLink(nodeId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ toNode, linkType }: { toNode: string; linkType: LinkType }) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('node_links')
        .insert({ user_id: user.id, from_node: nodeId, to_node: toNode, link_type: linkType })
        .select('*')
        .single()
      if (error) throw error
      return data as NodeLinkRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: linksKey(nodeId) }),
  })
}

export function useDeleteNodeLink(nodeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('node_links').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: linksKey(nodeId) }),
  })
}
