import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useNodes, computeProgress } from '@/lib/queries/nodes'
import { ProgressRing } from '@/components/ProgressRing'
import { AutoPlacementDialog } from '@/components/AutoPlacementDialog'

const REVIEW_DUE_DAYS = 14

export function DashboardPage() {
  const { data: nodes, isLoading } = useNodes()
  const navigate = useNavigate()
  const [quickAdd, setQuickAdd] = useState('')
  const [placementTitle, setPlacementTitle] = useState<string | null>(null)

  const roots = useMemo(() => (nodes ?? []).filter((n) => !n.parent_id), [nodes])

  const continueLearning = useMemo(() => {
    return (nodes ?? [])
      .filter((n) => n.last_visited_at)
      .sort((a, b) => (b.last_visited_at! > a.last_visited_at! ? 1 : -1))
      .slice(0, 6)
  }, [nodes])

  const reviewDue = useMemo(() => {
    const cutoff = Date.now() - REVIEW_DUE_DAYS * 24 * 60 * 60 * 1000
    return (nodes ?? [])
      .filter(
        (n) =>
          (n.status === 'done' || n.status === 'learning') &&
          n.last_visited_at &&
          new Date(n.last_visited_at).getTime() < cutoff
      )
      .slice(0, 6)
  }, [nodes])

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const title = quickAdd.trim()
    if (!title) return
    setPlacementTitle(title)
    setQuickAdd('')
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <form onSubmit={handleQuickAdd} className="mb-8 flex gap-2">
        <input
          value={quickAdd}
          onChange={(e) => setQuickAdd(e.target.value)}
          placeholder="Quick-add a topic… (e.g. Distributed Systems)"
          className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!quickAdd.trim()}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {placementTitle && (
        <AutoPlacementDialog
          title={placementTitle}
          onClose={() => setPlacementTitle(null)}
          onCreated={(nodeId) => {
            setPlacementTitle(null)
            navigate(`/node/${nodeId}`)
          }}
        />
      )}

      {reviewDue.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
            Review due
          </h2>
          <div className="flex flex-wrap gap-2">
            {reviewDue.map((n) => (
              <Link
                key={n.id}
                to={`/node/${n.id}`}
                className="rounded-md border border-warning/30 bg-warning/10 px-3 py-1.5 text-sm text-text hover:bg-warning/20"
              >
                {n.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      {continueLearning.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
            Continue learning
          </h2>
          <div className="flex flex-wrap gap-2">
            {continueLearning.map((n) => (
              <Link
                key={n.id}
                to={`/node/${n.id}`}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text hover:bg-surface-hover"
              >
                {n.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Topics</h2>
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {!isLoading && roots.length === 0 && (
          <p className="text-sm text-muted">
            No topics yet. Use the box above to add your first one.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((n) => {
            const progress = nodes ? computeProgress(nodes, n.id) : 0
            return (
              <Link
                key={n.id}
                to={`/node/${n.id}`}
                className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 transition hover:bg-surface-hover"
              >
                <ProgressRing progress={progress} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-text">{n.title}</p>
                  {n.description && <p className="truncate text-xs text-muted">{n.description}</p>}
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
