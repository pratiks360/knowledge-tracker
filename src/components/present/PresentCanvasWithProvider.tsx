import { ReactFlowProvider } from '@xyflow/react'
import type { NodeRow, StoryPathStepRow } from '@/types/db'
import type { PresentNodeInfo } from '@/lib/present'
import { PresentCanvas } from '@/components/present/PresentCanvas'

export function PresentCanvasWithProvider(props: {
  presentNodes: PresentNodeInfo[]
  storySteps: StoryPathStepRow[]
  presentationId: string
  allPresentableNodes: NodeRow[]
}) {
  return (
    <ReactFlowProvider>
      <PresentCanvas {...props} />
    </ReactFlowProvider>
  )
}
