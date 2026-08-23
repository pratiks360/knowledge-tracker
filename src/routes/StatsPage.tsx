import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useNodes, buildTree, computeProgress } from '@/lib/queries/nodes'
import { useAllQuizzes } from '@/lib/queries/quizzes'
import { useNodeIdsWithResources } from '@/lib/queries/resources'
import { isNodeStale } from '@/lib/staleness'
import type { NodeStatus } from '@/types/db'

const STATUS_COLOR: Record<NodeStatus, string> = {
  not_started: 'var(--color-muted)',
  learning: 'var(--color-warning)',
  done: 'var(--color-success)',
}

function StatusDonut({ counts }: { counts: Record<NodeStatus, number> }) {
  const total = counts.not_started + counts.learning + counts.done
  const size = 140
  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const segments = (['done', 'learning', 'not_started'] as NodeStatus[]).map((status) => {
    const value = counts[status]
    const fraction = total > 0 ? value / total : 0
    const dash = fraction * circumference
    const seg = { status, value, dash, offset }
    offset += dash
    return seg
  })

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-surface-hover)" strokeWidth={16} />
        {segments.map((s) => (
          <circle
            key={s.status}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={STATUS_COLOR[s.status]}
            strokeWidth={16}
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={22} fill="var(--color-text)">
          {total}
        </text>
      </svg>
      <div className="flex flex-col gap-1.5 text-sm">
        {(['done', 'learning', 'not_started'] as NodeStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />
            <span className="text-muted">{s.replace('_', ' ')}</span>
            <span className="text-text">{counts[s]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CoverageBars({ items }: { items: { title: string; id: string; progress: number }[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">No root topics yet.</p>
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <Link
          key={item.id}
          to={`/node/${item.id}`}
          className="group flex items-center gap-3 rounded-md px-1 py-0.5 hover:bg-surface-hover"
        >
          <span className="w-32 shrink-0 truncate text-sm text-text" title={item.title}>
            {item.title}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-accent-2 transition-all"
              style={{ width: `${item.progress}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs text-muted">{item.progress}%</span>
        </Link>
      ))}
    </div>
  )
}

function QuizSparkline({ scores }: { scores: number[] }) {
  if (scores.length === 0) return <p className="text-sm text-muted">No quizzes taken yet.</p>
  const w = 280
  const h = 60
  const max = 100
  const step = scores.length > 1 ? w / (scores.length - 1) : 0
  const points = scores.map((s, i) => `${i * step},${h - (s / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke="var(--color-accent-2)" strokeWidth={2} />
      {scores.map((s, i) => (
        <circle key={i} cx={i * step} cy={h - (s / max) * h} r={2.5} fill="var(--color-accent-2)" />
      ))}
    </svg>
  )
}

function StreakCalendar({ dates }: { dates: Set<string> }) {
  const days = useMemo(() => {
    const list: { date: string; active: boolean }[] = []
    const d = new Date()
    for (let i = 27; i >= 0; i--) {
      const day = new Date(d)
      day.setDate(d.getDate() - i)
      const key = day.toISOString().slice(0, 10)
      list.push({ date: key, active: dates.has(key) })
    }
    return list
  }, [dates])

  return (
    <div className="grid grid-cols-[repeat(14,1fr)] gap-1 sm:grid-cols-[repeat(28,1fr)]">
      {days.map((day) => (
        <div
          key={day.date}
          title={day.date}
          className={`h-3.5 w-3.5 rounded-sm ${day.active ? 'bg-accent-2' : 'bg-surface-hover'}`}
        />
      ))}
    </div>
  )
}

export function StatsPage() {
  const { data: nodes } = useNodes()
  const { data: quizzes } = useAllQuizzes()
  const { data: resourceIds } = useNodeIdsWithResources()

  const statusCounts = useMemo(() => {
    const counts: Record<NodeStatus, number> = { not_started: 0, learning: 0, done: 0 }
    for (const n of nodes ?? []) counts[n.status]++
    return counts
  }, [nodes])

  const roots = useMemo(() => {
    if (!nodes) return []
    return buildTree(nodes).map((r) => ({
      id: r.id,
      title: r.title,
      progress: computeProgress(nodes, r.id),
    }))
  }, [nodes])

  const reviewDue = useMemo(
    () => (nodes ?? []).filter((n) => n.status !== 'done' && isNodeStale(n)).length,
    [nodes]
  )

  const contentCoverage = useMemo(() => {
    if (!nodes || nodes.length === 0) return 0
    const withContent = nodes.filter(
      (n) => !!n.details_md?.trim() || !!n.notes_md?.trim() || resourceIds?.has(n.id)
    ).length
    return Math.round((withContent / nodes.length) * 100)
  }, [nodes, resourceIds])

  const quizScores = useMemo(
    () =>
      (quizzes ?? [])
        .filter((q) => q.taken_at != null && q.last_score != null)
        .sort((a, b) => new Date(a.taken_at!).getTime() - new Date(b.taken_at!).getTime())
        .slice(-15)
        .map((q) => q.last_score!),
    [quizzes]
  )

  const visitedDates = useMemo(() => {
    const set = new Set<string>()
    for (const n of nodes ?? []) {
      if (n.last_visited_at) set.add(new Date(n.last_visited_at).toISOString().slice(0, 10))
    }
    return set
  }, [nodes])

  const streak = useMemo(() => {
    let count = 0
    const d = new Date()
    while (true) {
      const key = d.toISOString().slice(0, 10)
      if (!visitedDates.has(key)) break
      count++
      d.setDate(d.getDate() - 1)
    }
    return count
  }, [visitedDates])

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <h1 className="font-display mb-6 text-xl font-semibold text-text sm:text-2xl">Progress</h1>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-xs text-muted">Total topics</p>
          <p className="text-xl font-semibold text-text">{nodes?.length ?? 0}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-xs text-muted">Current streak</p>
          <p className="text-xl font-semibold text-text">{streak}d</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-xs text-muted">Due for review</p>
          <p className="text-xl font-semibold text-text">{reviewDue}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-xs text-muted">Content coverage</p>
          <p className="text-xl font-semibold text-text">{contentCoverage}%</p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Status breakdown
        </h2>
        <StatusDonut counts={statusCounts} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Coverage by root topic
        </h2>
        <CoverageBars items={roots} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Quiz score trend
        </h2>
        <QuizSparkline scores={quizScores} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Last 28 days
        </h2>
        <StreakCalendar dates={visitedDates} />
        <p className="mt-2 text-xs text-muted">
          Based on last-visited timestamps — a day lights up if any topic was opened that day.
        </p>
      </section>
    </div>
  )
}
