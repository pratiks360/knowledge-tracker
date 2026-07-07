import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ResourceRow } from '@/types/db'
import { useDeleteResource, useUpdateResource } from '@/lib/queries/resources'
import { useAIConfig } from '@/lib/queries/settings'
import { chatText, summarizeResourceContent, AIError } from '@/lib/ai'
import { simplifyNodePrompt, examplesNodePrompt } from '@/lib/prompts'

const KIND_LABEL: Record<ResourceRow['kind'], string> = {
  web: 'Web',
  youtube: 'YouTube',
  manual: 'Manual',
}

export function ResourceCard({ resource, nodeId }: { resource: ResourceRow; nodeId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState<'summarize' | 'simplify' | 'examples' | null>(null)
  const [transientResult, setTransientResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateResource = useUpdateResource(nodeId)
  const deleteResource = useDeleteResource(nodeId)
  const aiConfig = useAIConfig()
  const configured = !!aiConfig

  const runSummarize = async () => {
    if (!aiConfig || !resource.raw_content) return
    setBusy('summarize')
    setError(null)
    try {
      const summary = await summarizeResourceContent(
        aiConfig,
        resource.title ?? 'Untitled',
        resource.raw_content
      )
      updateResource.mutate({ id: resource.id, patch: { summary_md: summary } })
      setExpanded(true)
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Failed to summarize.')
    } finally {
      setBusy(null)
    }
  }

  const runTransient = async (kind: 'simplify' | 'examples') => {
    if (!aiConfig) return
    const context = resource.summary_md || resource.raw_content?.slice(0, 6000) || ''
    if (!context) return
    setBusy(kind)
    setError(null)
    setTransientResult(null)
    try {
      const { system, user } =
        kind === 'simplify' ? simplifyNodePrompt(context) : examplesNodePrompt(context)
      const text = await chatText({ ...aiConfig, system, user })
      setTransientResult(text)
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = () => {
    if (!window.confirm(`Delete resource "${resource.title ?? 'Untitled'}"?`)) return
    deleteResource.mutate(resource.id)
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="mr-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-muted">
            {KIND_LABEL[resource.kind]}
          </span>
          {resource.url ? (
            <a
              href={resource.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-text hover:underline"
            >
              {resource.title ?? resource.url}
            </a>
          ) : (
            <span className="text-sm font-medium text-text">{resource.title ?? 'Untitled'}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() =>
              updateResource.mutate({ id: resource.id, patch: { pinned: !resource.pinned } })
            }
            title={resource.pinned ? 'Unpin' : 'Pin'}
            className={`rounded px-1.5 py-0.5 text-xs ${resource.pinned ? 'text-warning' : 'text-muted hover:text-text'}`}
          >
            {resource.pinned ? '★' : '☆'}
          </button>
          <button
            onClick={handleDelete}
            className="rounded px-1.5 py-0.5 text-xs text-error hover:bg-surface-hover"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={runSummarize}
          disabled={!configured || busy !== null}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
        >
          {resource.summary_md ? 'Re-summarize' : 'Summarize'}
        </button>
        <button
          onClick={() => runTransient('simplify')}
          disabled={!configured || busy !== null}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
        >
          Simplify
        </button>
        <button
          onClick={() => runTransient('examples')}
          disabled={!configured || busy !== null}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
        >
          Examples
        </button>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="ml-auto rounded-md px-2.5 py-1 text-xs text-muted hover:text-text"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {!configured && (
        <p className="mt-2 text-xs text-muted">
          Add an OpenRouter key in{' '}
          <Link to="/settings" className="text-accent hover:underline">
            Settings
          </Link>{' '}
          to use AI actions.
        </p>
      )}
      {busy && <p className="mt-2 text-xs text-muted">Thinking…</p>}
      {error && <p className="mt-2 text-xs text-error">{error}</p>}

      {transientResult && (
        <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-2 text-xs text-text">
          {transientResult}
        </pre>
      )}

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {resource.summary_md && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Summary</p>
              <pre className="whitespace-pre-wrap text-xs text-text">{resource.summary_md}</pre>
            </div>
          )}
          {resource.raw_content && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                Raw content
              </p>
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-muted">
                {resource.raw_content.slice(0, 4000)}
                {resource.raw_content.length > 4000 ? '…' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
