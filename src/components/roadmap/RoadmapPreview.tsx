import { useMemo, useState } from 'react'
import { ReactFlow, Background, Controls, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { roadmapChat, AIError, type RoadmapChatAdd, type RoadmapProposalNode } from '@/lib/ai'
import { useAIConfig } from '@/lib/queries/settings'
import { flattenProposal, useMergeRoadmap, type FlatProposalNode } from '@/lib/queries/roadmap'
import { layoutRoadmap } from '@/lib/roadmapLayout'
import { RoadmapFlowNode, type RoadmapNodeData } from '@/components/roadmap/RoadmapNode'
import { ChatMessage } from '@/components/ChatMessage'

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)

const nodeTypes = { roadmapNode: RoadmapFlowNode }

export function RoadmapPreview({
  proposal,
  targetNodeId,
  existingTitles,
  onClose,
  onMerged,
}: {
  proposal: RoadmapProposalNode[]
  targetNodeId: string
  /** Lowercased titles already present — pre-unchecked and flagged. */
  existingTitles?: Set<string>
  onClose: () => void
  onMerged: () => void
}) {
  // Held in state (not derived) so the proposal can be edited before it's merged.
  const [flat, setFlat] = useState<FlatProposalNode[]>(() => flattenProposal(proposal))
  const isExisting = (title: string) => !!existingTitles?.has(title.trim().toLowerCase())
  // Default to everything except items that already exist, so a plain "Merge" never duplicates.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(flat.filter((f) => !isExisting(f.title)).map((f) => f.key))
  )
  const mergeRoadmap = useMergeRoadmap(targetNodeId)
  const aiConfig = useAIConfig()

  // Refine-with-chat panel state.
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMsgs, setChatMsgs] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatDraft, setChatDraft] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)

  const serializeProposal = (): string => {
    const byKey = new Map(flat.map((f) => [f.key, f]))
    const depth = (f: FlatProposalNode) => {
      let d = 0
      let cur: FlatProposalNode | undefined = f
      while (cur?.parentKey) {
        d++
        cur = byKey.get(cur.parentKey)
        if (!cur) break
      }
      return d
    }
    return flat
      .map((f) => `${'  '.repeat(depth(f))}- ${f.title}${f.description ? `: ${f.description}` : ''}`)
      .join('\n')
  }

  const addFromChat = (items: RoadmapChatAdd[]) => {
    const keyByTitle = new Map(flat.map((f) => [f.title.toLowerCase(), f.key]))
    const additions: FlatProposalNode[] = items.map((it, idx) => ({
      key: `chat-${flat.length + idx}-${slug(it.title)}`,
      parentKey: it.parentTitle ? (keyByTitle.get(it.parentTitle.toLowerCase()) ?? null) : null,
      title: it.title,
      description: it.description,
      prerequisites: [],
      siblingIndex: 0,
    }))
    setFlat((prev) => [...prev, ...additions])
    setSelected((sel) => {
      const next = new Set(sel)
      additions.forEach((a) => next.add(a.key))
      return next
    })
  }

  const sendChat = async () => {
    const q = chatDraft.trim()
    if (!q || !aiConfig) return
    setChatDraft('')
    setChatError(null)
    setChatMsgs((m) => [...m, { role: 'user', content: q }])
    setChatLoading(true)
    try {
      const res = await roadmapChat(aiConfig, q, serializeProposal())
      if (res.add.length > 0) addFromChat(res.add)
      const note =
        res.add.length > 0 ? `\n\n_Added ${res.add.length} topic(s) to the proposal._` : ''
      setChatMsgs((m) => [
        ...m,
        { role: 'assistant', content: (res.reply || 'Done.') + note },
      ])
    } catch (e) {
      setChatError(e instanceof AIError ? e.message : 'Chat failed. Try again.')
    } finally {
      setChatLoading(false)
    }
  }

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const rename = (key: string, title: string) => {
    setFlat((prev) => prev.map((f) => (f.key === key ? { ...f, title } : f)))
  }

  /** Removes a node and everything beneath it. */
  const remove = (key: string) => {
    const doomed = new Set<string>([key])
    // Walk until the set stops growing so nested descendants are caught regardless
    // of the order `flat` happens to be in.
    let grew = true
    while (grew) {
      grew = false
      for (const f of flat) {
        if (f.parentKey && doomed.has(f.parentKey) && !doomed.has(f.key)) {
          doomed.add(f.key)
          grew = true
        }
      }
    }
    setFlat((prev) => prev.filter((f) => !doomed.has(f.key)))
    setSelected((sel) => new Set([...sel].filter((k) => !doomed.has(k))))
  }

  /**
   * Adds a child under `parentKey` (or a new top-level item when null). Keys follow
   * flattenProposal's `parent-suffix` convention, which the merge relies on to order
   * parents before children.
   */
  const addChild = (parentKey: string | null) => {
    const siblings = flat.filter((f) => f.parentKey === parentKey)
    let key: string
    let i = siblings.length
    do {
      key = `${parentKey ?? 'root'}-new${i++}`
    } while (flat.some((f) => f.key === key))

    const item: FlatProposalNode = {
      key,
      parentKey,
      title: 'New topic',
      prerequisites: [],
      siblingIndex: siblings.length,
    }
    setFlat((prev) => [...prev, item])
    setSelected((sel) => new Set(sel).add(key))
  }

  const { nodes, edges } = useMemo(() => {
    const titleToKey = new Map(flat.map((f) => [f.title.toLowerCase(), f.key]))
    const rfNodes: Node[] = flat.map((f) => ({
      id: f.key,
      type: 'roadmapNode',
      position: { x: 0, y: 0 },
      data: {
        title: f.title,
        description: f.description,
        selected: selected.has(f.key),
        exists: !!existingTitles?.has(f.title.trim().toLowerCase()),
        onToggle: () => toggle(f.key),
        onRename: (title: string) => rename(f.key, title),
        onAddChild: () => addChild(f.key),
        onDelete: () => remove(f.key),
      } satisfies RoadmapNodeData,
    }))

    const rfEdges: Edge[] = []
    flat.forEach((f) => {
      if (f.parentKey) {
        rfEdges.push({ id: `h-${f.parentKey}-${f.key}`, source: f.parentKey, target: f.key })
      }
      f.prerequisites.forEach((p) => {
        const prereqKey = titleToKey.get(p.toLowerCase())
        if (prereqKey && prereqKey !== f.key) {
          rfEdges.push({
            id: `p-${prereqKey}-${f.key}`,
            source: prereqKey,
            target: f.key,
            style: { strokeDasharray: '4 4' },
            label: 'prereq',
          })
        }
      })
    })

    return { nodes: layoutRoadmap(rfNodes, rfEdges), edges: rfEdges }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, selected, existingTitles])

  const selectedCount = selected.size

  const handleMerge = () => {
    mergeRoadmap.mutate({ flat, selectedKeys: selected }, { onSuccess: () => onMerged() })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-2 sm:p-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-bg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold text-text">Roadmap proposal</h2>
            <p className="text-xs text-muted">
              {selectedCount} of {flat.length} selected —{' '}
              <span className="hidden sm:inline">
                double-click a title to rename, hover a card to add a subtopic or remove it.
              </span>
              <span className="sm:hidden">double-tap a title to rename.</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setChatOpen((v) => !v)}
              className={
                'rounded-md border px-2.5 py-1 text-xs transition ' +
                (chatOpen
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text hover:bg-surface-hover')
              }
            >
              Ask / refine
            </button>
            <button
              onClick={() => addChild(null)}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover"
            >
              + Add topic
            </button>
            <button
              onClick={() => setSelected(new Set(flat.map((f) => f.key)))}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover"
            >
              Select all
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover"
            >
              Select none
            </button>
            <button
              onClick={handleMerge}
              disabled={selectedCount === 0 || mergeRoadmap.isPending}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-bg disabled:opacity-50"
            >
              {mergeRoadmap.isPending ? 'Merging…' : `Merge ${selectedCount}`}
            </button>
            <button
              onClick={onClose}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:bg-surface-hover"
            >
              Cancel
            </button>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>

          {chatOpen && (
            <div className="flex w-full max-w-sm shrink-0 flex-col border-l border-border bg-surface">
              <div className="border-b border-border px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Ask about this roadmap
                </p>
                <p className="text-[11px] text-muted">
                  Ask questions, or say “add …” to drop topics into the proposal.
                </p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-3">
                {chatMsgs.length === 0 && !chatLoading && (
                  <p className="text-xs text-muted">
                    e.g. “What am I missing on token security?” or “add OAuth2 and OIDC under SSO
                    Protocols”.
                  </p>
                )}
                {chatMsgs.map((m, i) => (
                  <ChatMessage key={i} role={m.role} content={m.content} />
                ))}
                {chatLoading && <p className="text-xs text-muted">Thinking…</p>}
                {chatError && <p className="text-xs text-error">{chatError}</p>}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendChat()
                }}
                className="border-t border-border p-2"
              >
                <div className="flex gap-2">
                  <input
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    placeholder={aiConfig ? 'Ask or add…' : 'Add an AI key in Settings'}
                    disabled={!aiConfig || chatLoading}
                    className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!aiConfig || !chatDraft.trim() || chatLoading}
                    className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
