import { useMemo, useState } from 'react'
import { useNodes, serializeTreeForAI } from '@/lib/queries/nodes'
import { useAIConfig } from '@/lib/queries/settings'
import { useCreateJDPrep } from '@/lib/queries/jdPrep'
import { analyzeJD, AIError, type JDPrepResult } from '@/lib/ai'

/**
 * Paste-a-JD entry point: parses the JD into new prep topics + matches against the
 * existing graph, lets the user deselect items, then creates a `jd_prep` parent that
 * holds the new topics as real children and links the matches instead of duplicating them.
 */
export function JDPrepDialog({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: (nodeId: string) => void
}) {
  const aiConfig = useAIConfig()
  const { data: nodes } = useNodes()
  const createJDPrep = useCreateJDPrep()

  const [jdText, setJdText] = useState('')
  const [phase, setPhase] = useState<'input' | 'loading' | 'preview'>('input')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<JDPrepResult | null>(null)
  const [selectedNew, setSelectedNew] = useState<Set<string>>(new Set())
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set())

  const nodeById = useMemo(() => new Map((nodes ?? []).map((n) => [n.id, n])), [nodes])

  const analyze = async () => {
    if (!aiConfig || !jdText.trim()) return
    setPhase('loading')
    setError(null)
    try {
      const tree = serializeTreeForAI(nodes ?? [])
      const res = await analyzeJD(aiConfig, jdText.trim(), tree)
      if (res.newTopics.length === 0 && res.matchedExistingIds.length === 0) {
        setError('Couldn’t find anything to prep from that JD. Try pasting more of it.')
        setPhase('input')
        return
      }
      setResult(res)
      setSelectedNew(new Set(res.newTopics.map((t) => t.title)))
      setSelectedMatches(new Set(res.matchedExistingIds))
      setPhase('preview')
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Failed to analyze the job description.')
      setPhase('input')
    }
  }

  const toggleNew = (title: string) => {
    setSelectedNew((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }
  const toggleMatch = (id: string) => {
    setSelectedMatches((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const confirm = () => {
    if (!result) return
    createJDPrep.mutate(
      { result, selectedNewTitles: selectedNew, selectedMatchIds: selectedMatches },
      { onSuccess: ({ parentId }) => onDone(parentId) }
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={phase !== 'preview' ? onClose : undefined}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-semibold text-text">Prep for a job description</h2>
          <p className="text-xs text-muted">
            Paste a JD — new prep topics get filed under one parent; anything you already have gets
            linked instead of duplicated.
          </p>
        </div>

        {phase !== 'preview' && (
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              disabled={phase === 'loading'}
              placeholder="Paste the job description here…"
              rows={10}
              className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-50"
            />
            {error && <p className="text-sm text-error">{error}</p>}
            {!aiConfig && <p className="text-sm text-muted">Add an AI key in Settings first.</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                onClick={analyze}
                disabled={!aiConfig || !jdText.trim() || phase === 'loading'}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg disabled:opacity-50"
              >
                {phase === 'loading' ? 'Analyzing…' : 'Analyze'}
              </button>
            </div>
          </div>
        )}

        {phase === 'preview' && result && (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="mb-3 text-sm text-text">
                Prep parent: <span className="font-medium">{result.roleTitle || 'JD prep'}</span>
              </p>

              {result.newTopics.length > 0 && (
                <div className="mb-4">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    New topics to prep
                  </p>
                  <ul className="flex flex-col gap-1">
                    {result.newTopics.map((t) => (
                      <li key={t.title} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedNew.has(t.title)}
                          onChange={() => toggleNew(t.title)}
                        />
                        <span>
                          <span className="text-text">{t.title}</span>
                          {t.description && <span className="block text-xs text-muted">{t.description}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.matchedExistingIds.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    Already in your graph — will be linked, not duplicated
                  </p>
                  <ul className="flex flex-col gap-1">
                    {result.matchedExistingIds.map((id) => {
                      const n = nodeById.get(id)
                      return (
                        <li key={id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedMatches.has(id)}
                            onChange={() => toggleMatch(id)}
                          />
                          <span className="text-text">{n?.title ?? '(deleted topic)'}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border p-3">
              <button
                onClick={onClose}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={
                  createJDPrep.isPending || (selectedNew.size === 0 && selectedMatches.size === 0)
                }
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg disabled:opacity-50"
              >
                {createJDPrep.isPending ? 'Creating…' : 'Create prep'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
