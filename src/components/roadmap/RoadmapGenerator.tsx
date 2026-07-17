import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { NodeRow } from '@/types/db'
import { useAIConfig } from '@/lib/queries/settings'
import { useResources } from '@/lib/queries/resources'
import { generateRoadmap, AIError, type RoadmapProposalNode } from '@/lib/ai'

// React Flow is heavy — only load it when a roadmap proposal is actually shown.
const RoadmapPreview = lazy(() =>
  import('@/components/roadmap/RoadmapPreview').then((m) => ({ default: m.RoadmapPreview }))
)

/** Serializes the existing subtree under `rootId` as an indented bullet list. */
function serializeSubtree(all: NodeRow[], rootId: string): { text: string; titles: string[] } {
  const childrenBy = new Map<string, NodeRow[]>()
  for (const n of all) {
    if (!n.parent_id) continue
    const arr = childrenBy.get(n.parent_id) ?? []
    arr.push(n)
    childrenBy.set(n.parent_id, arr)
  }
  const lines: string[] = []
  const titles: string[] = []
  const walk = (parentId: string, depth: number) => {
    for (const c of (childrenBy.get(parentId) ?? []).sort((a, b) => a.order_index - b.order_index)) {
      lines.push(`${'  '.repeat(depth)}- ${c.title}`)
      titles.push(c.title)
      walk(c.id, depth + 1)
    }
  }
  walk(rootId, 0)
  return { text: lines.join('\n'), titles }
}

export function RoadmapGenerator({ node, allNodes }: { node: NodeRow; allNodes: NodeRow[] }) {
  const aiConfig = useAIConfig()
  const { data: resources } = useResources(node.id)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<RoadmapProposalNode[] | null>(null)
  // Default on (OpenRouter only) so newly released versions/tools are included by default.
  const [webSearch, setWebSearch] = useState(true)

  const configured = !!aiConfig
  const webSearchAvailable = aiConfig?.provider === 'openrouter'

  // Existing subtopics under this node — used to avoid proposing/creating duplicates.
  const existing = useMemo(() => serializeSubtree(allNodes, node.id), [allNodes, node.id])
  const existingTitles = useMemo(
    () => new Set(existing.titles.map((t) => t.trim().toLowerCase())),
    [existing]
  )

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
      if (existing.text) {
        parts.push(
          `Existing subtopics already under this topic (do NOT propose these again — only add what's missing or newly released/updated in this area):\n${existing.text}`
        )
      }
      const result = await generateRoadmap(aiConfig, parts.join('\n\n'), { webSearch })
      if (result.length === 0) {
        setError(
          webSearch
            ? 'The model didn’t return any subtopics. Try again, or uncheck “Include latest releases”.'
            : 'The model didn’t return any subtopics. Try again.'
        )
      } else {
        setProposal(result)
      }
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Failed to generate a roadmap.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={!configured || loading}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate roadmap / subtopics'}
        </button>
        {webSearchAvailable && (
          <label
            className="flex items-center gap-1.5 text-xs text-muted"
            title="Runs a live web search so newly released versions/tools are included"
          >
            <input
              type="checkbox"
              checked={webSearch}
              onChange={(e) => setWebSearch(e.target.checked)}
              disabled={loading}
            />
            Include latest releases (web search)
          </label>
        )}
      </div>
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
            existingTitles={existingTitles}
            onClose={() => setProposal(null)}
            onMerged={() => setProposal(null)}
          />
        </Suspense>
      )}
    </div>
  )
}
