import { Handle, Position, type NodeProps } from '@xyflow/react'

export interface RoadmapNodeData {
  title: string
  description?: string
  selected: boolean
  onToggle: () => void
  [key: string]: unknown
}

export function RoadmapFlowNode({ data }: NodeProps) {
  const d = data as RoadmapNodeData
  return (
    <div
      className={`w-[220px] rounded-lg border p-2.5 text-left shadow-sm ${
        d.selected ? 'border-accent bg-surface-2' : 'border-border bg-surface opacity-60'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted" />
      <label className="flex cursor-pointer items-start gap-2">
        <input type="checkbox" checked={d.selected} onChange={d.onToggle} className="mt-0.5" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">{d.title}</p>
          {d.description && <p className="line-clamp-2 text-xs text-muted">{d.description}</p>}
        </div>
      </label>
      <Handle type="source" position={Position.Bottom} className="!bg-muted" />
    </div>
  )
}
