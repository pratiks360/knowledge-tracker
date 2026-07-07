import { useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { NodeRow, ResourceRow } from '@/types/db'
import { useUpdateNode } from '@/lib/queries/nodes'
import { useResources } from '@/lib/queries/resources'
import { useAIConfig } from '@/lib/queries/settings'
import { generateNodeDetails, AIError } from '@/lib/ai'

function buildContext(node: NodeRow, resources: ResourceRow[]): string {
  const parts = [`Topic: ${node.title}`]
  if (node.description) parts.push(`Description: ${node.description}`)
  if (node.notes_md) parts.push(`Notes:\n${node.notes_md}`)
  for (const r of resources) {
    const body = r.summary_md || r.raw_content?.slice(0, 4000)
    if (body) parts.push(`Resource "${r.title ?? r.url ?? 'Untitled'}":\n${body}`)
  }
  return parts.join('\n\n')
}

export function NodeDetails({ node }: { node: NodeRow }) {
  const aiConfig = useAIConfig()
  const { data: resources } = useResources(node.id)
  const updateNode = useUpdateNode()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasDetails = !!node.details_md?.trim()

  const generate = async () => {
    if (!aiConfig) return
    setLoading(true)
    setError(null)
    try {
      const details = await generateNodeDetails(aiConfig, buildContext(node, resources ?? []))
      // Persist immediately so it survives reloads/navigation.
      updateNode.mutate({ id: node.id, patch: { details_md: details } })
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Failed to generate details.')
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    if (!window.confirm('Clear the generated details for this topic?')) return
    updateNode.mutate({ id: node.id, patch: { details_md: null } })
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Details</h2>
        <div className="flex gap-2">
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

      {hasDetails ? (
        <div className="prose prose-invert prose-sm max-w-none rounded-lg border border-border bg-surface p-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{node.details_md!}</ReactMarkdown>
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
