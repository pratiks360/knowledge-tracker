import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { SearchResultRow } from '@/types/db'

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data: results, isFetching } = useQuery({
    queryKey: ['search', query],
    enabled: query.trim().length > 1,
    queryFn: async (): Promise<SearchResultRow[]> => {
      const { data, error } = await supabase.rpc('search_all', { search_query: query.trim() })
      if (error) throw error
      return data as SearchResultRow[]
    },
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handlePick = (r: SearchResultRow) => {
    navigate(`/node/${r.node_id}`)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search topics & resources…"
        className="w-full rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
      />
      {open && query.trim().length > 1 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-surface-2 shadow-lg">
          {isFetching && <p className="px-3 py-2 text-xs text-muted">Searching…</p>}
          {!isFetching && results?.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted">No results</p>
          )}
          {results?.map((r) => (
            <button
              key={`${r.kind}-${r.id}`}
              onClick={() => handlePick(r)}
              className="block w-full truncate px-3 py-2 text-left text-sm text-text hover:bg-surface-hover"
            >
              <span className="mr-2 rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase text-muted">
                {r.kind}
              </span>
              {r.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
