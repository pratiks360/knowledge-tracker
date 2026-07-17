import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownEditor({
  value,
  onSave,
  placeholder,
}: {
  value: string
  onSave: (value: string) => void
  placeholder?: string
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>(value ? 'preview' : 'edit')
  const [draft, setDraft] = useState(value)
  const [conflict, setConflict] = useState(false)

  const dirty = draft !== value
  // Tracks the last `value` we reconciled against, so we can tell an external write
  // (append, AI format) apart from a re-render.
  const lastValue = useRef(value)

  useEffect(() => {
    if (value === lastValue.current) return
    const previous = lastValue.current
    lastValue.current = value
    if (draft === value) return // our own save came back
    // Adopt the incoming notes unless the user typed something we'd throw away.
    if (draft !== previous) setConflict(true)
    else setDraft(value)
  }, [value, draft])

  const handleBlur = () => {
    if (dirty) onSave(draft)
  }

  const discardLocal = () => {
    setDraft(value)
    setConflict(false)
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setMode('edit')}
            className={`rounded px-2 py-1 ${mode === 'edit' ? 'bg-surface-hover text-text' : 'text-muted'}`}
          >
            Edit
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`rounded px-2 py-1 ${mode === 'preview' ? 'bg-surface-hover text-text' : 'text-muted'}`}
          >
            Preview
          </button>
        </div>
        {dirty && <span className="text-xs text-muted">Unsaved — click away to save</span>}
      </div>

      {conflict && (
        <div className="flex flex-wrap items-center gap-2 border-b border-warning/40 bg-warning/10 px-3 py-2 text-xs text-text">
          <span>These notes changed elsewhere. Your unsaved edits are still shown below.</span>
          <button
            onClick={discardLocal}
            className="rounded border border-warning/50 px-2 py-0.5 font-medium text-warning hover:bg-warning/10"
          >
            Discard mine &amp; reload
          </button>
        </div>
      )}

      {mode === 'edit' ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={10}
          className="w-full resize-y bg-transparent p-3 text-sm text-text outline-none placeholder:text-muted"
        />
      ) : (
        <div className="prose prose-sm max-w-none p-3">
          {draft.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
          ) : (
            <p className="text-sm text-muted">{placeholder}</p>
          )}
        </div>
      )}
    </div>
  )
}
