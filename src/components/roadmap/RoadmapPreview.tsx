import { useMemo, useState } from 'react'
import { ReactFlow, Background, Controls, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { RoadmapProposalNode } from '@/lib/ai'
import { flattenProposal, useMergeRoadmap, type FlatProposalNode } from '@/lib/queries/roadmap'
import { layoutRoadmap } from '@/lib/roadmapLayout'
import { RoadmapFlowNode, type RoadmapNodeData } from '@/components/roadmap/RoadmapNode'

const nodeTypes = { roadmapNode: RoadmapFlowNode }

export function RoadmapPreview({
  proposal,
  targetNodeId,
  existingTitles,
  onClose,
  onMerged,
}: {
  proposal: RoadmapProposalNode[]
  targetNodeId: string
  /** Lowercased titles already present — pre-unchecked and flagged. */
  existingTitles?: Set<string>
  onClose: () => void
  onMerged: () => void
}) {
  // Held in state (not derived) so the proposal can be edited before it's merged.
  const [flat, setFlat] = useState<FlatProposalNode[]>(() => flattenProposal(proposal))
  const isExisting = (title: string) => !!existingTitles?.has(title.trim().toLowerCase())
  // Default to everything except items that already exist, so a plain "Merge" never duplicates.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(flat.filter((f) => !isExisting(f.title)).map((f) => f.key))
  )
  const mergeRoadmap = useMergeRoadmap(targetNodeId)

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const rename = (key: string, title: string) => {
    setFlat((prev) => prev.map((f) => (f.key === key ? { ...f, title } : f)))
  }

  /** Removes a node and everything beneath it. */
  const remove = (key: string) => {
    const doomed = new Set<string>([key])
    // Walk until the set stops growing so nested descendants are caught regardless
    // of the order `flat` happens to be in.
    let grew = true
    while (grew) {
      grew = false
      for (const f of flat) {
        if (f.parentKey && doomed.has(f.parentKey) && !doomed.has(f.key)) {
          doomed.add(f.key)
          grew = true
        }
      }
    }
    setFlat((prev) => prev.filter((f) => !doomed.has(f.key)))
    setSelected((sel) => new Set([...sel].filter((k) => !doomed.has(k))))
  }

  /**
   * Adds a child under `parentKey` (or a new top-level item when null). Keys follow
   * flattenProposal's `parent-suffix` convention, which the merge relies on to order
   * parents before children.
   */
  const addChild = (parentKey: string | null) => {
    const siblings = flat.filter((f) => f.parentKey === parentKey)
    let key: string
    let i = siblings.length
    do {
      key = `${parentKey ?? 'root'}-new${i++}`
    } while (flat.some((f) => f.key === key))

    const item: FlatProposalNode = {
      key,
      parentKey,
      title: 'New topic',
      prerequisites: [],
      siblingIndex: siblings.length,
    }
    setFlat((prev) => [...prev, item])
    setSelected((sel) => new Set(sel).add(key))
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
        exists: !!existingTitles?.has(f.title.trim().toLowerCase()),
        onToggle: () => toggle(f.key),
        onRename: (title: string) => rename(f.key, title),
        onAddChild: () => addChild(f.key),
        onDelete: () => remove(f.key),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, selected, existingTitles])

  const selectedCount = selected.size

  const handleMerge = () => {
    mergeRoadmap.mutate({ flat, selectedKeys: selected }, { onSuccess: () => onMerged() })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-2 sm:p-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-bg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold text-text">Roadmap proposal</h2>
            <p className="text-xs text-muted">
              {selectedCount} of {flat.length} selected —{' '}
              <span className="hidden sm:inline">
                double-click a title to rename, hover a card to add a subtopic or remove it.
              </span>
              <span className="sm:hidden">double-tap a title to rename.</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => addChild(null)}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover"
            >
              + Add topic
            </button>
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
