import type { NodeRow } from '@/types/db'

const STALE_MS = 7 * 24 * 60 * 60 * 1000

export function isNodeStale(node?: Pick<NodeRow, 'last_visited_at'>): boolean {
  if (!node?.last_visited_at) return false
  return Date.now() - new Date(node.last_visited_at).getTime() > STALE_MS
}
