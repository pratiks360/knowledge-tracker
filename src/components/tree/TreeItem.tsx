import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TreeNode } from '@/lib/queries/nodes'
import { useCreateNode, useDeleteNode, useUpdateNode } from '@/lib/queries/nodes'
import { NodePicker } from '@/components/NodePicker'
import { useUIStore } from '@/lib/store'
import type { NodeRow } from '@/types/db'

// Full static class strings (Tailwind can't see interpolated names).
// Filled dot = node has content; hollow ring = empty stub. Colour = learning status.
const DATA_DOT: Record<string, string> = {
  not_started: 'bg-muted',
  learning: 'bg-warning',
  done: 'bg-success',
}
const EMPTY_DOT: Record<string, string> = {
  not_started: 'border border-muted',
  learning: 'border border-warning',
  done: 'border border-success',
}

// "Content" = substantive learning material the user built up, NOT the one-line
// description (roadmap/subtopic generation auto-fills that on every node).
function nodeHasData(node: NodeRow, resourceIds: Set<string>): boolean {
  return !!node.details_md?.trim() || !!node.notes_md?.trim() || resourceIds.has(node.id)
}

export function TreeItem({
  node,
  depth,
  currentNodeId,
  allNodes,
  resourceIds,
}: {
  node: TreeNode
  depth: number
  currentNodeId?: string
  allNodes: NodeRow[]
  resourceIds: Set<string>
}) {
  const expanded = useUIStore((s) => s.expandedNodeIds.has(node.id))
  const toggleNodeExpanded = useUIStore((s) => s.toggleNodeExpanded)
  const expandNodes = useUIStore((s) => s.expandNodes)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(node.title)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const navigate = useNavigate()

  const createNode = useCreateNode()
  const updateNode = useUpdateNode()
  const deleteNode = useDeleteNode()

  const isActive = node.id === currentNodeId
  const hasChildren = node.children.length > 0
  const hasData = nodeHasData(node, resourceIds)

  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isActive) rowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [isActive])

  const commitRename = () => {
    setRenaming(false)
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== node.title) {
      updateNode.mutate({ id: node.id, patch: { title: trimmed } })
    } else {
      setRenameValue(node.title)
    }
  }

  const handleAddChild = () => {
    const title = window.prompt('New subtopic title')
    if (!title?.trim()) return
    createNode.mutate(
      { title: title.trim(), parent_id: node.id },
      { onSuccess: (created) => navigate(`/node/${created.id}`) }
    )
    expandNodes([node.id])
  }

  const handleDelete = () => {
    const confirmMsg = hasChildren
      ? `Delete "${node.title}" and all ${node.children.length} subtopic(s)?`
      : `Delete "${node.title}"?`
    if (!window.confirm(confirmMsg)) return
    deleteNode.mutate(node.id, {
      onSuccess: () => {
        if (isActive) navigate('/')
      },
    })
  }

  return (
    <div>
      <div
        ref={rowRef}
        className={`group flex items-center gap-1 rounded-md border-l-2 py-1 pr-1 text-sm ${
          isActive
            ? 'border-accent bg-accent/10 font-medium text-text'
            : 'border-transparent text-muted hover:bg-surface-hover hover:text-text'
        }`}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        <button
          onClick={() => toggleNodeExpanded(node.id)}
          className={`h-4 w-4 shrink-0 text-muted ${hasChildren ? '' : 'invisible'}`}
          aria-label="toggle"
        >
          {expanded ? '▾' : '▸'}
        </button>
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            hasData ? DATA_DOT[node.status] : EMPTY_DOT[node.status]
          }`}
          title={hasData ? 'Has content' : 'Empty — no notes, details, or resources'}
        />

        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setRenameValue(node.title)
                setRenaming(false)
              }
            }}
            className="min-w-0 flex-1 rounded border border-accent bg-surface-2 px-1 text-sm text-text outline-none"
          />
        ) : (
          <button
            onClick={() => navigate(`/node/${node.id}`)}
            onDoubleClick={() => setRenaming(true)}
            className="min-w-0 flex-1 truncate text-left"
            title={node.title}
          >
            {node.title}
          </button>
        )}

        {/* Always visible on touch — there is no hover to reveal them. */}
        <div className="flex shrink-0 items-center gap-0.5 md:hidden md:group-hover:flex">
          <button
            onClick={handleAddChild}
            className="rounded px-1 text-xs text-muted hover:bg-surface-2 hover:text-text"
            title="Add subtopic"
          >
            +
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded px-1 text-xs text-muted hover:bg-surface-2 hover:text-text"
              title="More"
            >
              ⋮
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-5 z-10 w-32 rounded-md border border-border bg-surface-2 py-1 shadow-lg"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  onClick={() => {
                    setRenaming(true)
                    setMenuOpen(false)
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-text hover:bg-surface-hover"
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    setPickerOpen(true)
                    setMenuOpen(false)
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-text hover:bg-surface-hover"
                >
                  Move…
                </button>
                <button
                  onClick={() => {
                    handleDelete()
                    setMenuOpen(false)
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-error hover:bg-surface-hover"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {expanded &&
        node.children.map((child) => (
          <TreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            currentNodeId={currentNodeId}
            allNodes={allNodes}
            resourceIds={resourceIds}
          />
        ))}

      {pickerOpen && (
        <NodePicker
          nodes={allNodes}
          excludeId={node.id}
          title={`Move "${node.title}" to…`}
          onClose={() => setPickerOpen(false)}
          onPick={(parentId) => {
            updateNode.mutate({ id: node.id, patch: { parent_id: parentId } })
            setPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}
