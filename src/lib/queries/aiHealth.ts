import { useQuery } from '@tanstack/react-query'
import { listModels, isFreeModel, isNvidiaFreeChatModel, pingModel, providerListsModels } from '@/lib/ai'
import type { AIProvider } from '@/types/db'

function freeFilterFor(provider: AIProvider) {
  if (provider === 'openrouter') return isFreeModel
  if (provider === 'nvidia') return isNvidiaFreeChatModel
  return null
}
import { useAIConfig } from '@/lib/queries/settings'

// Check every 5 minutes so we barely touch the free-tier quota.
export const HEALTH_INTERVAL_MS = 300_000

// When the active model is down, probe at most this many candidates and stop
// after finding this many alive — bounds the request burst on failure.
const MAX_PROBES = 12
const WANT_ALIVE = 4

export interface AIHealth {
  ok: boolean
  checkedAt: number
}

/** Periodically pings the active model so the UI can show a live status LED. */
export function useAIHealth() {
  const cfg = useAIConfig()
  return useQuery<AIHealth>({
    queryKey: ['ai-health', cfg?.provider, cfg?.model],
    enabled: !!cfg,
    refetchInterval: HEALTH_INTERVAL_MS,
    refetchOnWindowFocus: false,
    staleTime: HEALTH_INTERVAL_MS,
    retry: false,
    queryFn: async () => ({ ok: await pingModel(cfg!), checkedAt: Date.now() }),
  })
}

/**
 * Loads the selectable model list for the active provider (free-only for
 * OpenRouter). Runs only while `enabled` so we don't fetch on every render —
 * the caller enables it when the quick-switch menu is open.
 */
export function useProviderModels(enabled: boolean) {
  const cfg = useAIConfig()
  return useQuery<{ id: string; name: string }[]>({
    queryKey: ['ai-models', cfg?.provider, cfg?.apiKey],
    // Cloudflare has no /models endpoint — skip the fetch (model is entered manually in Settings).
    enabled: enabled && !!cfg && providerListsModels(cfg.provider),
    staleTime: HEALTH_INTERVAL_MS,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const models = await listModels(cfg!.apiKey, cfg!.baseUrl, cfg!.provider)
      const freeFilter = freeFilterFor(cfg!.provider)
      const filtered = freeFilter ? models.filter(freeFilter) : models
      return filtered
        .map((m) => ({ id: m.id, name: m.name ?? m.id }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  })
}

/**
 * Only runs when `enabled` (i.e. the current model is down). Pings other free
 * models and returns the ids that respond, so the user can switch to a live one.
 */
export function useAliveModels(enabled: boolean) {
  const cfg = useAIConfig()
  return useQuery<string[]>({
    queryKey: ['ai-alive', cfg?.provider, cfg?.model],
    enabled: enabled && !!cfg && providerListsModels(cfg.provider),
    staleTime: HEALTH_INTERVAL_MS,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const models = await listModels(cfg!.apiKey, cfg!.baseUrl, cfg!.provider)
      const freeFilter = freeFilterFor(cfg!.provider)
      const candidates = (freeFilter ? models.filter(freeFilter) : models).map((m) => m.id)
      const alive: string[] = []
      let attempts = 0
      for (const id of candidates) {
        if (alive.length >= WANT_ALIVE || attempts >= MAX_PROBES) break
        if (id === cfg!.model) continue
        attempts++
        if (await pingModel(cfg!, id)) alive.push(id)
      }
      return alive
    },
  })
}
