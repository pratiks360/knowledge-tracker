import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NodeRow } from '@/types/db'
import { getAncestors } from '@/lib/queries/nodes'
import { useNodeLinks } from '@/lib/queries/nodeLinks'

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Read-only "where else does this live" strip. Surfaces two kinds of relation:
 *  - explicit node_links (Related / Uses / Prerequisite)
 *  - same concept filed elsewhere: another node with the same title under a
 *    different parent (e.g. Security under Java AND under a Kafka cert)
 * Each is shown as its full ancestor path so you can see the context at a glance.
 */
export function RelatedPaths({ node, allNodes }: { node: NodeRow; allNodes: NodeRow[] }) {
  const { data: links } = useNodeLinks(node.id)
  const navigate = useNavigate()

  const items = useMemo(() => {
    const byId = new Map(allNodes.map((n) => [n.id, n]))
    const seen = new Set<string>([node.id])
    const out: { id: string; path: string; kind: 'linked' | 'same' }[] = []

    const pathOf = (n: NodeRow) =>
      [...getAncestors(allNodes, n.id).map((a) => a.title), n.title].join(' → ')

    // Explicit links first.
    for (const link of links ?? []) {
      const otherId = link.from_node === node.id ? link.to_node : link.from_node
      if (seen.has(otherId)) continue
      const other = byId.get(otherId)
      if (!other) continue
      seen.add(otherId)
      out.push({ id: other.id, path: pathOf(other), kind: 'linked' })
    }

    // Same concept elsewhere (same title, different node).
    for (const n of allNodes) {
      if (seen.has(n.id)) continue
      if (norm(n.title) === norm(node.title)) {
        seen.add(n.id)
        out.push({ id: n.id, path: pathOf(n), kind: 'same' })
      }
    }

    return out
  }, [links, allNodes, node.id, node.title])

  if (items.length === 0) return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted">Also appears in:</span>
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => navigate(`/node/${it.id}`)}
          title={it.kind === 'same' ? 'Same topic filed elsewhere' : 'Linked topic'}
          className={
            'rounded-full border px-2.5 py-1 text-xs transition hover:text-text ' +
            (it.kind === 'same'
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-border text-muted hover:bg-surface-hover')
          }
        >
          {it.path}
        </button>
      ))}
    </div>
  )
}
