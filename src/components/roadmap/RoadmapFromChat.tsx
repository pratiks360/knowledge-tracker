import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useCreateNode, useNodes, serializeTreeForAI } from '@/lib/queries/nodes'
import { useAIConfig } from '@/lib/queries/settings'
import {
  chatJSON,
  generateRoadmapFromChat,
  AIError,
  type RoadmapProposalNode,
  type AutoPlacementResult,
} from '@/lib/ai'
import { autoPlacementPrompt } from '@/lib/prompts'
import type { ChatMessageRow } from '@/types/db'

// React Flow (inside RoadmapPreview) is heavy — only load it once a proposal exists.
const RoadmapPreview = lazy(() =>
  import('@/components/roadmap/RoadmapPreview').then((m) => ({ default: m.RoadmapPreview }))
)

/**
 * Turns the dashboard's planning conversation into a reviewable roadmap: asks the
 * model for a root title + subtopic tree (deduped against the whole graph), creates
 * the root, then hands off to RoadmapPreview for editing and merging.
 */
export function RoadmapFromChat({
  messages,
  webSearch,
  onClose,
  onDone,
}: {
  messages: ChatMessageRow[]
  webSearch?: boolean
  onClose: () => void
  onDone: (nodeId: string) => void
}) {
  const aiConfig = useAIConfig()
  const createNode = useCreateNode()
  const { data: nodes } = useNodes()
  const [rootId, setRootId] = useState<string | null>(null)
  const [proposal, setProposal] = useState<RoadmapProposalNode[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'planning' | 'placing'>('planning')
  const started = useRef(false)

  // Every existing topic, so the preview flags anything the model proposed that the
  // user already has anywhere in their graph — not just under the new root.
  const existingTitles = useMemo(
    () => new Set((nodes ?? []).map((n) => n.title.trim().toLowerCase())),
    [nodes]
  )

  useEffect(() => {
    // StrictMode double-invokes effects in dev; guard so we create the root once.
    if (started.current) return
    started.current = true
    let active = true

    // Best-effort parent suggestion — mirrors the quick-add flow. Any failure (or no
    // good fit) falls back to a root topic.
    async function suggestParentId(title: string): Promise<string | null> {
      const all = nodes ?? []
      if (!aiConfig || all.length === 0) return null
      try {
        const prompt = autoPlacementPrompt(title, serializeTreeForAI(all))
        const result = await chatJSON<AutoPlacementResult>({
          ...aiConfig,
          system: prompt.system,
          user: prompt.user,
          temperature: 0.2,
          maxTokens: 300,
        })
        return result.parent_id && all.some((n) => n.id === result.parent_id)
          ? result.parent_id
          : null
      } catch {
        return null
      }
    }

    async function run() {
      if (!aiConfig) {
        setError('Add an AI key in Settings to build a roadmap.')
        return
      }
      try {
        const transcript = messages
          .map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
          .join('\n\n')
        const tree = serializeTreeForAI(nodes ?? [])

        const { title, nodes: proposed } = await generateRoadmapFromChat(
          aiConfig,
          transcript,
          tree,
          { webSearch }
        )
        if (!active) return
        if (proposed.length === 0) {
          setError(
            'The model didn’t turn that conversation into a roadmap. Try saying more about what you want to learn, then build again.'
          )
          return
        }

        setPhase('placing')
        const rootTitle = title || 'New roadmap'
        const parentId = await suggestParentId(rootTitle)
        if (!active) return
        const root = await createNode.mutateAsync({ title: rootTitle, parent_id: parentId })
        if (!active) return
        setRootId(root.id)
        setProposal(proposed)
      } catch (e) {
        if (!active) return
        setError(e instanceof AIError ? e.message : 'Failed to build a roadmap from this chat.')
      }
    }

    run()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (proposal && rootId) {
    return (
      <Suspense fallback={null}>
        <RoadmapPreview
          proposal={proposal}
          targetNodeId={rootId}
          existingTitles={existingTitles}
          // The root topic exists either way, so both paths open it.
          onClose={() => onDone(rootId)}
          onMerged={() => onDone(rootId)}
        />
      </Suspense>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={error ? onClose : undefined}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-sm font-medium text-text">Building your roadmap</h2>

        {!error && (
          <p className="text-sm text-muted">
            {phase === 'planning'
              ? 'Reading your conversation and planning what to learn…'
              : 'Finding where this fits in your graph…'}
          </p>
        )}

        {error && (
          <>
            <p className="mb-4 mt-2 text-sm text-error">{error}</p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-text hover:bg-surface-hover"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
