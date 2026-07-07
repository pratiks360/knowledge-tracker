import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { NodeRow } from '@/types/db'
import { useChatMessages, useSendChatMessage } from '@/lib/queries/chat'
import { useNodes } from '@/lib/queries/nodes'
import { useResources } from '@/lib/queries/resources'
import { useAIConfig } from '@/lib/queries/settings'
import { useAddManualResource } from '@/lib/queries/resources'
import { useUIStore } from '@/lib/store'

export function ChatPanel({ node }: { node: NodeRow }) {
  const { chatPanelOpen, toggleChatPanel } = useUIStore()
  const { data: messages } = useChatMessages(node.id)
  const { data: allNodes } = useNodes()
  const { data: resources } = useResources(node.id)
  const aiConfig = useAIConfig()
  const addManualResource = useAddManualResource(node.id)

  const [draft, setDraft] = useState('')
  const [webSearch, setWebSearch] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useSendChatMessage(node, allNodes ?? [], resources ?? [])
  const configured = !!aiConfig
  const webSearchAvailable = aiConfig?.provider === 'openrouter'

  if (!chatPanelOpen) {
    return (
      <button
        onClick={toggleChatPanel}
        className="fixed bottom-4 right-4 rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg shadow-lg"
      >
        Chat
      </button>
    )
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content || !aiConfig) return
    setError(null)
    setDraft('')
    sendMessage.mutate(
      { content, config: aiConfig, webSearch },
      { onError: (e) => setError(e instanceof Error ? e.message : 'Failed to get a reply.') }
    )
  }

  const saveAsResource = (content: string) => {
    addManualResource.mutate({ title: `Chat answer — ${new Date().toLocaleDateString()}`, content })
  }

  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Chat</span>
        <button
          onClick={toggleChatPanel}
          className="rounded px-1 text-xs text-muted hover:bg-surface-hover hover:text-text"
        >
          Hide
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!configured && (
          <p className="text-sm text-muted">
            Add an OpenRouter key in{' '}
            <Link to="/settings" className="text-accent hover:underline">
              Settings
            </Link>{' '}
            to chat about this topic.
          </p>
        )}
        {configured && (!messages || messages.length === 0) && (
          <p className="text-sm text-muted">Ask anything about &quot;{node.title}&quot;.</p>
        )}
        <div className="flex flex-col gap-3">
          {messages?.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'text-right' : ''}>
              <div
                className={`inline-block max-w-full rounded-lg px-3 py-2 text-left text-sm ${
                  m.role === 'user' ? 'bg-accent text-bg' : 'bg-surface-2 text-text'
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
              </div>
              {m.role === 'assistant' && (
                <div>
                  <button
                    onClick={() => saveAsResource(m.content)}
                    className="mt-1 text-xs text-muted hover:text-text"
                  >
                    Save as resource
                  </button>
                </div>
              )}
            </div>
          ))}
          {sendMessage.isPending && <p className="text-sm text-muted">Thinking…</p>}
        </div>
      </div>

      {error && <p className="px-3 text-xs text-error">{error}</p>}

      <form onSubmit={handleSend} className="border-t border-border p-3">
        {webSearchAvailable && (
          <label className="mb-2 flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={webSearch}
              onChange={(e) => setWebSearch(e.target.checked)}
            />
            Web search
          </label>
        )}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question…"
            disabled={!configured}
            className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!configured || !draft.trim() || sendMessage.isPending}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
