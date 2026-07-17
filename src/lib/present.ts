import type { NodeRow } from '@/types/db'

export interface PresentNodeInfo {
  node: NodeRow
  effectiveParentId: string | null
}

/**
 * Builds the presentation graph, reparenting each node to its nearest visible
 * ancestor (or null if none) so it stays connected when intermediate topics are hidden.
 *
 * Selection rule: if the user has marked any topics present_visible, only those show.
 * If nothing is marked, Present mode defaults to the whole graph — so it "just works"
 * without curating first, while still letting you narrow it down by marking topics.
 */
export function buildPresentGraph(allNodes: NodeRow[]): PresentNodeInfo[] {
  const byId = new Map(allNodes.map((n) => [n.id, n]))
  const marked = allNodes.filter((n) => n.present_visible)
  const usingFallback = marked.length === 0
  const visible = usingFallback ? allNodes : marked
  const isVisible = (n: NodeRow) => usingFallback || n.present_visible

  return visible.map((node) => {
    let cursor = node.parent_id ? byId.get(node.parent_id) : undefined
    while (cursor && !isVisible(cursor)) {
      cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined
    }
    return { node, effectiveParentId: cursor?.id ?? null }
  })
}
