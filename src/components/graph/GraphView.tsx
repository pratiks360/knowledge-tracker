import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useNodes } from '@/lib/queries/nodes'
import { useAllNodeLinks } from '@/lib/queries/nodeLinks'
import { layoutRoadmap } from '@/lib/roadmapLayout'
import type { NodeRow, NodeStatus } from '@/types/db'

const DOT_COLOR: Record<NodeStatus, string> = {
  not_started: 'bg-muted',
  learning: 'bg-warning',
  done: 'bg-success',
}

const LINK_COLOR: Record<string, string> = {
  related: '#8b5cf6',
  uses: '#0ea5e9',
  prerequisite: '#f59e0b',
}

type GraphNodeData = { label: string; status: NodeStatus; dimmed: boolean }

function GraphNode({ data }: NodeProps<Node<GraphNodeData>>) {
  return (
    <div
      className={`rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text shadow-sm transition-opacity ${
        data.dimmed ? 'opacity-25' : ''
      }`}
      style={{ width: 200 }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[data.status]}`} />
        <span className="truncate" title={data.label}>
          {data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes = { graphNode: GraphNode }

export function GraphView() {
  const { data: allNodes } = useNodes()
  const { data: nodeLinks } = useAllNodeLinks()
  const navigate = useNavigate()

  const [statusFilter, setStatusFilter] = useState<Set<NodeStatus>>(
    new Set(['not_started', 'learning', 'done'])
  )
  const [tagFilter, setTagFilter] = useState<string>('')
  const [query, setQuery] = useState('')

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const n of allNodes ?? []) n.tags?.forEach((t) => tags.add(t))
    return [...tags].sort()
  }, [allNodes])

  const matches = (n: NodeRow) => {
    if (!statusFilter.has(n.status)) return false
    if (tagFilter && !n.tags?.includes(tagFilter)) return false
    if (query && !n.title.toLowerCase().includes(query.toLowerCase())) return false
    return true
  }

  const { nodes, edges } = useMemo(() => {
    if (!allNodes) return { nodes: [] as Node[], edges: [] as Edge[] }

    const flowNodes: Node[] = allNodes.map((n) => ({
      id: n.id,
      type: 'graphNode',
      position: { x: 0, y: 0 },
      data: { label: n.title, status: n.status, dimmed: !matches(n) } satisfies GraphNodeData,
    }))

    const parentEdges: Edge[] = allNodes
      .filter((n) => n.parent_id)
      .map((n) => ({
        id: `p-${n.id}`,
        source: n.parent_id!,
        target: n.id,
        style: { stroke: 'var(--color-border)' },
      }))

    const linkEdges: Edge[] = (nodeLinks ?? []).map((l) => ({
      id: l.id,
      source: l.from_node,
      target: l.to_node,
      style: { stroke: LINK_COLOR[l.link_type] ?? '#999', strokeDasharray: '4 3' },
      label: l.link_type,
      labelStyle: { fill: 'var(--color-muted)', fontSize: 10 },
    }))

    return { nodes: layoutRoadmap(flowNodes, parentEdges), edges: [...parentEdges, ...linkEdges] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allNodes, nodeLinks, statusFilter, tagFilter, query])

  const toggleStatus = (s: NodeStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by title…"
          className="w-48 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text outline-none focus:border-accent"
        />
        {(['not_started', 'learning', 'done'] as NodeStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
              statusFilter.has(s)
                ? 'border-accent text-text'
                : 'border-border text-muted opacity-50'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${DOT_COLOR[s]}`} />
            {s.replace('_', ' ')}
          </button>
        ))}
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text outline-none focus:border-accent"
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto text-xs text-muted">{allNodes?.length ?? 0} topics</span>
      </div>

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, n) => navigate(`/node/${n.id}`)}
          fitView
          minZoom={0.1}
        >
          <Background />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-surface" />
        </ReactFlow>
      </div>
    </div>
  )
}
