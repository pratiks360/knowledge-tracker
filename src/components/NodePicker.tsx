import { useMemo, useState } from 'react'
import type { NodeRow } from '@/types/db'
import { buildTree, getDescendantIds, type TreeNode } from '@/lib/queries/nodes'

interface NodePickerProps {
  nodes: NodeRow[]
  excludeId?: string // node being moved — can't become its own descendant
  onPick: (parentId: string | null) => void
  onClose: () => void
  title?: string
  showMakeRoot?: boolean
}

export function NodePicker({
  nodes,
  excludeId,
  onPick,
  onClose,
  title,
  showMakeRoot = true,
}: NodePickerProps) {
  const [query, setQuery] = useState('')

  const disallowed = useMemo(() => {
    if (!excludeId) return new Set<string>()
    return new Set([excludeId, ...getDescendantIds(nodes, excludeId)])
  }, [nodes, excludeId])

  const tree = useMemo(() => buildTree(nodes), [nodes])

  const flat = useMemo(() => {
    const list: { node: TreeNode; depth: number }[] = []
    const walk = (items: TreeNode[], depth: number) => {
      for (const n of items) {
        list.push({ node: n, depth })
        walk(n.children, depth + 1)
      }
    }
    walk(tree, 0)
    return list
  }, [tree])

  const filtered = query.trim()
    ? flat.filter(({ node }) => node.title.toLowerCase().includes(query.trim().toLowerCase()))
    : flat

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-md flex-col rounded-lg border border-border bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-sm font-medium text-text">{title ?? 'Choose a parent'}</h2>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics…"
          className="mb-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
        <div className="flex-1 overflow-y-auto">
          {showMakeRoot && (
            <button
              onClick={() => onPick(null)}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-text hover:bg-surface-hover"
            >
              Make root topic
            </button>
          )}
          {filtered.map(({ node, depth }) => {
            const blocked = disallowed.has(node.id)
            return (
              <button
                key={node.id}
                disabled={blocked}
                onClick={() => onPick(node.id)}
                style={{ paddingLeft: 8 + depth * 16 }}
                className="w-full truncate rounded-md py-1.5 text-left text-sm text-text hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
              >
                {node.title}
              </button>
            )
          })}
        </div>
        <button
          onClick={onClose}
          className="mt-3 self-end rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-surface-hover"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
