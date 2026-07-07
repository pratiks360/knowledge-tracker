import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { UserSettingsRow } from '@/types/db'
import { PROVIDER_BASE, type AIConfig } from '@/lib/ai'

const SETTINGS_KEY = ['user_settings'] as const

/** Resolves the active provider's key + model into an AIConfig, or null if not set up. */
export function resolveAIConfig(settings: UserSettingsRow | null | undefined): AIConfig | null {
  if (!settings) return null
  const provider = settings.ai_provider ?? 'openrouter'
  const apiKey =
    provider === 'nvidia' ? settings.nvidia_api_key : settings.openrouter_api_key
  const model = provider === 'nvidia' ? settings.nvidia_model : settings.selected_model
  if (!apiKey || !model) return null
  return { provider, apiKey, model, baseUrl: PROVIDER_BASE[provider] }
}

/** Hook form of resolveAIConfig — read the active AIConfig anywhere. */
export function useAIConfig(): AIConfig | null {
  const { data: settings } = useUserSettings()
  return resolveAIConfig(settings)
}

export function useUserSettings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: SETTINGS_KEY,
    enabled: !!user,
    queryFn: async (): Promise<UserSettingsRow | null> => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data as UserSettingsRow | null
    },
  })
}

export function useSaveUserSettings() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (
      patch: Partial<
        Pick<
          UserSettingsRow,
          | 'ai_provider'
          | 'openrouter_api_key'
          | 'selected_model'
          | 'nvidia_api_key'
          | 'nvidia_model'
        >
      >
    ) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' })
        .select('*')
        .single()
      if (error) throw error
      return data as UserSettingsRow
    },
    onSuccess: (data) => queryClient.setQueryData(SETTINGS_KEY, data),
  })
}
