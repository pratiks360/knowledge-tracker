import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import type { NodeRow } from '@/types/db'
import { useAIConfig } from '@/lib/queries/settings'
import { useResources } from '@/lib/queries/resources'
import { generateRoadmap, AIError, type RoadmapProposalNode } from '@/lib/ai'

// React Flow is heavy — only load it when a roadmap proposal is actually shown.
const RoadmapPreview = lazy(() =>
  import('@/components/roadmap/RoadmapPreview').then((m) => ({ default: m.RoadmapPreview }))
)

export function RoadmapGenerator({ node }: { node: NodeRow }) {
  const aiConfig = useAIConfig()
  const { data: resources } = useResources(node.id)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<RoadmapProposalNode[] | null>(null)

  const configured = !!aiConfig

  const handleGenerate = async () => {
    if (!aiConfig) return
    setLoading(true)
    setError(null)
    try {
      const parts = [`Topic: ${node.title}`]
      if (node.description) parts.push(`Description: ${node.description}`)
      if (node.notes_md) parts.push(`Notes:\n${node.notes_md}`)
      for (const r of resources ?? []) {
        const body = r.summary_md || r.raw_content?.slice(0, 1000)
        if (body) parts.push(`Resource "${r.title ?? r.url ?? 'Untitled'}":\n${body}`)
      }
      const result = await generateRoadmap(aiConfig, parts.join('\n\n'))
      setProposal(result)
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Failed to generate a roadmap.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={!configured || loading}
        className="rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate roadmap / subtopics'}
      </button>
      {!configured && (
        <p className="mt-2 text-xs text-muted">
          Add an OpenRouter key in{' '}
          <Link to="/settings" className="text-accent hover:underline">
            Settings
          </Link>{' '}
          to generate a roadmap.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-error">{error}</p>}

      {proposal && (
        <Suspense fallback={null}>
          <RoadmapPreview
            proposal={proposal}
            targetNodeId={node.id}
            onClose={() => setProposal(null)}
            onMerged={() => setProposal(null)}
          />
        </Suspense>
      )}
    </div>
  )
}
