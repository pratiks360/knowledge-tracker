import { useState } from 'react'
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

  const dirty = draft !== value

  const handleBlur = () => {
    if (dirty) onSave(draft)
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
        <div className="prose prose-invert prose-sm max-w-none p-3">
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
