import { useEffect, useRef, useState } from 'react'

// Loaded from a CDN at runtime instead of an npm dependency, so it needs no
// package.json / lockfile change (keeps CI's frozen-lockfile and Vercel happy).
// If the CDN is blocked (e.g. a corporate proxy), rendering falls back to the
// raw diagram source.
const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, text: string) => Promise<{ svg: string }>
}

let mermaidPromise: Promise<MermaidApi> | null = null
function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import(/* @vite-ignore */ MERMAID_CDN).then((mod) => {
      const m = (mod as { default: MermaidApi }).default
      const dark = document.documentElement.classList.contains('dark')
      m.initialize({
        startOnLoad: false,
        theme: dark ? 'dark' : 'default',
        securityLevel: 'strict',
        // Otherwise mermaid injects its own "bomb" error graphic straight into the DOM
        // (outside our component's control) on a parse failure — we handle the failure
        // ourselves below by falling back to the raw source instead.
        suppressErrorRendering: true,
      })
      return m
    })
  }
  return mermaidPromise
}

let counter = 0

export function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    const id = `mmd-${++counter}`
    loadMermaid()
      .then((m) => m.render(id, code))
      .then(({ svg }) => {
        if (active && ref.current) ref.current.innerHTML = svg
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [code])

  if (failed) {
    return (
      <pre className="my-3 overflow-x-auto rounded-md border border-border bg-surface-2 p-3 text-xs text-muted">
        {code}
      </pre>
    )
  }

  return <div ref={ref} className="my-3 flex justify-center overflow-x-auto" aria-label="diagram" />
}
