import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { useNodes } from '@/lib/queries/nodes'
import { usePresentation, useStoryPathSteps } from '@/lib/queries/presentation'
import { buildPresentGraph } from '@/lib/present'
import { FullscreenSpinner } from '@/components/FullscreenSpinner'

// React Flow + its provider are heavy — only load them when present mode is opened.
const PresentCanvasLazy = lazy(() =>
  import('@/components/present/PresentCanvasWithProvider').then((m) => ({
    default: m.PresentCanvasWithProvider,
  }))
)

export function PresentPage() {
  const { data: nodes, isLoading: nodesLoading } = useNodes()
  const { data: presentation, isLoading: presentationLoading } = usePresentation()
  const { data: storySteps } = useStoryPathSteps(presentation?.id)

  if (nodesLoading || presentationLoading) return <FullscreenSpinner label="Loading" />

  const presentNodes = buildPresentGraph(nodes ?? [])

  if (presentNodes.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg text-center">
        <p className="text-sm text-muted">No topics to present yet.</p>
        <p className="text-sm text-muted">
          Create a topic — Present mode shows all of them by default.
        </p>
        <Link to="/" className="text-sm text-accent hover:underline">
          Back to dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="h-dvh w-full bg-bg">
      <Suspense fallback={<FullscreenSpinner label="Loading" />}>
        <PresentCanvasLazy
          presentNodes={presentNodes}
          storySteps={storySteps ?? []}
          presentationId={presentation!.id}
          allPresentableNodes={presentNodes.map((p) => p.node)}
        />
      </Suspense>
    </div>
  )
}
