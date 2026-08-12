import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useNodes, computeProgress } from '@/lib/queries/nodes'
import { ProgressRing } from '@/components/ProgressRing'
import { TopicAnalysisDialog } from '@/components/TopicAnalysisDialog'
import { RoadmapQuickAdd } from '@/components/roadmap/RoadmapQuickAdd'
import { RoadmapFromChat } from '@/components/roadmap/RoadmapFromChat'
import { DashboardChat } from '@/components/DashboardChat'
import type { ChatMessageRow } from '@/types/db'

const REVIEW_DUE_DAYS = 14

export function DashboardPage() {
  const { data: nodes, isLoading } = useNodes()
  const navigate = useNavigate()
  // The coach owns which conversation is open; the roadmap builder needs whatever
  // is currently on screen, so the active thread's messages come back up to here.
  const [chatMessages, setChatMessages] = useState<ChatMessageRow[]>([])
  const handleActiveMessages = useCallback((m: ChatMessageRow[]) => setChatMessages(m), [])
  // Roadmap built from a pasted outline…
  const [roadmapInput, setRoadmapInput] = useState<{
    title: string
    sourceOutline?: string
    webSearch?: boolean
  } | null>(null)
  // …or from the coach conversation.
  const [chatRoadmap, setChatRoadmap] = useState<{ webSearch: boolean } | null>(null)
  // Single topic via "add topic: X" in the coach.
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

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <DashboardChat
        allNodes={nodes ?? []}
        onBuildRoadmap={(webSearch) => setChatRoadmap({ webSearch })}
        onImportOutline={setRoadmapInput}
        onAddTopic={setPlacementTitle}
        onActiveMessages={handleActiveMessages}
      />

      {placementTitle && (
        <TopicAnalysisDialog
          rawInput={placementTitle}
          onClose={() => setPlacementTitle(null)}
          onCreated={(nodeId) => {
            setPlacementTitle(null)
            navigate(`/node/${nodeId}`)
          }}
          onBuildRoadmap={({ title, outline }) => {
            setPlacementTitle(null)
            setRoadmapInput({ title, sourceOutline: outline })
          }}
        />
      )}

      {chatRoadmap && (
        <RoadmapFromChat
          messages={chatMessages}
          webSearch={chatRoadmap.webSearch}
          onClose={() => setChatRoadmap(null)}
          onDone={(nodeId) => {
            setChatRoadmap(null)
            navigate(`/node/${nodeId}`)
          }}
        />
      )}

      {roadmapInput && (
        <RoadmapQuickAdd
          title={roadmapInput.title}
          sourceOutline={roadmapInput.sourceOutline}
          webSearch={roadmapInput.webSearch}
          onClose={() => setRoadmapInput(null)}
          onDone={(nodeId) => {
            setRoadmapInput(null)
            navigate(`/node/${nodeId}`)
          }}
        />
      )}

      {reviewDue.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Review due
          </h2>
          <div className="flex flex-wrap gap-2">
            {reviewDue.map((n) => (
              <Link
                key={n.id}
                to={`/node/${n.id}`}
                className="rounded-md border border-warning/30 bg-warning/10 px-3 py-1.5 text-sm text-text transition hover:bg-warning/20"
              >
                {n.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      {continueLearning.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Continue learning
          </h2>
          <div className="flex flex-wrap gap-2">
            {continueLearning.map((n) => (
              <Link
                key={n.id}
                to={`/node/${n.id}`}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text transition hover:bg-surface-hover"
              >
                {n.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Topics</h2>
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {!isLoading && roots.length === 0 && (
          <p className="text-sm text-muted">
            No topics yet — tell the coach what you want to learn, and build a roadmap from there.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((n) => {
            const progress = nodes ? computeProgress(nodes, n.id) : 0
            return (
              <Link
                key={n.id}
                to={`/node/${n.id}`}
                className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 transition hover:border-accent/40 hover:bg-surface-hover"
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
