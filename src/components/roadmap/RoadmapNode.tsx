import { useEffect, useRef, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

export interface RoadmapNodeData {
  title: string
  description?: string
  selected: boolean
  exists?: boolean
  onToggle: () => void
  onRename?: (title: string) => void
  onAddChild?: () => void
  onDelete?: () => void
  [key: string]: unknown
}

export function RoadmapFlowNode({ data }: NodeProps) {
  const d = data as RoadmapNodeData
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(d.title)
  const inputRef = useRef<HTMLInputElement>(null)

  // The title can change under us (rename from elsewhere, or a re-layout); keep the
  // draft in step while we're not actively editing it.
  useEffect(() => {
    if (!editing) setDraft(d.title)
  }, [d.title, editing])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== d.title) d.onRename?.(trimmed)
    else setDraft(d.title)
  }

  return (
    <div
      className={`group w-[220px] rounded-lg border p-2.5 text-left shadow-sm ${
        d.exists
          ? 'border-warning/40 bg-surface'
          : d.selected
            ? 'border-accent bg-surface-2'
            : 'border-border bg-surface opacity-60'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted" />
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={d.selected}
          onChange={d.onToggle}
          className="mt-0.5 cursor-pointer"
        />
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                // React Flow swallows key events for canvas shortcuts (Backspace deletes
                // the node); stop them at the input so typing behaves normally.
                e.stopPropagation()
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') {
                  setDraft(d.title)
                  setEditing(false)
                }
              }}
              className="nodrag w-full rounded border border-accent bg-surface-2 px-1 text-sm text-text outline-none"
            />
          ) : (
            <p
              onDoubleClick={() => d.onRename && setEditing(true)}
              title={d.onRename ? 'Double-click to rename' : d.title}
              className="truncate text-sm font-medium text-text"
            >
              {d.title}
            </p>
          )}
          {d.exists && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-warning">
              Already added
            </span>
          )}
          {d.description && <p className="line-clamp-2 text-xs text-muted">{d.description}</p>}
        </div>
      </div>

      {/* Always visible on touch — there is no hover to reveal them. */}
      {(d.onAddChild || d.onDelete) && (
        <div className="mt-1.5 flex justify-end gap-1 md:hidden md:group-hover:flex">
          {d.onAddChild && (
            <button
              onClick={d.onAddChild}
              className="nodrag rounded px-1.5 text-xs text-muted hover:bg-surface-hover hover:text-text"
              title="Add a subtopic under this"
            >
              + Sub
            </button>
          )}
          {d.onDelete && (
            <button
              onClick={d.onDelete}
              className="nodrag rounded px-1.5 text-xs text-muted hover:bg-surface-hover hover:text-error"
              title="Remove this and anything under it from the proposal"
            >
              Remove
            </button>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-muted" />
    </div>
  )
}
