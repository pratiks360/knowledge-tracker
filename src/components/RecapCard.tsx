import { useEffect, useState } from 'react'
import type { NodeRow } from '@/types/db'
import { useUpdateNode } from '@/lib/queries/nodes'
import { useResources } from '@/lib/queries/resources'
import { useAIConfig } from '@/lib/queries/settings'
import { generateRecap, AIError } from '@/lib/ai'

function buildContext(node: NodeRow, resourceSummaries: string[]): string {
  const parts = [`Topic: ${node.title}`]
  if (node.description) parts.push(`Description: ${node.description}`)
  if (node.notes_md) parts.push(`Notes:\n${node.notes_md}`)
  resourceSummaries.forEach((s, i) => parts.push(`Resource ${i + 1}:\n${s}`))
  return parts.join('\n\n')
}

export function RecapCard({ node }: { node: NodeRow }) {
  const aiConfig = useAIConfig()
  const { data: resources } = useResources(node.id)
  const updateNode = useUpdateNode()
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const configured = !!aiConfig

  const generate = async () => {
    if (!aiConfig || !resources) return
    setLoading(true)
    setError(null)
    try {
      const summaries = resources
        .map((r) => r.summary_md || r.raw_content?.slice(0, 800))
        .filter((s): s is string => !!s)
      const recap = await generateRecap(aiConfig, buildContext(node, summaries))
      updateNode.mutate({ id: node.id, patch: { recap_md: recap } })
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Failed to generate a recap.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!node.recap_md && configured && resources) {
      generate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, configured, !!resources])

  if (dismissed) return null

  return (
    <div className="mb-6 rounded-lg border border-accent/30 bg-accent/5 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-accent">
          Welcome back — quick recap
        </span>
        <div className="flex items-center gap-2">
          {node.recap_md && (
            <button
              onClick={generate}
              disabled={loading}
              className="text-xs text-muted hover:text-text"
            >
              Regenerate
            </button>
          )}
          <button onClick={() => setDismissed(true)} className="text-xs text-muted hover:text-text">
            Dismiss
          </button>
        </div>
      </div>
      {loading && <p className="text-sm text-muted">Generating recap…</p>}
      {error && <p className="text-sm text-error">{error}</p>}
      {!loading && node.recap_md && (
        <pre className="whitespace-pre-wrap text-sm text-text">{node.recap_md}</pre>
      )}
      {!loading && !node.recap_md && !configured && (
        <p className="text-sm text-muted">
          It&apos;s been a while since you visited this topic. Add an OpenRouter key in Settings to
          get an AI-generated recap.
        </p>
      )}
    </div>
  )
}
