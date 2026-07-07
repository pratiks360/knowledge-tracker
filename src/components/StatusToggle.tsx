import type { NodeStatus } from '@/types/db'

const OPTIONS: { value: NodeStatus; label: string; className: string }[] = [
  { value: 'not_started', label: 'Not started', className: 'text-muted' },
  { value: 'learning', label: 'Learning', className: 'text-warning' },
  { value: 'done', label: 'Done', className: 'text-success' },
]

export function StatusToggle({
  value,
  onChange,
}: {
  value: NodeStatus
  onChange: (status: NodeStatus) => void
}) {
  return (
    <div className="flex rounded-md border border-border p-0.5 text-xs">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded px-2.5 py-1 font-medium transition ${
            value === opt.value ? `bg-surface-hover ${opt.className}` : 'text-muted hover:text-text'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
