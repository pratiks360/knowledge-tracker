import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatThreadRow } from '@/types/db'
import { useRenameThread, useSearchThreadMessages } from '@/lib/queries/chat'

/**
 * Tab strip for the coach's conversations. Tabs are ordered most-recently-used
 * first (the query sorts by updated_at), so the one you're working in stays to
 * the left rather than the strip reshuffling under you mid-session.
 */
export function ChatTabs({
  threads,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  threads: ChatThreadRow[]
  activeId: string | undefined
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameThread = useRenameThread()
  const activeRef = useRef<HTMLDivElement>(null)

  const trimmed = search.trim()
  // Title matching is instant and local; message matching needs a round trip, so
  // it only kicks in past a couple of characters.
  const { data: contentMatches, isFetching } = useSearchThreadMessages(trimmed)

  const visible = useMemo(() => {
    if (!trimmed) return threads
    const q = trimmed.toLowerCase()
    return threads.filter(
      (t) => t.title.toLowerCase().includes(q) || contentMatches?.has(t.id)
    )
  }, [threads, trimmed, contentMatches])

  // Keep the selected tab on screen when the strip scrolls horizontally.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId])

  const commitRename = (id: string) => {
    const title = renameValue.trim()
    setRenamingId(null)
    if (title) renameThread.mutate({ id, title })
  }

  return (
    <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {visible.map((t) => {
          const isActive = t.id === activeId
          return (
            <div
              key={t.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSelect(t.id)}
              onDoubleClick={() => {
                setRenamingId(t.id)
                setRenameValue(t.title)
              }}
              title={`${t.title} — double-click to rename`}
              className={`group flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition ${
                isActive
                  ? 'border-accent/40 bg-accent/10 text-text'
                  : 'border-transparent text-muted hover:bg-surface-hover hover:text-text'
              }`}
            >
              {renamingId === t.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(t.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-36 rounded border border-accent bg-surface-2 px-1 text-xs text-text outline-none"
                />
              ) : (
                <span className="max-w-[12rem] truncate">{t.title}</span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(t.id)
                }}
                aria-label={`Close ${t.title}`}
                title="Close permanently"
                // Fades in on hover at desktop; always visible on touch.
                className={`rounded px-1 text-muted transition hover:text-error ${
                  isActive ? '' : 'md:opacity-0 md:group-hover:opacity-100'
                }`}
              >
                ×
              </button>
            </div>
          )
        })}

        {trimmed && visible.length === 0 && (
          <span className="px-2 text-xs text-muted">
            {isFetching ? 'Searching…' : 'No conversations match'}
          </span>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search chats…"
        className="w-36 shrink-0 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-text outline-none transition focus:border-accent"
      />
      <button
        onClick={onNew}
        title="New chat"
        aria-label="New chat"
        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted transition hover:bg-surface-hover hover:text-text"
      >
        +
      </button>
    </div>
  )
}
