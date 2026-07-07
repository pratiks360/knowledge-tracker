import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LinkType, NodeRow } from '@/types/db'
import { useAddNodeLink, useDeleteNodeLink, useNodeLinks } from '@/lib/queries/nodeLinks'
import { NodePicker } from '@/components/NodePicker'

const LINK_TYPE_LABEL: Record<LinkType, string> = {
  related: 'Related to',
  uses: 'Uses',
  prerequisite: 'Prerequisite',
}

export function RelatedLinksPanel({ node, allNodes }: { node: NodeRow; allNodes: NodeRow[] }) {
  const { data: links } = useNodeLinks(node.id)
  const addLink = useAddNodeLink(node.id)
  const deleteLink = useDeleteNodeLink(node.id)
  const navigate = useNavigate()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingType, setPendingType] = useState<LinkType>('related')

  const byId = new Map(allNodes.map((n) => [n.id, n]))

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <select
          value={pendingType}
          onChange={(e) => setPendingType(e.target.value as LinkType)}
          className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-text"
        >
          <option value="related">Related to</option>
          <option value="uses">Uses</option>
          <option value="prerequisite">Prerequisite</option>
        </select>
        <button
          onClick={() => setPickerOpen(true)}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover"
        >
          + Relate to…
        </button>
      </div>

      {(!links || links.length === 0) && <p className="text-sm text-muted">No links yet.</p>}

      <ul className="flex flex-col gap-1">
        {links?.map((link) => {
          const otherId = link.from_node === node.id ? link.to_node : link.from_node
          const other = byId.get(otherId)
          const direction = link.from_node === node.id ? '→' : '←'
          return (
            <li
              key={link.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
            >
              <button
                onClick={() => other && navigate(`/node/${other.id}`)}
                className="min-w-0 flex-1 truncate text-left text-text hover:underline"
              >
                <span className="mr-1 text-xs text-muted">
                  {LINK_TYPE_LABEL[link.link_type]} {direction}
                </span>
                {other?.title ?? 'Unknown'}
              </button>
              <button
                onClick={() => deleteLink.mutate(link.id)}
                className="text-xs text-muted hover:text-error"
              >
                Remove
              </button>
            </li>
          )
        })}
      </ul>

      {pickerOpen && (
        <NodePicker
          nodes={allNodes}
          excludeId={node.id}
          title={`${LINK_TYPE_LABEL[pendingType]}…`}
          showMakeRoot={false}
          onClose={() => setPickerOpen(false)}
          onPick={(targetId) => {
            if (targetId) addLink.mutate({ toNode: targetId, linkType: pendingType })
            setPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}
