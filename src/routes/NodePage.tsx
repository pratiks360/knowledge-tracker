import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useCreateNode,
  useDeleteNode,
  useNodes,
  useTouchLastVisited,
  useUpdateNode,
  computeProgress,
  getAncestors,
} from '@/lib/queries/nodes'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { StatusToggle } from '@/components/StatusToggle'
import { ProgressRing } from '@/components/ProgressRing'
import { NotesPanel } from '@/components/notes/NotesPanel'
import { NodePicker } from '@/components/NodePicker'
import { FullscreenSpinner } from '@/components/FullscreenSpinner'
import { NodeAIActions } from '@/components/NodeAIActions'
import { NodeDetails } from '@/components/NodeDetails'
import { ResourcesList } from '@/components/resources/ResourcesList'
import { NodeVideos } from '@/components/resources/NodeVideos'
import { RelatedPaths } from '@/components/RelatedPaths'
import { ExportSubtreeButton } from '@/components/ExportSubtreeButton'
import { useDismantleJDPrep } from '@/lib/queries/jdPrep'

// React Flow is heavy — only load the roadmap editor when it's opened.
const RoadmapEditor = lazy(() =>
  import('@/components/roadmap/RoadmapEditor').then((m) => ({ default: m.RoadmapEditor }))
)
import { useResources } from '@/lib/queries/resources'
import { ChatPanel } from '@/components/ChatPanel'
import { TagEditor } from '@/components/TagEditor'
import { RoadmapGenerator } from '@/components/roadmap/RoadmapGenerator'
import { RelatedLinksPanel } from '@/components/RelatedLinksPanel'
import { RecapCard } from '@/components/RecapCard'
import { isNodeStale } from '@/lib/staleness'
import { countPendingAppends } from '@/lib/notes'
import { QuizPanel } from '@/components/quiz/QuizPanel'
import { PresentModeControls } from '@/components/PresentModeControls'

type TabKey = 'details' | 'sources' | 'videos' | 'notes' | 'subtopics'

export function NodePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: nodes, isLoading } = useNodes()
  const updateNode = useUpdateNode()
  const deleteNode = useDeleteNode()
  const createNode = useCreateNode()
  const dismantleJDPrep = useDismantleJDPrep()
  const touchVisited = useTouchLastVisited()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editRoadmap, setEditRoadmap] = useState(false)
  const [tab, setTab] = useState<TabKey>('details')
  const { data: resources } = useResources(id)

  const node = nodes?.find((n) => n.id === id)
  const nodeLoaded = !!node
  // Freeze the staleness check at the moment this node first loads — touchVisited (below)
  // updates last_visited_at to "now" shortly after, which would otherwise hide the recap card.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const wasStale = useMemo(() => isNodeStale(node), [id, nodeLoaded])

  useEffect(() => {
    if (id) touchVisited.mutate(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (isLoading) return <FullscreenSpinner label="Loading" />
  if (!node) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted">Topic not found.</p>
      </div>
    )
  }

  const ancestors = getAncestors(nodes!, node.id)
  const progress = computeProgress(nodes!, node.id)
  const children = nodes!.filter((n) => n.parent_id === node.id)

  const handleAddChild = () => {
    const title = window.prompt('New subtopic title')
    if (!title?.trim()) return
    createNode.mutate(
      { title: title.trim(), parent_id: node.id },
      { onSuccess: (created) => navigate(`/node/${created.id}`) }
    )
  }

  const handleDelete = () => {
    const msg =
      children.length > 0
        ? `Delete "${node.title}" and all ${children.length} subtopic(s)?`
        : `Delete "${node.title}"?`
    if (!window.confirm(msg)) return
    deleteNode.mutate(node.id, {
      onSuccess: () =>
        navigate(ancestors.length ? `/node/${ancestors[ancestors.length - 1].id}` : '/'),
    })
  }

  const handleDismantleJDPrep = () => {
    if (
      !window.confirm(
        `Dismantle "${node.title}"? Its subtopics move up to where this prep sits, and the links to matched topics are removed.`
      )
    )
      return
    dismantleJDPrep.mutate(
      { node, allNodes: nodes! },
      {
        onSuccess: () =>
          navigate(ancestors.length ? `/node/${ancestors[ancestors.length - 1].id}` : '/'),
      }
    )
  }

  return (
    <div className="flex h-full min-w-0">
      <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <Breadcrumbs ancestors={ancestors} current={node} />
          <div className="flex shrink-0 gap-2">
            <ExportSubtreeButton node={node} allNodes={nodes!} />
            {node.node_kind === 'jd_prep' && (
              <button
                onClick={handleDismantleJDPrep}
                disabled={dismantleJDPrep.isPending}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
              >
                {dismantleJDPrep.isPending ? 'Dismantling…' : 'Dismantle JD prep'}
              </button>
            )}
            <button
              onClick={() => setPickerOpen(true)}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:bg-surface-hover hover:text-text"
            >
              Move
            </button>
            <button
              onClick={handleDelete}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-error hover:bg-surface-hover"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          <ProgressRing progress={progress} size={48} />
          <h1 className="font-display min-w-0 flex-1 break-words text-xl font-semibold text-text sm:text-2xl">
            {node.title}
          </h1>
          <StatusToggle
            value={node.status}
            onChange={(status) => updateNode.mutate({ id: node.id, patch: { status } })}
          />
        </div>

        {node.description && <p className="mb-3 text-sm text-muted">{node.description}</p>}

        <TagEditor node={node} />

        <RelatedPaths node={node} allNodes={nodes!} />

        {wasStale && <RecapCard node={node} />}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
          {(
            [
              ['details', 'Details'],
              ['sources', 'Sources'],
              ['videos', 'Videos'],
              ['notes', 'Notes'],
              ['subtopics', 'Subtopics'],
            ] as [TabKey, string][]
          ).map(([key, label]) => {
            const count =
              key === 'sources'
                ? resources?.length
                : key === 'videos'
                  ? resources?.filter((r) => r.kind === 'youtube').length
                  : key === 'subtopics'
                    ? children.length
                    : key === 'notes'
                      ? countPendingAppends(node.notes_md)
                      : undefined
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  tab === key
                    ? 'border-accent text-text'
                    : 'border-transparent text-muted hover:text-text'
                }`}
              >
                {label}
                {count ? <span className="ml-1.5 text-xs text-muted">{count}</span> : null}
              </button>
            )
          })}
        </div>

        {tab === 'details' && (
          <>
            <section className="mb-8">
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
                AI actions
              </h2>
              <div className="flex flex-wrap items-start gap-2">
                <NodeAIActions node={node} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <RoadmapGenerator node={node} allNodes={nodes!} />
                <QuizPanel node={node} />
              </div>
            </section>

            <section className="mb-8">
              <NodeDetails node={node} ancestors={ancestors} />
            </section>
          </>
        )}

        {tab === 'sources' && (
          <section className="mb-8">
            <p className="mb-3 text-sm text-muted">
              Paste web pages and YouTube videos here. Then use{' '}
              <span className="text-text">Generate details</span> on the Details tab to merge them
              into one write-up.
            </p>
            <ResourcesList nodeId={node.id} />
          </section>
        )}

        {tab === 'videos' && (
          <section className="mb-8">
            <NodeVideos nodeId={node.id} />
          </section>
        )}

        {tab === 'notes' && (
          <section className="mb-8">
            <NotesPanel node={node} />
          </section>
        )}

        {tab === 'subtopics' && (
          <>
            <section className="mb-8">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Subtopics</h2>
                <div className="flex gap-2">
                  {children.length > 0 && (
                    <button
                      onClick={() => setEditRoadmap(true)}
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-surface-hover hover:text-text"
                    >
                      Edit as roadmap
                    </button>
                  )}
                  <button
                    onClick={handleAddChild}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-surface-hover hover:text-text"
                  >
                    + Add subtopic
                  </button>
                </div>
              </div>
              {children.length === 0 ? (
                <p className="text-sm text-muted">No subtopics yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {children.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => navigate(`/node/${c.id}`)}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-sm text-text hover:bg-surface-hover"
                      >
                        {c.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mb-8">
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
                Related topics
              </h2>
              <RelatedLinksPanel node={node} allNodes={nodes!} />
            </section>

            <section className="mb-8">
              <PresentModeControls node={node} allNodes={nodes!} />
            </section>
          </>
        )}

        {pickerOpen && (
          <NodePicker
            nodes={nodes!}
            excludeId={node.id}
            title={`Move "${node.title}" to…`}
            onClose={() => setPickerOpen(false)}
            onPick={(parentId) => {
              updateNode.mutate({ id: node.id, patch: { parent_id: parentId } })
              setPickerOpen(false)
            }}
          />
        )}

        {editRoadmap && (
          <Suspense fallback={null}>
            <RoadmapEditor
              node={node}
              allNodes={nodes!}
              onClose={() => setEditRoadmap(false)}
              onMerged={() => setEditRoadmap(false)}
            />
          </Suspense>
        )}
        </div>
      </div>

      <ChatPanel node={node} />
    </div>
  )
}
