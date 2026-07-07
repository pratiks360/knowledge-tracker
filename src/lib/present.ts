import type { NodeRow } from '@/types/db'

export interface PresentNodeInfo {
  node: NodeRow
  effectiveParentId: string | null
}

/**
 * Keeps only present_visible nodes, reparenting each to its nearest present_visible
 * ancestor (or null if none) so the presentation graph stays connected even when
 * intermediate topics are hidden.
 */
export function buildPresentGraph(allNodes: NodeRow[]): PresentNodeInfo[] {
  const byId = new Map(allNodes.map((n) => [n.id, n]))
  const visible = allNodes.filter((n) => n.present_visible)

  return visible.map((node) => {
    let cursor = node.parent_id ? byId.get(node.parent_id) : undefined
    while (cursor && !cursor.present_visible) {
      cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined
    }
    return { node, effectiveParentId: cursor?.id ?? null }
  })
}
