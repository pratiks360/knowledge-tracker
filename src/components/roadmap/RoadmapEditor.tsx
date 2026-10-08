import { useMemo } from 'react'
import type { NodeRow } from '@/types/db'
import { buildRoadmapSeed } from '@/lib/queries/roadmap'
import { RoadmapPreview } from '@/components/roadmap/RoadmapPreview'

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
    () => buildRoadmapSeed(allNodes, node.id),
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
