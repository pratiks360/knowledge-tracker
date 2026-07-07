import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSaveUserSettings, useUserSettings } from '@/lib/queries/settings'
import { listModels, isFreeModel, PROVIDER_BASE, AIError } from '@/lib/ai'
import type { AIProvider, UserSettingsRow } from '@/types/db'

interface ProviderMeta {
  label: string
  keyField: 'openrouter_api_key' | 'nvidia_api_key'
  modelField: 'selected_model' | 'nvidia_model'
  keyPlaceholder: string
  hasFreeFilter: boolean
  keyUrl: string
  blurb: string
}

const PROVIDER_META: Record<AIProvider, ProviderMeta> = {
  openrouter: {
    label: 'OpenRouter',
    keyField: 'openrouter_api_key',
    modelField: 'selected_model',
    keyPlaceholder: 'sk-or-v1-…',
    hasFreeFilter: true,
    keyUrl: 'https://openrouter.ai/keys',
    blurb: 'Aggregates many providers. Use the “Free models only” filter for $0 models.',
  },
  nvidia: {
    label: 'NVIDIA',
    keyField: 'nvidia_api_key',
    modelField: 'nvidia_model',
    keyPlaceholder: 'nvapi-…',
    hasFreeFilter: false,
    keyUrl: 'https://build.nvidia.com',
    blurb:
      'Models from build.nvidia.com are free to call with an nvapi- key. Grab one from any model page → “Get API Key”.',
  },
}

export function SettingsPage() {
  const { data: settings } = useUserSettings()
  const saveSettings = useSaveUserSettings()

  const provider: AIProvider = settings?.ai_provider ?? 'openrouter'
  const meta = PROVIDER_META[provider]

  const [keyDraft, setKeyDraft] = useState('')
  const [freeOnly, setFreeOnly] = useState(true)
  const [validatedKey, setValidatedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reload the key draft / validated key whenever the active provider changes.
  const savedKey = settings?.[meta.keyField] ?? null
  useEffect(() => {
    setKeyDraft(savedKey ?? '')
    setValidatedKey(savedKey)
    setError(null)
  }, [savedKey, provider])

  const {
    data: models,
    isFetching: loadingModels,
    refetch: refetchModels,
  } = useQuery({
    queryKey: ['models', provider, validatedKey],
    enabled: !!validatedKey,
    queryFn: () => listModels(validatedKey!, PROVIDER_BASE[provider], provider),
    retry: false,
  })

  const visibleModels = useMemo(() => {
    if (!models) return []
    const filtered = meta.hasFreeFilter && freeOnly ? models.filter(isFreeModel) : models
    return [...filtered].sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id))
  }, [models, freeOnly, meta.hasFreeFilter])

  const selectedModel = settings?.[meta.modelField] ?? ''

  const switchProvider = (next: AIProvider) => {
    if (next === provider) return
    saveSettings.mutate({ ai_provider: next })
  }

  const handleValidate = async () => {
    setError(null)
    const trimmed = keyDraft.trim()
    if (!trimmed) return
    try {
      await listModels(trimmed, PROVIDER_BASE[provider], provider)
      setValidatedKey(trimmed)
      saveSettings.mutate({ [meta.keyField]: trimmed } as Partial<UserSettingsRow>)
    } catch (e) {
      setValidatedKey(null)
      setError(e instanceof AIError ? e.message : `Could not reach ${meta.label}. Check the key and try again.`)
    }
  }

  const handleSelectModel = (modelId: string) => {
    saveSettings.mutate({ [meta.modelField]: modelId } as Partial<UserSettingsRow>)
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="font-display mb-6 text-xl text-text">Settings</h1>

      {/* Provider selector */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
          AI provider
        </h2>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(Object.keys(PROVIDER_META) as AIProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => switchProvider(p)}
              className={`rounded px-4 py-1.5 text-sm font-medium transition ${
                provider === p ? 'bg-surface-hover text-text' : 'text-muted hover:text-text'
              }`}
            >
              {PROVIDER_META[p].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">{meta.blurb}</p>
      </section>

      {/* API key */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
          {meta.label} API key
        </h2>
        <p className="mb-3 text-sm text-muted">
          Stored in your Supabase account (RLS-protected); calls go directly from your browser.{' '}
          <a
            href={meta.keyUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Get a key →
          </a>
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder={meta.keyPlaceholder}
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
          <button
            onClick={handleValidate}
            disabled={!keyDraft.trim()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
          >
            Validate & save
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-error">{error}</p>}
        {validatedKey && !error && <p className="mt-2 text-sm text-success">Key validated.</p>}
      </section>

      {/* Model picker */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Model</h2>
          {meta.hasFreeFilter && (
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={freeOnly}
                onChange={(e) => setFreeOnly(e.target.checked)}
                disabled={!validatedKey}
              />
              Free models only
            </label>
          )}
        </div>

        {!validatedKey && (
          <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted">
            Validate your {meta.label} key above to load the model list.
          </p>
        )}

        {validatedKey && loadingModels && <p className="text-sm text-muted">Loading models…</p>}

        {validatedKey && !loadingModels && (
          <>
            <select
              value={selectedModel}
              onChange={(e) => handleSelectModel(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
            >
              <option value="" disabled>
                Choose a model…
              </option>
              {visibleModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.id}
                  {meta.hasFreeFilter && isFreeModel(m) ? ' (free)' : ''}
                </option>
              ))}
            </select>
            {visibleModels.length === 0 && (
              <p className="mt-2 text-sm text-muted">
                No {meta.hasFreeFilter && freeOnly ? 'free ' : ''}models returned.
                {meta.hasFreeFilter && freeOnly ? ' Try unchecking “Free models only”.' : ''}
              </p>
            )}
            <button onClick={() => refetchModels()} className="mt-2 text-xs text-muted hover:text-text">
              Refresh model list
            </button>
          </>
        )}
      </section>
    </div>
  )
}
