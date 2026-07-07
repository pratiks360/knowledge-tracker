import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAIConfig } from '@/lib/queries/settings'
import { useUpdateNode } from '@/lib/queries/nodes'
import { useResources } from '@/lib/queries/resources'
import { chatText, AIError } from '@/lib/ai'
import { summarizeNodePrompt, simplifyNodePrompt, examplesNodePrompt } from '@/lib/prompts'
import type { NodeRow, ResourceRow } from '@/types/db'

type Action = 'summarize' | 'simplify' | 'examples'

const PROMPT_BUILDERS: Record<Action, (context: string) => { system: string; user: string }> = {
  summarize: summarizeNodePrompt,
  simplify: simplifyNodePrompt,
  examples: examplesNodePrompt,
}

const LABELS: Record<Action, string> = {
  summarize: 'Summarize',
  simplify: 'Simplify (ELI5)',
  examples: 'Show examples',
}

function buildNodeContext(node: NodeRow, resources: ResourceRow[]): string {
  const parts = [`Topic: ${node.title}`]
  if (node.description) parts.push(`Description: ${node.description}`)
  if (node.notes_md) parts.push(`Notes:\n${node.notes_md}`)
  for (const r of resources) {
    const body = r.summary_md || r.raw_content?.slice(0, 2000)
    if (body) parts.push(`Resource "${r.title ?? r.url ?? 'Untitled'}":\n${body}`)
  }
  return parts.join('\n\n')
}

export function NodeAIActions({ node }: { node: NodeRow }) {
  const aiConfig = useAIConfig()
  const { data: resources } = useResources(node.id)
  const updateNode = useUpdateNode()
  const [active, setActive] = useState<Action | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const configured = !!aiConfig

  const runAction = async (action: Action) => {
    setActive(action)
    setResult(null)
    setError(null)
    if (!aiConfig) return
    setLoading(true)
    try {
      const { system, user } = PROMPT_BUILDERS[action](buildNodeContext(node, resources ?? []))
      const text = await chatText({ ...aiConfig, system, user })
      setResult(text)
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const appendToNotes = () => {
    if (!result) return
    const heading = `\n\n---\n### ${LABELS[active!]}\n\n${result}`
    updateNode.mutate({ id: node.id, patch: { notes_md: (node.notes_md ?? '') + heading } })
    setActive(null)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABELS) as Action[]).map((action) => (
          <button
            key={action}
            onClick={() => runAction(action)}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-surface-hover"
          >
            {LABELS[action]}
          </button>
        ))}
      </div>

      {active && (
        <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
          {!configured && (
            <p className="text-sm text-muted">
              Add an OpenRouter key in{' '}
              <Link to="/settings" className="text-accent hover:underline">
                Settings
              </Link>{' '}
              to use AI actions.
            </p>
          )}
          {configured && loading && <p className="text-sm text-muted">Thinking…</p>}
          {configured && error && <p className="text-sm text-error">{error}</p>}
          {configured && result && (
            <>
              <pre className="whitespace-pre-wrap text-sm text-text">{result}</pre>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={appendToNotes}
                  className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-bg"
                >
                  Append to notes
                </button>
                <button
                  onClick={() => setActive(null)}
                  className="rounded-md border border-border px-3 py-1 text-xs text-muted hover:bg-surface-hover"
                >
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
