import { useMemo, useState } from 'react'
import { ReactFlow, Background, Controls, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { RoadmapProposalNode } from '@/lib/ai'
import { flattenProposal, useMergeRoadmap } from '@/lib/queries/roadmap'
import { layoutRoadmap } from '@/lib/roadmapLayout'
import { RoadmapFlowNode, type RoadmapNodeData } from '@/components/roadmap/RoadmapNode'

const nodeTypes = { roadmapNode: RoadmapFlowNode }

export function RoadmapPreview({
  proposal,
  targetNodeId,
  onClose,
  onMerged,
}: {
  proposal: RoadmapProposalNode[]
  targetNodeId: string
  onClose: () => void
  onMerged: () => void
}) {
  const flat = useMemo(() => flattenProposal(proposal), [proposal])
  const [selected, setSelected] = useState<Set<string>>(() => new Set(flat.map((f) => f.key)))
  const mergeRoadmap = useMergeRoadmap(targetNodeId)

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const { nodes, edges } = useMemo(() => {
    const titleToKey = new Map(flat.map((f) => [f.title.toLowerCase(), f.key]))
    const rfNodes: Node[] = flat.map((f) => ({
      id: f.key,
      type: 'roadmapNode',
      position: { x: 0, y: 0 },
      data: {
        title: f.title,
        description: f.description,
        selected: selected.has(f.key),
        onToggle: () => toggle(f.key),
      } satisfies RoadmapNodeData,
    }))

    const rfEdges: Edge[] = []
    flat.forEach((f) => {
      if (f.parentKey) {
        rfEdges.push({ id: `h-${f.parentKey}-${f.key}`, source: f.parentKey, target: f.key })
      }
      f.prerequisites.forEach((p) => {
        const prereqKey = titleToKey.get(p.toLowerCase())
        if (prereqKey && prereqKey !== f.key) {
          rfEdges.push({
            id: `p-${prereqKey}-${f.key}`,
            source: prereqKey,
            target: f.key,
            style: { strokeDasharray: '4 4' },
            label: 'prereq',
          })
        }
      })
    })

    return { nodes: layoutRoadmap(rfNodes, rfEdges), edges: rfEdges }
  }, [flat, selected])

  const selectedCount = selected.size

  const handleMerge = () => {
    mergeRoadmap.mutate(
      { flat, selectedKeys: selected },
      {
        onSuccess: () => onMerged(),
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-bg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-medium text-text">Roadmap proposal</h2>
            <p className="text-xs text-muted">
              {selectedCount} of {flat.length} selected — uncheck any you don&apos;t want to add.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelected(new Set(flat.map((f) => f.key)))}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover"
            >
              Select all
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover"
            >
              Select none
            </button>
            <button
              onClick={handleMerge}
              disabled={selectedCount === 0 || mergeRoadmap.isPending}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-bg disabled:opacity-50"
            >
              {mergeRoadmap.isPending ? 'Merging…' : `Merge ${selectedCount}`}
            </button>
            <button
              onClick={onClose}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:bg-surface-hover"
            >
              Cancel
            </button>
          </div>
        </div>
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
