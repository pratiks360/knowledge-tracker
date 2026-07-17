import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { useUpdateNode } from '@/lib/queries/nodes'
import { useAIConfig } from '@/lib/queries/settings'
import { formatNotes, AIError } from '@/lib/ai'
import { appendBlock, countPendingAppends } from '@/lib/notes'
import type { NodeRow } from '@/types/db'

export function NotesPanel({ node }: { node: NodeRow }) {
  const aiConfig = useAIConfig()
  const updateNode = useUpdateNode()
  const [pasteOpen, setPasteOpen] = useState(false)
  const [paste, setPaste] = useState('')
  const [label, setLabel] = useState('')
  const [formatting, setFormatting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const notes = node.notes_md ?? ''
  const pending = countPendingAppends(notes)

  const append = () => {
    if (!paste.trim()) return
    setError(null)
    updateNode.mutate(
      { id: node.id, patch: { notes_md: appendBlock(notes, label.trim() || 'Pasted', paste) } },
      {
        onSuccess: () => {
          setPaste('')
          setLabel('')
          setPasteOpen(false)
        },
        onError: () => setError('Could not append to notes. Try again.'),
      }
    )
  }

  const format = async () => {
    if (!aiConfig || !pending) return
    setFormatting(true)
    setError(null)
    try {
      const merged = await formatNotes(aiConfig, notes)
      updateNode.mutate({ id: node.id, patch: { notes_md: merged } })
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Failed to format notes.')
    } finally {
      setFormatting(false)
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Notes</h2>
        <button
          onClick={() => setPasteOpen((v) => !v)}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-surface-hover hover:text-text"
        >
          {pasteOpen ? 'Cancel' : 'Append text'}
        </button>
      </div>

      {pasteOpen && (
        <div className="mb-3 space-y-2 rounded-lg border border-border bg-surface p-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional) — e.g. Lecture 3, Stack Overflow answer"
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={6}
            autoFocus
            placeholder="Paste anything here — it gets tacked onto the end of your notes, then Format merges it in."
            className="w-full resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button
            onClick={append}
            disabled={!paste.trim() || updateNode.isPending}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg disabled:opacity-50"
          >
            {updateNode.isPending ? 'Appending…' : 'Append to notes'}
          </button>
        </div>
      )}

      {pending > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-text">
          <span>
            {pending} block{pending > 1 ? 's' : ''} appended but not merged in yet.
          </span>
          {aiConfig ? (
            <button
              onClick={format}
              disabled={formatting}
              className="rounded border border-accent/50 px-2 py-0.5 font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {formatting ? 'Formatting…' : 'Format'}
            </button>
          ) : (
            <span className="text-muted">
              Add an AI key in{' '}
              <Link to="/settings" className="text-accent hover:underline">
                Settings
              </Link>{' '}
              to merge them.
            </span>
          )}
        </div>
      )}

      {error && <p className="mb-2 text-sm text-error">{error}</p>}

      <MarkdownEditor
        value={notes}
        placeholder="Write freeform notes in Markdown…"
        onSave={(notes_md) => updateNode.mutate({ id: node.id, patch: { notes_md } })}
      />
    </div>
  )
}
