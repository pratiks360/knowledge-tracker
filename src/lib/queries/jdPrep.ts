import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { JDPrepResult } from '@/lib/ai'
import type { NodeRow } from '@/types/db'

/**
 * Creates a `jd_prep` parent node for a job description: brand-new prep topics become
 * real children under it, while topics the JD needs that already exist elsewhere in the
 * graph are only cross-linked (`related`) rather than duplicated or reparented.
 */
export function useCreateJDPrep() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      result,
      selectedNewTitles,
      selectedMatchIds,
    }: {
      result: JDPrepResult
      selectedNewTitles: Set<string>
      selectedMatchIds: Set<string>
    }) => {
      if (!user) throw new Error('Not signed in')

      const { data: parent, error: parentErr } = await supabase
        .from('nodes')
        .insert({
          user_id: user.id,
          parent_id: null,
          title: result.roleTitle || 'JD prep',
          node_kind: 'jd_prep',
        })
        .select('id')
        .single()
      if (parentErr) throw parentErr
      const parentId = parent.id as string

      const newTopics = result.newTopics.filter((t) => selectedNewTitles.has(t.title))
      if (newTopics.length > 0) {
        const { error } = await supabase.from('nodes').insert(
          newTopics.map((t, i) => ({
            user_id: user.id,
            parent_id: parentId,
            title: t.title,
            description: t.description ?? null,
            order_index: i,
          }))
        )
        if (error) throw error
      }

      const matchedIds = result.matchedExistingIds.filter((id) => selectedMatchIds.has(id))
      if (matchedIds.length > 0) {
        const { error } = await supabase.from('node_links').insert(
          matchedIds.map((toNode) => ({
            user_id: user.id,
            from_node: parentId,
            to_node: toNode,
            link_type: 'related' as const,
          }))
        )
        if (error) throw error
      }

      return { parentId }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nodes'] }),
  })
}

/**
 * Undoes a JD prep: its real children are promoted to the prep node's own parent
 * (or root), the `related` links it created are removed, then the prep node itself
 * is deleted. New topics keep existing either way — only the JD wrapper goes away.
 */
export function useDismantleJDPrep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ node, allNodes }: { node: NodeRow; allNodes: NodeRow[] }) => {
      const children = allNodes.filter((n) => n.parent_id === node.id)
      for (const child of children) {
        const { error } = await supabase
          .from('nodes')
          .update({ parent_id: node.parent_id })
          .eq('id', child.id)
        if (error) throw error
      }

      const { error: linkErr } = await supabase
        .from('node_links')
        .delete()
        .or(`from_node.eq.${node.id},to_node.eq.${node.id}`)
      if (linkErr) throw linkErr

      const { error: delErr } = await supabase.from('nodes').delete().eq('id', node.id)
      if (delErr) throw delErr
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nodes'] }),
  })
}
