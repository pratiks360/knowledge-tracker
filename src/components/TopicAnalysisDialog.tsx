import { useEffect, useMemo, useState } from 'react'
import { useNodes, useCreateNode, serializeTreeForAI, getAncestors } from '@/lib/queries/nodes'
import { useAIConfig } from '@/lib/queries/settings'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { analyzeTopics, AIError, type TopicAnalysis } from '@/lib/ai'
import { NodePicker } from '@/components/NodePicker'
import type { NodeRow } from '@/types/db'

type PerTopic = {
  parentOverride?: string | null // undefined = use suggestion
  checked: Set<string> // sibling titles selected
  crossLink: boolean
}

export function TopicAnalysisDialog({
  rawInput,
  onClose,
  onCreated,
  onBuildRoadmap,
}: {
  rawInput: string
  onClose: () => void
  onCreated: (nodeId: string) => void
  /** Seed the roadmap builder with a domain title + sibling outline. */
  onBuildRoadmap: (input: { title: string; outline: string }) => void
}) {
  const { data: nodes } = useNodes()
  const aiConfig = useAIConfig()
  const { user } = useAuth()
  const createNode = useCreateNode()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [topics, setTopics] = useState<TopicAnalysis[]>([])
  const [state, setState] = useState<Record<number, PerTopic>>({})
  const [pickerFor, setPickerFor] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const byId = useMemo(() => new Map((nodes ?? []).map((n) => [n.id, n])), [nodes])

  useEffect(() => {
    let active = true
    async function run() {
      if (!aiConfig || !nodes) {
        setLoading(false)
        return
      }
      try {
        const result = await analyzeTopics(aiConfig, rawInput, serializeTreeForAI(nodes))
        if (!active) return
        setTopics(result)
        const init: Record<number, PerTopic> = {}
        result.forEach((t, i) => {
          init[i] = { checked: new Set(t.siblings.map((s) => s.title)), crossLink: true }
        })
        setState(init)
      } catch (e) {
        if (active) setError(e instanceof AIError ? e.message : 'Could not analyze that topic.')
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pathOf = (n: NodeRow) =>
    [...getAncestors(nodes ?? [], n.id).map((a) => a.title), n.title].join(' → ')

  // Where a topic will be filed, as a readable label.
  const targetLabel = (t: TopicAnalysis, s: PerTopic): string => {
    const override = s.parentOverride
    if (override === null) return 'Root topic'
    const pid = override ?? t.parent_id
    if (pid && byId.has(pid)) return `Under ${byId.get(pid)!.title}`
    if (t.parent_new) return `New group “${t.parent_new}”`
    return 'Root topic'
  }

  const resolveParentId = async (t: TopicAnalysis, s: PerTopic): Promise<string | null> => {
    if (s.parentOverride !== undefined) return s.parentOverride
    if (t.parent_id && byId.has(t.parent_id)) return t.parent_id
    if (t.parent_new) {
      // Reuse an existing group with that name if present, else create it as a root.
      const existing = (nodes ?? []).find(
        (n) => !n.parent_id && n.title.toLowerCase() === t.parent_new!.toLowerCase()
      )
      if (existing) return existing.id
      const created = await createNode.mutateAsync({ title: t.parent_new })
      return created.id
    }
    return null
  }

  const handleCreate = async () => {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      let firstId: string | null = null
      for (let i = 0; i < topics.length; i++) {
        const t = topics[i]
        const s = state[i]
        const parentId = await resolveParentId(t, s)

        const topicNode = await createNode.mutateAsync({ title: t.title, parent_id: parentId })
        if (!firstId) firstId = topicNode.id

        // Selected siblings under the same parent.
        const chosen = t.siblings.filter((sib) => s.checked.has(sib.title))
        for (const sib of chosen) {
          await createNode.mutateAsync({
            title: sib.title,
            parent_id: parentId,
            description: sib.reason,
          })
        }

        // Cross-link the new topic to existing same/related concepts.
        if (s.crossLink && t.related_existing_ids.length > 0) {
          const rows = t.related_existing_ids
            .filter((id) => byId.has(id))
            .map((id) => ({
              user_id: user.id,
              from_node: topicNode.id,
              to_node: id,
              link_type: 'related' as const,
            }))
          if (rows.length > 0) await supabase.from('node_links').insert(rows)
        }
      }
      if (firstId) onCreated(firstId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create topics.')
      setSaving(false)
    }
  }

  const toggleSibling = (i: number, title: string) =>
    setState((prev) => {
      const next = new Set(prev[i].checked)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return { ...prev, [i]: { ...prev[i], checked: next } }
    })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text">Plan this topic</h2>
          <p className="text-xs text-muted">Suggested placement and related topics to learn alongside.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && <p className="text-sm text-muted">Analyzing…</p>}
          {error && <p className="mb-2 text-sm text-error">{error}</p>}
          {!loading && !error && topics.length === 0 && (
            <p className="text-sm text-muted">Nothing to add.</p>
          )}

          {topics.map((t, i) => {
            const s = state[i]
            if (!s) return null
            const related = t.related_existing_ids.map((id) => byId.get(id)).filter(Boolean) as NodeRow[]
            return (
              <div key={i} className="mb-4 rounded-lg border border-border bg-surface-2 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-medium text-text">{t.title}</span>
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                    {t.domain}
                  </span>
                </div>

                <button
                  onClick={() => setPickerFor(i)}
                  className="mb-2 text-xs text-muted underline-offset-2 hover:text-text hover:underline"
                >
                  {targetLabel(t, s)} — change
                </button>

                {t.coverage === 'part_of_larger' && t.siblings.length > 0 && (
                  <>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                      Learn alongside
                    </p>
                    <div className="mb-2 flex flex-col gap-1">
                      {t.siblings.map((sib) => (
                        <label key={sib.title} className="flex items-start gap-2 text-sm text-text">
                          <input
                            type="checkbox"
                            checked={s.checked.has(sib.title)}
                            onChange={() => toggleSibling(i, sib.title)}
                            className="mt-0.5"
                          />
                          <span>
                            {sib.title}
                            {sib.reason && <span className="text-muted"> — {sib.reason}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                {t.prerequisites.length > 0 && (
                  <p className="mb-2 text-xs text-muted">
                    Prerequisites: {t.prerequisites.join(', ')}
                  </p>
                )}

                {related.length > 0 && (
                  <label className="flex items-start gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={s.crossLink}
                      onChange={() =>
                        setState((prev) => ({ ...prev, [i]: { ...prev[i], crossLink: !prev[i].crossLink } }))
                      }
                      className="mt-0.5"
                    />
                    <span>
                      Also exists as {related.map(pathOf).join('; ')} — cross-link them
                    </span>
                  </label>
                )}

                {t.coverage === 'part_of_larger' && (
                  <button
                    onClick={() =>
                      onBuildRoadmap({
                        title: t.domain,
                        outline: [t.title, ...t.siblings.map((sib) => sib.title)].join('\n'),
                      })
                    }
                    className="mt-2 text-xs font-medium text-accent hover:underline"
                  >
                    Build a full roadmap on {t.domain} instead →
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || saving || topics.length === 0}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-bg hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add to graph'}
          </button>
        </div>

        {pickerFor !== null && nodes && (
          <NodePicker
            nodes={nodes}
            title="File under…"
            onClose={() => setPickerFor(null)}
            onPick={(parentId) => {
              setState((prev) => ({ ...prev, [pickerFor]: { ...prev[pickerFor], parentOverride: parentId } }))
              setPickerFor(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
