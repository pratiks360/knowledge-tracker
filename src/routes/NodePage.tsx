import { useEffect, useMemo, useState } from 'react'
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
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { NodePicker } from '@/components/NodePicker'
import { FullscreenSpinner } from '@/components/FullscreenSpinner'
import { NodeAIActions } from '@/components/NodeAIActions'
import { NodeDetails } from '@/components/NodeDetails'
import { ResourcesList } from '@/components/resources/ResourcesList'
import { ChatPanel } from '@/components/ChatPanel'
import { RoadmapGenerator } from '@/components/roadmap/RoadmapGenerator'
import { RelatedLinksPanel } from '@/components/RelatedLinksPanel'
import { RecapCard } from '@/components/RecapCard'
import { isNodeStale } from '@/lib/staleness'
import { QuizPanel } from '@/components/quiz/QuizPanel'
import { PresentModeControls } from '@/components/PresentModeControls'

export function NodePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: nodes, isLoading } = useNodes()
  const updateNode = useUpdateNode()
  const deleteNode = useDeleteNode()
  const createNode = useCreateNode()
  const touchVisited = useTouchLastVisited()
  const [pickerOpen, setPickerOpen] = useState(false)

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

  return (
    <div className="flex h-full">
      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <Breadcrumbs ancestors={ancestors} current={node} />
          <div className="flex shrink-0 gap-2">
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

        <div className="mb-6 flex items-center gap-4">
          <ProgressRing progress={progress} size={48} />
          <h1 className="font-display flex-1 text-2xl font-semibold text-text">{node.title}</h1>
          <StatusToggle
            value={node.status}
            onChange={(status) => updateNode.mutate({ id: node.id, patch: { status } })}
          />
        </div>

        {node.description && <p className="mb-6 text-sm text-muted">{node.description}</p>}

        {wasStale && <RecapCard node={node} />}

        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
            AI actions
          </h2>
          <div className="flex flex-wrap items-start gap-2">
            <NodeAIActions node={node} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <RoadmapGenerator node={node} />
            <QuizPanel node={node} />
          </div>
        </section>

        <section className="mb-8">
          <NodeDetails node={node} />
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">Resources</h2>
          <ResourcesList nodeId={node.id} />
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">Notes</h2>
          <MarkdownEditor
            value={node.notes_md ?? ''}
            placeholder="Write freeform notes in Markdown…"
            onSave={(notes_md) => updateNode.mutate({ id: node.id, patch: { notes_md } })}
          />
        </section>

        <section className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Subtopics</h2>
            <button
              onClick={handleAddChild}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-surface-hover hover:text-text"
            >
              + Add subtopic
            </button>
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
      </div>

      <ChatPanel node={node} />
    </div>
  )
}
