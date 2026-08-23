import { lazy, Suspense } from 'react'
import { FullscreenSpinner } from '@/components/FullscreenSpinner'

// React Flow is heavy — load it only when the graph view is opened.
const GraphView = lazy(() => import('@/components/graph/GraphView').then((m) => ({ default: m.GraphView })))

export function GraphPage() {
  return (
    <Suspense fallback={<FullscreenSpinner label="Loading graph" />}>
      <GraphView />
    </Suspense>
  )
}
