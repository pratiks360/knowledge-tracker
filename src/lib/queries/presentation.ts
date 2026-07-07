import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { PresentationRow, StoryPathStepRow } from '@/types/db'

const PRESENTATION_KEY = ['presentation'] as const
const stepsKey = (presentationId: string) => ['story_path_steps', presentationId] as const

/** v1: single fixed presentation named "default" — created lazily on first use. */
export function usePresentation() {
  const { user } = useAuth()
  return useQuery({
    queryKey: PRESENTATION_KEY,
    enabled: !!user,
    queryFn: async (): Promise<PresentationRow> => {
      const existing = await supabase
        .from('presentations')
        .select('*')
        .eq('name', 'default')
        .maybeSingle()
      if (existing.error) throw existing.error
      if (existing.data) return existing.data as PresentationRow

      const created = await supabase
        .from('presentations')
        .insert({ user_id: user!.id, name: 'default' })
        .select('*')
        .single()
      if (created.error) throw created.error
      return created.data as PresentationRow
    },
  })
}

export function useStoryPathSteps(presentationId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: stepsKey(presentationId ?? ''),
    enabled: !!user && !!presentationId,
    queryFn: async (): Promise<StoryPathStepRow[]> => {
      const { data, error } = await supabase
        .from('story_path_steps')
        .select('*')
        .eq('presentation_id', presentationId!)
        .order('step_order', { ascending: true })
      if (error) throw error
      return data as StoryPathStepRow[]
    },
  })
}

export function useAddStoryStep(presentationId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (nodeId: string) => {
      if (!user) throw new Error('Not signed in')
      const existing = queryClient.getQueryData<StoryPathStepRow[]>(stepsKey(presentationId)) ?? []
      const nextOrder = existing.length
      const { data, error } = await supabase
        .from('story_path_steps')
        .insert({
          user_id: user.id,
          presentation_id: presentationId,
          node_id: nodeId,
          step_order: nextOrder,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as StoryPathStepRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stepsKey(presentationId) }),
  })
}

export function useRemoveStoryStep(presentationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('story_path_steps').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stepsKey(presentationId) }),
  })
}

export function useReorderStorySteps(presentationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (steps: StoryPathStepRow[]) => {
      // Re-write step_order sequentially to match the given array order.
      await Promise.all(
        steps.map((s, i) =>
          supabase.from('story_path_steps').update({ step_order: i }).eq('id', s.id)
        )
      )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stepsKey(presentationId) }),
  })
}
