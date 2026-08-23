import { useState } from 'react'
import type { NodeRow } from '@/types/db'
import { buildExportBundle, bundleToMarkdown, downloadBundleJSON, downloadFile } from '@/lib/exportGraph'

export function ExportSubtreeButton({ node, allNodes }: { node: NodeRow; allNodes: NodeRow[] }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const slug = node.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)

  const run = async (kind: 'json' | 'md') => {
    setBusy(true)
    try {
      const bundle = await buildExportBundle(allNodes, node.id)
      if (kind === 'json') downloadBundleJSON(bundle, `${slug}-${Date.now()}.json`)
      else downloadFile(bundleToMarkdown(bundle), `${slug}-${Date.now()}.md`, 'text/markdown')
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:bg-surface-hover hover:text-text"
      >
        Export
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-border bg-surface py-1 shadow-lg">
            <button
              disabled={busy}
              onClick={() => run('json')}
              className="block w-full px-3 py-1.5 text-left text-xs text-text hover:bg-surface-hover disabled:opacity-50"
            >
              As JSON
            </button>
            <button
              disabled={busy}
              onClick={() => run('md')}
              className="block w-full px-3 py-1.5 text-left text-xs text-text hover:bg-surface-hover disabled:opacity-50"
            >
              As Markdown
            </button>
          </div>
        </>
      )}
    </div>
  )
}
