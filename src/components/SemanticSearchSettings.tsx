import { useState } from 'react'
import { useSaveUserSettings, useUserSettings, resolveEmbeddingConfig } from '@/lib/queries/settings'
import { useBuildSearchIndex } from '@/lib/queries/embeddings'
import { AIError } from '@/lib/ai'

const MODEL_HINT: Record<'openrouter' | 'nvidia' | 'cloudflare', string> = {
  cloudflare: '@cf/baai/bge-base-en-v1.5',
  nvidia: 'nvidia/nv-embedqa-e5-v5 (must return 768-dim vectors)',
  openrouter: 'openai/text-embedding-3-small (must return 768-dim vectors)',
}

const PROVIDER_LABEL: Record<'openrouter' | 'nvidia' | 'cloudflare', string> = {
  openrouter: 'OpenRouter',
  nvidia: 'NVIDIA',
  cloudflare: 'Cloudflare',
}

export function SemanticSearchSettings() {
  const { data: settings } = useUserSettings()
  const saveSettings = useSaveUserSettings()
  const buildIndex = useBuildSearchIndex()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const provider = settings?.embedding_provider ?? null
  const model = settings?.embedding_model ?? ''
  const cfg = resolveEmbeddingConfig(settings)

  const availableProviders = (['openrouter', 'cloudflare', 'nvidia'] as const).filter((p) => {
    if (p === 'cloudflare') return settings?.cloudflare_api_key && settings?.cloudflare_account_id
    if (p === 'openrouter') return settings?.openrouter_api_key
    return settings?.nvidia_api_key
  })

  const handleBuild = () => {
    if (!cfg) return
    setError(null)
    setProgress({ done: 0, total: 0 })
    buildIndex.mutate(
      { cfg, onProgress: (done, total) => setProgress({ done, total }) },
      {
        onError: (e) =>
          setError(e instanceof AIError ? e.message : 'Failed to build the search index.'),
        onSettled: () => setProgress(null),
      }
    )
  }

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
        Semantic search
      </h2>
      <p className="mb-3 text-sm text-muted">
        Embeds your topics and resources so search can match by meaning, not just keywords. Reuses
        the API key of an already-configured provider — pick which one generates embeddings.
      </p>

      {availableProviders.length === 0 && (
        <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted">
          Configure an OpenRouter, Cloudflare, or NVIDIA key above first — all three offer free
          embedding models.
        </p>
      )}

      {availableProviders.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="inline-flex rounded-md border border-border p-0.5">
            {availableProviders.map((p) => (
              <button
                key={p}
                onClick={() => saveSettings.mutate({ embedding_provider: p })}
                className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                  provider === p ? 'bg-surface-hover text-text' : 'text-muted hover:text-text'
                }`}
              >
                {PROVIDER_LABEL[p]}
              </button>
            ))}
          </div>
          {provider && (
            <input
              defaultValue={model}
              key={provider}
              onBlur={(e) => saveSettings.mutate({ embedding_model: e.target.value.trim() })}
              placeholder={MODEL_HINT[provider]}
              className="min-w-[16rem] flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
            />
          )}
        </div>
      )}

      {provider && (
        <p className="mt-2 text-xs text-muted">
          Model must return 768-dim vectors. Hint: <code>{MODEL_HINT[provider]}</code>
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleBuild}
          disabled={!cfg || buildIndex.isPending}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
        >
          {buildIndex.isPending
            ? progress
              ? `Embedding ${progress.done}/${progress.total}…`
              : 'Starting…'
            : 'Build search index'}
        </button>
        {settings?.embeddings_built_at && !buildIndex.isPending && (
          <span className="text-xs text-muted">
            Last built {new Date(settings.embeddings_built_at).toLocaleString()}
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </section>
  )
}
