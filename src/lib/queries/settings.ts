import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { UserSettingsRow } from '@/types/db'
import { PROVIDER_BASE, cloudflareBase, type AIConfig, type EmbeddingConfig } from '@/lib/ai'

const SETTINGS_KEY = ['user_settings'] as const

/** Resolves the active provider's key + model into an AIConfig, or null if not set up. */
export function resolveAIConfig(settings: UserSettingsRow | null | undefined): AIConfig | null {
  if (!settings) return null
  const provider = settings.ai_provider ?? 'openrouter'

  if (provider === 'cloudflare') {
    const apiKey = settings.cloudflare_api_key
    const model = settings.cloudflare_model
    const accountId = settings.cloudflare_account_id
    // Cloudflare needs all three — its base URL embeds the account id.
    if (!apiKey || !model || !accountId) return null
    return { provider, apiKey, model, baseUrl: cloudflareBase(accountId) }
  }

  const apiKey = provider === 'nvidia' ? settings.nvidia_api_key : settings.openrouter_api_key
  const model = provider === 'nvidia' ? settings.nvidia_model : settings.selected_model
  if (!apiKey || !model) return null
  return { provider, apiKey, model, baseUrl: PROVIDER_BASE[provider] }
}

/** Hook form of resolveAIConfig — read the active AIConfig anywhere. */
export function useAIConfig(): AIConfig | null {
  const { data: settings } = useUserSettings()
  return resolveAIConfig(settings)
}

/** Resolves the embedding provider's key + model, reusing that provider's own chat credentials. */
export function resolveEmbeddingConfig(
  settings: UserSettingsRow | null | undefined
): EmbeddingConfig | null {
  if (!settings?.embedding_provider || !settings.embedding_model) return null
  const provider = settings.embedding_provider
  if (provider === 'cloudflare') {
    const apiKey = settings.cloudflare_api_key
    const accountId = settings.cloudflare_account_id
    if (!apiKey || !accountId) return null
    return { provider, apiKey, model: settings.embedding_model, baseUrl: cloudflareBase(accountId) }
  }
  const apiKey = settings.nvidia_api_key
  if (!apiKey) return null
  return { provider, apiKey, model: settings.embedding_model, baseUrl: PROVIDER_BASE.nvidia }
}

export function useEmbeddingConfig(): EmbeddingConfig | null {
  const { data: settings } = useUserSettings()
  return resolveEmbeddingConfig(settings)
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

export interface RunAutofillResult {
  filled: number
  status: string
}

/** Manually triggers a nightly-autofill run for just the signed-in user, right now. */
export function useRunAutofillNow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<RunAutofillResult> => {
      const { data, error } = await supabase.functions.invoke('nightly-autofill', { body: {} })
      if (error) throw error
      return { filled: Number(data?.filled ?? 0), status: String(data?.status ?? 'ok') }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })
      queryClient.invalidateQueries({ queryKey: ['nodes'] })
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
          | 'cloudflare_api_key'
          | 'cloudflare_account_id'
          | 'cloudflare_model'
          | 'autofill_enabled'
          | 'autofill_hour'
          | 'autofill_max_per_run'
          | 'embedding_provider'
          | 'embedding_model'
          | 'embeddings_built_at'
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
