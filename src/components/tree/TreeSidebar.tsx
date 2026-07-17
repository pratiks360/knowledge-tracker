import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useNodes, useCreateNode, buildTree, getAncestors } from '@/lib/queries/nodes'
import { useNodeIdsWithResources } from '@/lib/queries/resources'
import { TreeItem } from '@/components/tree/TreeItem'
import { useUIStore } from '@/lib/store'

/**
 * `drawer` is the mobile off-canvas presentation: it ignores the desktop
 * collapse state (a 40px rail inside a drawer is nonsense) and swaps the
 * collapse control for a close control.
 */
export function TreeSidebar({ variant = 'docked' }: { variant?: 'docked' | 'drawer' }) {
  const { data: nodes, isLoading } = useNodes()
  const { data: resourceIds } = useNodeIdsWithResources()
  const { id: currentNodeId } = useParams()
  const navigate = useNavigate()
  const createNode = useCreateNode()
  const { sidebarCollapsed, toggleSidebar, expandNodes, setMobileNavOpen } = useUIStore()
  const isDrawer = variant === 'drawer'
  const resourceIdSet = resourceIds ?? new Set<string>()

  // Reveal the current topic: expand its ancestors, leaving everything else as-is.
  useEffect(() => {
    if (!nodes || !currentNodeId) return
    const chain = getAncestors(nodes, currentNodeId).map((n) => n.id)
    if (chain.length > 0) expandNodes(chain)
  }, [nodes, currentNodeId, expandNodes])

  const handleAddRoot = () => {
    const title = window.prompt('New root topic title')
    if (!title?.trim()) return
    createNode.mutate(
      { title: title.trim(), parent_id: null },
      { onSuccess: (created) => navigate(`/node/${created.id}`) }
    )
  }

  if (sidebarCollapsed && !isDrawer) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-r border-border py-3">
        <button
          onClick={toggleSidebar}
          className="rounded p-1 text-muted hover:bg-surface-hover hover:text-text"
          title="Expand sidebar"
        >
          »
        </button>
      </div>
    )
  }

  const tree = nodes ? buildTree(nodes) : []

  return (
    <div
      className={`flex shrink-0 flex-col border-r border-border ${
        // The drawer is capped against the viewport so it can't overflow a narrow phone.
        isDrawer ? 'h-full w-[min(17rem,85vw)]' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Topics</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAddRoot}
            className="rounded px-1.5 text-xs text-muted hover:bg-surface-hover hover:text-text"
            title="Add root topic"
          >
            + New
          </button>
          <button
            onClick={() => (isDrawer ? setMobileNavOpen(false) : toggleSidebar())}
            className="rounded px-1 text-xs text-muted hover:bg-surface-hover hover:text-text"
            title={isDrawer ? 'Close' : 'Collapse sidebar'}
          >
            {isDrawer ? '×' : '«'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {isLoading && <p className="px-2 py-1 text-xs text-muted">Loading…</p>}
        {!isLoading && tree.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted">No topics yet — add one to get started.</p>
        )}
        {nodes &&
          tree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              depth={0}
              currentNodeId={currentNodeId}
              allNodes={nodes}
              resourceIds={resourceIdSet}
            />
          ))}
      </div>

      {nodes && nodes.length > 0 && (
        <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted" /> has content
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-muted" /> empty
          </span>
        </div>
      )}
    </div>
  )
}
