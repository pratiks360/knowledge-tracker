import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useCreateNode, useNodes, serializeTreeForAI } from '@/lib/queries/nodes'
import { useAIConfig, useWebSearchConfig } from '@/lib/queries/settings'
import {
  generateRoadmap,
  generateRoadmapFromOutline,
  chatJSON,
  AIError,
  type RoadmapProposalNode,
  type AutoPlacementResult,
} from '@/lib/ai'
import { autoPlacementPrompt } from '@/lib/prompts'

// React Flow (inside RoadmapPreview) is heavy — only load it once a proposal exists.
const RoadmapPreview = lazy(() =>
  import('@/components/roadmap/RoadmapPreview').then((m) => ({ default: m.RoadmapPreview }))
)

/**
 * Quick-add flow that turns a bare topic into a learning tree: creates the root
 * topic, asks the AI for a roadmap of subtopics, and shows the existing
 * RoadmapPreview so the user can review/prune before it's merged under the root.
 */
export function RoadmapQuickAdd({
  title,
  sourceOutline,
  webSearch,
  onClose,
  onDone,
}: {
  title: string
  /** Raw outline the user pasted (e.g. from roadmap.sh) — the AI organizes the roadmap around it. */
  sourceOutline?: string
  /** Run a live web search so current exam objectives / releases are included (OpenRouter only). */
  webSearch?: boolean
  onClose: () => void
  onDone: (nodeId: string) => void
}) {
  const aiConfig = useAIConfig()
  const webSearchConfig = useWebSearchConfig()
  const createNode = useCreateNode()
  const { data: nodes } = useNodes()
  const [rootId, setRootId] = useState<string | null>(null)
  const [proposal, setProposal] = useState<RoadmapProposalNode[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    // StrictMode double-invokes effects in dev; guard so we create the root once.
    if (started.current) return
    started.current = true
    let active = true

    // Best-effort parent suggestion — mirrors the "Add" flow's auto-placement.
    // Any failure (or no good fit) falls back to a root topic.
    async function suggestParentId(rootTitle: string): Promise<string | null> {
      const all = nodes ?? []
      if (!aiConfig || all.length === 0) return null
      try {
        const prompt = autoPlacementPrompt(rootTitle, serializeTreeForAI(all))
        const proposal = await chatJSON<AutoPlacementResult>({
          ...aiConfig,
          system: prompt.system,
          user: prompt.user,
          temperature: 0.2,
          maxTokens: 300,
        })
        return proposal.parent_id && all.some((n) => n.id === proposal.parent_id)
          ? proposal.parent_id
          : null
      } catch {
        return null
      }
    }

    async function run() {
      if (!aiConfig) {
        setError('Add an AI key in Settings to generate a roadmap.')
        return
      }
      try {
        // Web search runs on the OpenRouter key even when chat is on another provider.
        const searchConfig = webSearch && webSearchConfig ? webSearchConfig : aiConfig
        let rootTitle = title
        let result: RoadmapProposalNode[]

        if (sourceOutline) {
          // Pasted outline: transcribe it faithfully FIRST (the model also names the root —
          // the first line of a syllabus is usually a section heading, not the subject), and
          // only then create the root, so a failed generation leaves nothing behind.
          const generated = await generateRoadmapFromOutline(searchConfig, sourceOutline, title, {
            webSearch,
          })
          if (!active) return
          result = generated.nodes
          rootTitle = generated.title || title
          if (result.length === 0) {
            setError('The model couldn’t read that outline. Try pasting it again, or send it to the coach instead.')
            return
          }
        } else {
          result = []
        }

        // 1. Best-effort placement: tuck the topic under the most relevant existing
        //    topic (e.g. "Streams in Java" → under "Java"), else make it a root.
        const parentId = await suggestParentId(rootTitle)
        if (!active) return
        // 2. Create the root topic so the roadmap has something to hang under.
        const root = await createNode.mutateAsync({ title: rootTitle, parent_id: parentId })
        if (!active) return
        setRootId(root.id)
        // 3. Bare topic: ask the model for a subtopic tree.
        if (!sourceOutline) {
          result = await generateRoadmap(searchConfig, `Topic: ${title}`, { webSearch })
          if (!active) return
        }
        if (result.length === 0) {
          // Root already exists; let the user open it and retry from the topic page.
          setError('The model didn’t return any subtopics — the topic was created, open it and try “Generate roadmap” again.')
          return
        }
        setProposal(result)
      } catch (e) {
        if (!active) return
        setError(e instanceof AIError ? e.message : 'Failed to generate a roadmap.')
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
          // The root topic already exists either way, so both paths open it.
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
        className="w-full max-w-md rounded-lg border border-border bg-surface shadow-lg animate-pop p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-sm font-medium text-text">
          Building a roadmap for &quot;{title}&quot;
        </h2>

        {!error && (
          <p className="text-sm text-muted">
            {rootId
              ? 'Mapping out subtopics and their order…'
              : 'Finding where this fits and planning what to learn…'}
          </p>
        )}

        {error && (
          <>
            <p className="mb-4 mt-2 text-sm text-error">{error}</p>
            <div className="flex justify-end gap-2">
              {rootId && (
                <button
                  onClick={() => onDone(rootId)}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg"
                >
                  Open topic anyway
                </button>
              )}
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
