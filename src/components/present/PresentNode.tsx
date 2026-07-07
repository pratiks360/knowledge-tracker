import { Handle, Position, type NodeProps } from '@xyflow/react'

export interface PresentNodeData {
  title: string
  active: boolean
  onStoryPath: boolean
  [key: string]: unknown
}

export function PresentFlowNode({ data }: NodeProps) {
  const d = data as PresentNodeData
  return (
    <div
      className={`rounded-xl border-2 px-4 py-3 text-center shadow-md transition ${
        d.active
          ? 'border-accent bg-surface-2 text-text'
          : d.onStoryPath
            ? 'border-accent-2/60 bg-surface text-text'
            : 'border-border bg-surface text-text'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted" />
      <p className="font-display text-sm font-medium">{d.title}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-muted" />
    </div>
  )
}
