import { useState } from 'react'
import {
  useAddManualResource,
  useIngestWebResource,
  useIngestYoutubeResource,
  isYoutubeUrl,
} from '@/lib/queries/resources'

export function AddResourceForm({ nodeId }: { nodeId: string }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualContent, setManualContent] = useState('')

  const ingestWeb = useIngestWebResource(nodeId)
  const ingestYoutube = useIngestYoutubeResource(nodeId)
  const addManual = useAddManualResource(nodeId)

  const pending = ingestWeb.isPending || ingestYoutube.isPending

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    setError(null)
    const mutation = isYoutubeUrl(trimmed) ? ingestYoutube : ingestWeb
    mutation.mutate(trimmed, {
      onSuccess: () => setUrl(''),
      onError: (err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch this URL.')
        setManualOpen(true)
      },
    })
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualTitle.trim() || !manualContent.trim()) return
    addManual.mutate(
      { title: manualTitle.trim(), content: manualContent.trim(), url: url.trim() || undefined },
      {
        onSuccess: () => {
          setManualTitle('')
          setManualContent('')
          setManualOpen(false)
          setUrl('')
          setError(null)
        },
      }
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <form onSubmit={handleAddUrl} className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a web page or YouTube URL…"
          className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!url.trim() || pending}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg disabled:opacity-50"
        >
          {pending ? 'Fetching…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => setManualOpen((o) => !o)}
          className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-text"
        >
          Paste manually
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      {manualOpen && (
        <form
          onSubmit={handleManualSubmit}
          className="mt-3 flex flex-col gap-2 border-t border-border pt-3"
        >
          <input
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="Title"
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
          <textarea
            value={manualContent}
            onChange={(e) => setManualContent(e.target.value)}
            placeholder="Paste content / notes…"
            rows={5}
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!manualTitle.trim() || !manualContent.trim() || addManual.isPending}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg disabled:opacity-50"
            >
              Save resource
            </button>
            <button
              type="button"
              onClick={() => setManualOpen(false)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-surface-hover"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
