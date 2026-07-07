import { useState } from 'react'
import type { NodeRow, StoryPathStepRow } from '@/types/db'
import {
  useAddStoryStep,
  useRemoveStoryStep,
  useReorderStorySteps,
} from '@/lib/queries/presentation'
import { NodePicker } from '@/components/NodePicker'

export function StoryPathEditor({
  presentationId,
  steps,
  presentableNodes,
  onClose,
}: {
  presentationId: string
  steps: StoryPathStepRow[]
  presentableNodes: NodeRow[]
  onClose: () => void
}) {
  const addStep = useAddStoryStep(presentationId)
  const removeStep = useRemoveStoryStep(presentationId)
  const reorderSteps = useReorderStorySteps(presentationId)
  const [pickerOpen, setPickerOpen] = useState(false)

  const byId = new Map(presentableNodes.map((n) => [n.id, n]))
  const usedNodeIds = new Set(steps.map((s) => s.node_id))
  const available = presentableNodes.filter((n) => !usedNodeIds.has(n.id))

  const move = (index: number, dir: -1 | 1) => {
    const next = [...steps]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    reorderSteps.mutate(next)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-border bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-text">Story path</h2>
          <button
            onClick={() => setPickerOpen(true)}
            disabled={available.length === 0}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
          >
            + Add step
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {steps.length === 0 && (
            <p className="text-sm text-muted">
              No steps yet. Add present-visible topics in the order you want to walk through them.
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {steps.map((step, i) => (
              <li
                key={step.id}
                className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2 py-1.5"
              >
                <span className="w-5 shrink-0 text-xs text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-text">
                  {byId.get(step.node_id)?.title ?? 'Unknown'}
                </span>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-xs text-muted hover:text-text disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === steps.length - 1}
                  className="text-xs text-muted hover:text-text disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeStep.mutate(step.id)}
                  className="text-xs text-muted hover:text-error"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={onClose}
          className="mt-3 self-end rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-surface-hover"
        >
          Done
        </button>
      </div>

      {pickerOpen && (
        <NodePicker
          nodes={available}
          title="Add step…"
          showMakeRoot={false}
          onClose={() => setPickerOpen(false)}
          onPick={(nodeId) => {
            if (nodeId) addStep.mutate(nodeId)
            setPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}
