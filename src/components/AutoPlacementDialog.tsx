import { useEffect, useState } from 'react'
import { useNodes, useCreateNode, serializeTreeForAI } from '@/lib/queries/nodes'
import { useAIConfig } from '@/lib/queries/settings'
import { chatJSON, AIError, type AutoPlacementResult } from '@/lib/ai'
import { autoPlacementPrompt } from '@/lib/prompts'
import { NodePicker } from '@/components/NodePicker'

export function AutoPlacementDialog({
  title,
  onClose,
  onCreated,
}: {
  title: string
  onClose: () => void
  onCreated: (nodeId: string) => void
}) {
  const { data: nodes } = useNodes()
  const aiConfig = useAIConfig()
  const createNode = useCreateNode()

  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<AutoPlacementResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    let active = true
    async function run() {
      if (!aiConfig || !nodes) {
        setLoading(false)
        return
      }
      try {
        const prompt = autoPlacementPrompt(title, serializeTreeForAI(nodes))
        const proposal = await chatJSON<AutoPlacementResult>({
          ...aiConfig,
          system: prompt.system,
          user: prompt.user,
          temperature: 0.2,
          maxTokens: 300,
        })
        if (!active) return
        const validParent = proposal.parent_id && nodes.some((n) => n.id === proposal.parent_id)
        setResult({ ...proposal, parent_id: validParent ? proposal.parent_id : null })
      } catch (e) {
        if (!active) return
        setError(e instanceof AIError ? e.message : 'Could not get a placement suggestion.')
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const create = (parentId: string | null) => {
    createNode.mutate(
      { title, parent_id: parentId },
      { onSuccess: (created) => onCreated(created.id) }
    )
  }

  const configured = !!aiConfig

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-sm font-medium text-text">Add &quot;{title}&quot;</h2>

        {!configured && (
          <p className="mb-4 text-sm text-muted">
            Set up an OpenRouter key in Settings to get smart placement suggestions. For now, choose
            where this topic goes:
          </p>
        )}

        {configured && loading && (
          <p className="mb-4 text-sm text-muted">Thinking about where this fits…</p>
        )}

        {configured && !loading && error && (
          <p className="mb-4 text-sm text-error">{error} — choose manually instead:</p>
        )}

        {configured && !loading && !error && result && (
          <div className="mb-4 rounded-md border border-border bg-surface-2 p-3">
            <p className="text-sm text-text">
              Suggested:{' '}
              <span className="font-medium">{result.suggested_path || 'New root topic'}</span>
            </p>
            <p className="mt-1 text-xs text-muted">{result.reasoning}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {configured && !loading && !error && result && (
            <button
              onClick={() => create(result.parent_id)}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg"
            >
              Accept
            </button>
          )}
          <button
            onClick={() => setPickerOpen(true)}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-text hover:bg-surface-hover"
          >
            Pick different parent
          </button>
          <button
            onClick={() => create(null)}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-text hover:bg-surface-hover"
          >
            Make root
          </button>
          <button
            onClick={onClose}
            className="ml-auto rounded-md px-3 py-1.5 text-sm text-muted hover:bg-surface-hover"
          >
            Cancel
          </button>
        </div>
      </div>

      {pickerOpen && nodes && (
        <NodePicker
          nodes={nodes}
          title={`Place "${title}" under…`}
          onClose={() => setPickerOpen(false)}
          onPick={(parentId) => {
            setPickerOpen(false)
            create(parentId)
          }}
        />
      )}
    </div>
  )
}
