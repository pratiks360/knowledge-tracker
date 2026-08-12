import { useMemo } from 'react'
import type { NodeRow } from '@/types/db'
import type { FlatProposalNode } from '@/lib/queries/roadmap'
import { RoadmapPreview } from '@/components/roadmap/RoadmapPreview'

/**
 * Seeds the roadmap builder from an already-merged subtree so the user can grow
 * or refine an existing roadmap. Existing nodes keep their real DB id as their
 * proposal key (via `existingIds`), so newly-added topics attach under the right
 * existing parent and nothing already in the graph is duplicated.
 */
function buildSeed(allNodes: NodeRow[], rootId: string) {
  const childrenOf = (pid: string) =>
    allNodes
      .filter((n) => n.parent_id === pid)
      .sort((a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title))

  const flat: FlatProposalNode[] = []
  const walk = (nodeId: string, parentKey: string | null) => {
    for (const c of childrenOf(nodeId)) {
      flat.push({
        key: c.id,
        parentKey,
        title: c.title,
        description: c.description ?? undefined,
        prerequisites: [],
        siblingIndex: flat.length,
      })
      walk(c.id, c.id)
    }
  }
  walk(rootId, null)

  const existingIds = new Map(flat.map((f) => [f.key, f.key]))
  const existingTitles = new Set(flat.map((f) => f.title.trim().toLowerCase()))
  return { flat, existingIds, existingTitles }
}

export function RoadmapEditor({
  node,
  allNodes,
  onClose,
  onMerged,
}: {
  node: NodeRow
  allNodes: NodeRow[]
  onClose: () => void
  onMerged: () => void
}) {
  const { flat, existingIds, existingTitles } = useMemo(
    () => buildSeed(allNodes, node.id),
    [allNodes, node.id]
  )

  return (
    <RoadmapPreview
      proposal={[]}
      targetNodeId={node.id}
      initialFlat={flat}
      existingIds={existingIds}
      existingTitles={existingTitles}
      onClose={onClose}
      onMerged={onMerged}
    />
  )
}
