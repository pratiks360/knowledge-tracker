import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ReactFlow, Background, Controls, useReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { NodeRow, StoryPathStepRow } from '@/types/db'
import type { PresentNodeInfo } from '@/lib/present'
import { layoutRoadmap } from '@/lib/roadmapLayout'
import { PresentFlowNode, type PresentNodeData } from '@/components/present/PresentNode'
import { PresentSideCard } from '@/components/present/PresentSideCard'
import { StoryPathEditor } from '@/components/present/StoryPathEditor'

const nodeTypes = { presentNode: PresentFlowNode }

export function PresentCanvas({
  presentNodes,
  storySteps,
  presentationId,
  allPresentableNodes,
}: {
  presentNodes: PresentNodeInfo[]
  storySteps: StoryPathStepRow[]
  presentationId: string
  allPresentableNodes: NodeRow[]
}) {
  const byId = new Map(presentNodes.map((p) => [p.node.id, p.node]))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState<number>(-1)
  const [editorOpen, setEditorOpen] = useState(false)
  const { setCenter, fitView, getNode } = useReactFlow()

  const focusNode = (nodeId: string) => {
    const rfNode = getNode(nodeId)
    if (rfNode) {
      setCenter(rfNode.position.x + 110, rfNode.position.y + 40, { zoom: 1.1, duration: 500 })
    }
    setSelectedId(nodeId)
  }

  const goToStep = (index: number) => {
    if (index < 0 || index >= storySteps.length) return
    setStepIndex(index)
    focusNode(storySteps[index].node_id)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToStep(stepIndex + 1)
      else if (e.key === 'ArrowLeft') goToStep(stepIndex - 1)
      else if (e.key === 'Escape') {
        setSelectedId(null)
        fitView({ duration: 400 })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, storySteps])

  const { nodes, edges } = useMemo(() => {
    const rfNodes: Node[] = presentNodes.map(({ node }) => ({
      id: node.id,
      type: 'presentNode',
      position: { x: 0, y: 0 },
      data: {
        title: node.title,
        active: node.id === selectedId,
        onStoryPath: storySteps.some((s) => s.node_id === node.id),
      } satisfies PresentNodeData,
    }))
    const rfEdges: Edge[] = presentNodes
      .filter((p) => p.effectiveParentId)
      .map((p) => ({
        id: `${p.effectiveParentId}-${p.node.id}`,
        source: p.effectiveParentId!,
        target: p.node.id,
      }))

    return { nodes: layoutRoadmap(rfNodes, rfEdges), edges: rfEdges }
  }, [presentNodes, selectedId, storySteps])

  const selectedNode = selectedId ? byId.get(selectedId) : undefined
  const onPath = stepIndex >= 0 && storySteps[stepIndex]?.node_id === selectedId
  const currentStepNode = stepIndex >= 0 ? storySteps[stepIndex] : undefined

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => focusNode(n.id)}
        onPaneClick={() => setSelectedId(null)}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>

      <Link
        to="/"
        className="absolute left-4 top-4 z-10 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs text-muted shadow-lg backdrop-blur hover:text-text"
      >
        ← Exit present mode
      </Link>

      {selectedNode && <PresentSideCard node={selectedNode} onClose={() => setSelectedId(null)} />}

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-surface/95 px-4 py-2 shadow-lg backdrop-blur">
        <button
          onClick={() => goToStep(stepIndex - 1)}
          disabled={stepIndex <= 0}
          className="text-sm text-text disabled:opacity-30"
        >
          ← Back
        </button>
        <span className="text-xs text-muted">
          {storySteps.length === 0
            ? 'No story path configured'
            : stepIndex >= 0
              ? `Step ${stepIndex + 1} / ${storySteps.length}`
              : `${storySteps.length} steps — press Next to start`}
        </span>
        <button
          onClick={() => goToStep(stepIndex < 0 ? 0 : stepIndex + 1)}
          disabled={storySteps.length === 0 || stepIndex >= storySteps.length - 1}
          className="text-sm text-text disabled:opacity-30"
        >
          Next →
        </button>
        {currentStepNode && !onPath && (
          <button
            onClick={() => focusNode(currentStepNode.node_id)}
            className="text-xs text-accent hover:underline"
          >
            Resume path
          </button>
        )}
        <button onClick={() => setEditorOpen(true)} className="text-xs text-muted hover:text-text">
          Configure
        </button>
      </div>

      {editorOpen && (
        <StoryPathEditor
          presentationId={presentationId}
          steps={storySteps}
          presentableNodes={allPresentableNodes}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  )
}
