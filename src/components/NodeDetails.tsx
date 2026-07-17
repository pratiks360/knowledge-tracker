import { useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { NodeRow, ResourceRow } from '@/types/db'
import { useUpdateNode } from '@/lib/queries/nodes'
import { useResources } from '@/lib/queries/resources'
import { useAIConfig } from '@/lib/queries/settings'
import { generateNodeDetails, AIError, type DetailsLength } from '@/lib/ai'
import { SourceList } from '@/components/resources/SourceList'

const LENGTH_OPTIONS: { value: DetailsLength; label: string }[] = [
  { value: 'brief', label: 'Brief' },
  { value: 'standard', label: 'Standard' },
  { value: 'in-depth', label: 'In-depth' },
]

function buildContext(node: NodeRow, ancestors: NodeRow[], resources: ResourceRow[]): string {
  const path = [...ancestors.map((a) => a.title), node.title].join(' > ')
  const parts = [`Topic path: ${path}`, `Topic: ${node.title}`]

  if (ancestors.length > 0) {
    const parentPath = ancestors.map((a) => a.title).join(' > ')
    parts.push(
      `This is a subtopic — interpret "${node.title}" specifically within the context of "${parentPath}", ` +
        `not as a generic standalone term. For example, "Version" under "Java" means Java's versions and their changelogs.`
    )
    const ancestorNotes = ancestors
      .filter((a) => a.description)
      .map((a) => `- ${a.title}: ${a.description}`)
      .join('\n')
    if (ancestorNotes) parts.push(`Ancestor context:\n${ancestorNotes}`)
  }

  if (node.description) parts.push(`Description: ${node.description}`)
  if (node.notes_md) parts.push(`Notes:\n${node.notes_md}`)
  for (const r of resources) {
    const body = r.summary_md || r.raw_content?.slice(0, 4000)
    if (body) parts.push(`Resource "${r.title ?? r.url ?? 'Untitled'}":\n${body}`)
  }
  return parts.join('\n\n')
}

export function NodeDetails({ node, ancestors }: { node: NodeRow; ancestors: NodeRow[] }) {
  const aiConfig = useAIConfig()
  const { data: resources } = useResources(node.id)
  const updateNode = useUpdateNode()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const [length, setLength] = useState<DetailsLength>('standard')
  const [instructions, setInstructions] = useState('')

  const hasDetails = !!node.details_md?.trim()
  const sources = resources ?? []

  // Sources attached after the write-up was generated aren't reflected in it yet.
  const newSources =
    hasDetails && node.details_generated_at
      ? sources.filter(
          (r) => new Date(r.created_at).getTime() > new Date(node.details_generated_at!).getTime()
        )
      : []

  const generate = async () => {
    if (!aiConfig) return
    setLoading(true)
    setError(null)
    try {
      const details = await generateNodeDetails(aiConfig, buildContext(node, ancestors, sources), {
        length,
        instructions: instructions.trim() || undefined,
      })
      // Persist immediately so it survives reloads/navigation. Stamp the time so we can
      // detect when newer resources make the write-up stale.
      updateNode.mutate({
        id: node.id,
        patch: { details_md: details, details_generated_at: new Date().toISOString() },
      })
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Failed to generate details.')
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    if (!window.confirm('Clear the generated details for this topic?')) return
    updateNode.mutate({ id: node.id, patch: { details_md: null, details_generated_at: null } })
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Details</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowOptions((v) => !v)}
            disabled={!aiConfig}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-surface-hover hover:text-text disabled:opacity-50"
          >
            Options
          </button>
          <button
            onClick={generate}
            disabled={loading || !aiConfig}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Generating…' : hasDetails ? 'Regenerate' : 'Generate details'}
          </button>
          {hasDetails && (
            <button
              onClick={clear}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-surface-hover hover:text-text"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {showOptions && aiConfig && (
        <div className="mb-3 space-y-3 rounded-lg border border-border bg-surface p-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Output length</label>
            <div className="flex gap-1.5">
              {LENGTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLength(opt.value)}
                  className={
                    'rounded-md border px-3 py-1 text-xs font-medium ' +
                    (length === opt.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-muted hover:bg-surface-hover hover:text-text')
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label
              htmlFor="details-instructions"
              className="mb-1.5 block text-xs font-medium text-muted"
            >
              Additional instructions <span className="font-normal">(optional)</span>
            </label>
            <textarea
              id="details-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="e.g. focus on real-world examples, explain the internals, keep it beginner-friendly…"
              className="w-full resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      )}

      {!aiConfig && (
        <p className="text-sm text-muted">
          Add an AI key in{' '}
          <Link to="/settings" className="text-accent hover:underline">
            Settings
          </Link>{' '}
          to generate details.
        </p>
      )}

      {error && <p className="mb-2 text-sm text-error">{error}</p>}

      {hasDetails && newSources.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-text">
          <span>
            {newSources.length} new source{newSources.length > 1 ? 's' : ''} added since this was
            generated.
          </span>
          <button
            onClick={generate}
            disabled={loading}
            className="rounded border border-warning/50 px-2 py-0.5 font-medium text-warning hover:bg-warning/10 disabled:opacity-50"
          >
            Regenerate to include {newSources.length > 1 ? 'them' : 'it'}
          </button>
        </div>
      )}

      {hasDetails ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{node.details_md!}</ReactMarkdown>
          </div>
          {sources.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Sources ({sources.length})
              </p>
              <SourceList resources={sources} />
            </div>
          )}
        </div>
      ) : (
        aiConfig &&
        !loading && (
          <p className="text-sm text-muted">
            No details yet. Generate a full write-up that merges this topic&apos;s notes and attached
            web/YouTube resources — it&apos;s saved and persists across visits.
          </p>
        )
      )}
    </div>
  )
}
