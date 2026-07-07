import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { QuizQuestion, QuizRow } from '@/types/db'

const quizKey = (nodeId: string) => ['quizzes', nodeId] as const

export function useLatestQuiz(nodeId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: quizKey(nodeId ?? ''),
    enabled: !!user && !!nodeId,
    queryFn: async (): Promise<QuizRow | null> => {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('node_id', nodeId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as QuizRow | null
    },
  })
}

export function useCreateQuiz(nodeId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (questions: QuizQuestion[]) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('quizzes')
        .insert({ user_id: user.id, node_id: nodeId, questions })
        .select('*')
        .single()
      if (error) throw error
      return data as QuizRow
    },
    onSuccess: (data) => queryClient.setQueryData(quizKey(nodeId), data),
  })
}

export function useSubmitQuizScore(nodeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, score }: { id: string; score: number }) => {
      const { data, error } = await supabase
        .from('quizzes')
        .update({ last_score: score, taken_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data as QuizRow
    },
    onSuccess: (data) => queryClient.setQueryData(quizKey(nodeId), data),
  })
}
