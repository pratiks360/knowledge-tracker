import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSaveUserSettings, useUserSettings } from '@/lib/queries/settings'
import { listModels, isFreeModel, pingModel, PROVIDER_BASE, cloudflareBase, AIError } from '@/lib/ai'
import { AutofillSettings } from '@/components/AutofillSettings'
import type { AIProvider, UserSettingsRow } from '@/types/db'

interface ProviderMeta {
  label: string
  keyField: 'openrouter_api_key' | 'nvidia_api_key' | 'cloudflare_api_key'
  modelField: 'selected_model' | 'nvidia_model' | 'cloudflare_model'
  /** Set for providers whose endpoint URL embeds an account id (Cloudflare). */
  accountIdField?: 'cloudflare_account_id'
  /** True if the provider exposes an OpenAI-style /models list; false → manual model id entry. */
  listsModels: boolean
  keyPlaceholder: string
  modelPlaceholder?: string
  hasFreeFilter: boolean
  keyUrl: string
  modelsUrl?: string
  blurb: string
}

const PROVIDER_META: Record<AIProvider, ProviderMeta> = {
  openrouter: {
    label: 'OpenRouter',
    keyField: 'openrouter_api_key',
    modelField: 'selected_model',
    listsModels: true,
    keyPlaceholder: 'sk-or-v1-…',
    hasFreeFilter: true,
    keyUrl: 'https://openrouter.ai/keys',
    blurb: 'Aggregates many providers. Use the “Free models only” filter for $0 models.',
  },
  nvidia: {
    label: 'NVIDIA',
    keyField: 'nvidia_api_key',
    modelField: 'nvidia_model',
    listsModels: true,
    keyPlaceholder: 'nvapi-…',
    hasFreeFilter: false,
    keyUrl: 'https://build.nvidia.com',
    blurb:
      'Models from build.nvidia.com are free to call with an nvapi- key. Grab one from any model page → “Get API Key”.',
  },
  cloudflare: {
    label: 'Cloudflare',
    keyField: 'cloudflare_api_key',
    modelField: 'cloudflare_model',
    accountIdField: 'cloudflare_account_id',
    listsModels: false,
    keyPlaceholder: 'Workers AI API token',
    modelPlaceholder: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    hasFreeFilter: false,
    keyUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    modelsUrl: 'https://developers.cloudflare.com/workers-ai/models/',
    blurb:
      'Workers AI. Needs your Account ID plus an API token with the “Workers AI” permission, and a model id you enter manually.',
  },
}

export function SettingsPage() {
  const { data: settings } = useUserSettings()
  const saveSettings = useSaveUserSettings()

  const provider: AIProvider = settings?.ai_provider ?? 'openrouter'
  const meta = PROVIDER_META[provider]

  const [keyDraft, setKeyDraft] = useState('')
  const [accountDraft, setAccountDraft] = useState('')
  const [modelDraft, setModelDraft] = useState('')
  const [freeOnly, setFreeOnly] = useState(true)
  const [validatedKey, setValidatedKey] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reload the drafts / validated key whenever the active provider (or its saved values) changes.
  const savedKey = settings?.[meta.keyField] ?? null
  const savedAccount = settings?.cloudflare_account_id ?? null
  const savedModel = settings?.[meta.modelField] ?? null
  useEffect(() => {
    setKeyDraft(savedKey ?? '')
    setValidatedKey(savedKey)
    setAccountDraft(savedAccount ?? '')
    setModelDraft(savedModel ?? '')
    setError(null)
  }, [savedKey, savedAccount, savedModel, provider])

  const {
    data: models,
    isFetching: loadingModels,
    refetch: refetchModels,
  } = useQuery({
    queryKey: ['models', provider, validatedKey],
    enabled: !!validatedKey && meta.listsModels,
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
    setError(null)
    saveSettings.mutate(
      { ai_provider: next },
      {
        onError: (e) =>
          setError(
            `Couldn't switch to ${PROVIDER_META[next].label}. If this is a new provider, its database migration may not be applied yet. (${
              e instanceof Error ? e.message : 'unknown error'
            })`
          ),
      }
    )
  }

  // Cloudflare needs account id + token + model all present before we can ping-validate.
  const canValidate = meta.listsModels
    ? !!keyDraft.trim()
    : !!(keyDraft.trim() && accountDraft.trim() && modelDraft.trim())

  const handleValidate = async () => {
    setError(null)
    const key = keyDraft.trim()
    if (!key) return
    setValidating(true)
    try {
      if (meta.listsModels) {
        await listModels(key, PROVIDER_BASE[provider], provider)
        setValidatedKey(key)
        saveSettings.mutate({ [meta.keyField]: key } as Partial<UserSettingsRow>)
      } else {
        // Cloudflare has no /models endpoint — validate the account/token/model with a cheap ping.
        const accountId = accountDraft.trim()
        const model = modelDraft.trim()
        if (!accountId || !model) {
          setError('Enter your Account ID, API token, and a model id.')
          return
        }
        const ok = await pingModel({ provider, apiKey: key, model, baseUrl: cloudflareBase(accountId) })
        if (!ok) {
          setValidatedKey(null)
          setError('Could not reach Cloudflare Workers AI. Check the Account ID, API token, and model id.')
          return
        }
        setValidatedKey(key)
        saveSettings.mutate({
          cloudflare_api_key: key,
          cloudflare_account_id: accountId,
          cloudflare_model: model,
        })
      }
    } catch (e) {
      setValidatedKey(null)
      setError(
        e instanceof AIError ? e.message : `Could not reach ${meta.label}. Check the key and try again.`
      )
    } finally {
      setValidating(false)
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

      {/* Account ID (Cloudflare only) */}
      {meta.accountIdField && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
            {meta.label} Account ID
          </h2>
          <p className="mb-3 text-sm text-muted">
            The account whose Workers AI you want to use — it&apos;s in your dashboard URL and on the
            Workers &amp; Pages overview.
          </p>
          <input
            value={accountDraft}
            onChange={(e) => setAccountDraft(e.target.value)}
            placeholder="32-character account id"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </section>
      )}

      {/* API key */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
          {meta.label} API {meta.accountIdField ? 'token' : 'key'}
        </h2>
        <p className="mb-3 text-sm text-muted">
          Stored in your Supabase account (RLS-protected).{' '}
          <a
            href={meta.keyUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Get a {meta.accountIdField ? 'token' : 'key'} →
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
            disabled={!canValidate || validating}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
          >
            {validating ? 'Validating…' : 'Validate & save'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-error">{error}</p>}
        {validatedKey && !error && <p className="mt-2 text-sm text-success">Validated.</p>}
      </section>

      {/* Model — dropdown for providers that list models, manual entry otherwise */}
      {meta.listsModels ? (
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
              <button
                onClick={() => refetchModels()}
                className="mt-2 text-xs text-muted hover:text-text"
              >
                Refresh model list
              </button>
            </>
          )}
        </section>
      ) : (
        <section>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">Model</h2>
          <input
            value={modelDraft}
            onChange={(e) => setModelDraft(e.target.value)}
            placeholder={meta.modelPlaceholder}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
          <p className="mt-2 text-xs text-muted">
            Enter a Workers AI model id, then click “Validate &amp; save” above.{' '}
            {meta.modelsUrl && (
              <a
                href={meta.modelsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                Browse models →
              </a>
            )}
          </p>
          {selectedModel && (
            <p className="mt-1 text-xs text-success">Saved model: {selectedModel}</p>
          )}
        </section>
      )}

      <div className="mt-8 border-t border-border pt-6">
        <AutofillSettings />
      </div>
    </div>
  )
}
