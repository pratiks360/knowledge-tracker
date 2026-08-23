import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNodes } from '@/lib/queries/nodes'
import {
  buildExportBundle,
  bundleToMarkdown,
  downloadBundleJSON,
  downloadFile,
  importBundle,
  parseImportBundle,
} from '@/lib/exportGraph'

/** Whole-graph export/import — lives in Settings. For a single subtree, see the node page's export button. */
export function ExportBackup() {
  const { data: nodes } = useNodes()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleExportJSON = async () => {
    if (!nodes) return
    setBusy('json')
    try {
      const bundle = await buildExportBundle(nodes, null)
      downloadBundleJSON(bundle, `knowledge-graph-${Date.now()}.json`)
    } finally {
      setBusy(null)
    }
  }

  const handleExportMarkdown = async () => {
    if (!nodes) return
    setBusy('md')
    try {
      const bundle = await buildExportBundle(nodes, null)
      downloadFile(bundleToMarkdown(bundle), `knowledge-graph-${Date.now()}.md`, 'text/markdown')
    } finally {
      setBusy(null)
    }
  }

  const handleImportFile = async (file: File) => {
    setBusy('import')
    setMessage(null)
    try {
      const text = await file.text()
      const bundle = parseImportBundle(text)
      const count = await importBundle(bundle, null)
      await queryClient.invalidateQueries({ queryKey: ['nodes'] })
      setMessage(`Imported ${count} topic${count === 1 ? '' : 's'} as new root-level topics.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
        Export &amp; backup
      </h2>
      <p className="mb-3 text-sm text-muted">
        Own your data. Export the whole graph as JSON (full fidelity, re-importable) or Markdown
        (readable doc). Import brings a JSON export back in as new top-level topics.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExportJSON}
          disabled={busy !== null || !nodes}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
        >
          {busy === 'json' ? 'Exporting…' : 'Export JSON'}
        </button>
        <button
          onClick={handleExportMarkdown}
          disabled={busy !== null || !nodes}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
        >
          {busy === 'md' ? 'Exporting…' : 'Export Markdown'}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
        >
          {busy === 'import' ? 'Importing…' : 'Import JSON'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImportFile(file)
          }}
        />
      </div>
      {message && <p className="mt-2 text-xs text-muted">{message}</p>}
    </section>
  )
}
