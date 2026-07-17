import { useMemo, useState } from 'react'
import type { NodeRow } from '@/types/db'
import { useNodes, useUpdateNode } from '@/lib/queries/nodes'

/** Tags are matched case-insensitively in search, so store them lowercased and deduped. */
function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40)
}

export function TagEditor({ node }: { node: NodeRow }) {
  const { data: allNodes } = useNodes()
  const updateNode = useUpdateNode()
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)

  // Rows written before the tags column existed come back without it.
  const tags = useMemo(() => node.tags ?? [], [node.tags])

  // Tags already used elsewhere in the graph, offered as suggestions so the same
  // idea doesn't end up split across "security" and "sec".
  const suggestions = useMemo(() => {
    const used = new Set(tags)
    const counts = new Map<string, number>()
    for (const n of allNodes ?? []) {
      for (const t of n.tags ?? []) {
        if (!used.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t]) => t)
  }, [allNodes, tags])

  const setTags = (next: string[]) => {
    updateNode.mutate({ id: node.id, patch: { tags: next } })
  }

  const addTag = (raw: string) => {
    const tag = normalize(raw)
    if (!tag || tags.includes(tag)) {
      setDraft('')
      return
    }
    setTags([...tags, tag])
    setDraft('')
  }

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag))

  const commitDraft = () => {
    // Allow "a, b, c" in one go — paste-friendly.
    const parts = draft.split(',').map(normalize).filter(Boolean)
    if (parts.length === 0) {
      setDraft('')
      setAdding(false)
      return
    }
    const next = [...tags]
    for (const p of parts) if (!next.includes(p)) next.push(p)
    setTags(next)
    setDraft('')
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="group flex items-center gap-1 rounded-full border border-border bg-surface-2 py-0.5 pl-2.5 pr-1.5 text-xs text-muted"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="rounded-full px-1 text-muted hover:text-error"
            title={`Remove "${tag}"`}
            aria-label={`Remove tag ${tag}`}
          >
            ×
          </button>
        </span>
      ))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            commitDraft()
            setAdding(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag(draft)
            }
            if (e.key === 'Escape') {
              setDraft('')
              setAdding(false)
            }
            // Backspace on an empty box removes the last tag, like most tag inputs.
            if (e.key === 'Backspace' && !draft && tags.length) removeTag(tags[tags.length - 1])
          }}
          placeholder="tag, another tag…"
          className="w-40 rounded-full border border-accent bg-surface-2 px-2.5 py-0.5 text-xs text-text outline-none"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-text"
        >
          + Tag
        </button>
      )}

      {adding && suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {suggestions.map((s) => (
            <button
              key={s}
              // onMouseDown so the click lands before the input's onBlur tears it down.
              onMouseDown={(e) => {
                e.preventDefault()
                addTag(s)
              }}
              className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted hover:text-text"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
