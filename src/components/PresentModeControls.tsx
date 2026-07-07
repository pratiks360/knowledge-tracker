import { useState } from 'react'
import type { NodeRow } from '@/types/db'
import { useUpdateNode } from '@/lib/queries/nodes'

export function PresentModeControls({ node, allNodes }: { node: NodeRow; allNodes: NodeRow[] }) {
  const updateNode = useUpdateNode()
  const [summaryDraft, setSummaryDraft] = useState(node.present_summary ?? '')

  const isRoot = node.node_kind === 'profile_root'

  const handleToggleRoot = () => {
    if (!isRoot) {
      const otherRoot = allNodes.find((n) => n.node_kind === 'profile_root' && n.id !== node.id)
      if (otherRoot) updateNode.mutate({ id: otherRoot.id, patch: { node_kind: 'topic' } })
    }
    updateNode.mutate({ id: node.id, patch: { node_kind: isRoot ? 'topic' : 'profile_root' } })
  }

  return (
    <details className="rounded-lg border border-border bg-surface p-3">
      <summary className="cursor-pointer text-sm font-medium text-text">
        Present mode
        {node.present_visible && <span className="ml-2 text-xs text-accent-2">Visible</span>}
        {isRoot && <span className="ml-2 text-xs text-warning">Presentation root</span>}
      </summary>

      <div className="mt-3 flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={node.present_visible}
            onChange={(e) =>
              updateNode.mutate({ id: node.id, patch: { present_visible: e.target.checked } })
            }
          />
          Show this topic in Present mode
        </label>

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
            Present summary
          </p>
          <textarea
            value={summaryDraft}
            onChange={(e) => setSummaryDraft(e.target.value)}
            onBlur={() => {
              if (summaryDraft !== (node.present_summary ?? '')) {
                updateNode.mutate({ id: node.id, patch: { present_summary: summaryDraft } })
              }
            }}
            placeholder="Curated blurb shown in Present mode…"
            rows={3}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </div>

        <button
          onClick={handleToggleRoot}
          className="self-start rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover"
        >
          {isRoot ? 'Unset as presentation root' : 'Set as presentation root'}
        </button>
      </div>
    </details>
  )
}
