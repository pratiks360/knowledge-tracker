import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { NodeRow } from '@/types/db'
import { useChatMessages, useSendChatMessage } from '@/lib/queries/chat'
import { useNodes } from '@/lib/queries/nodes'
import { useResources } from '@/lib/queries/resources'
import { useAIConfig } from '@/lib/queries/settings'
import { useAddManualResource } from '@/lib/queries/resources'
import { useUIStore } from '@/lib/store'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { ChatMessage } from '@/components/ChatMessage'
import { ResizeHandle } from '@/components/ResizeHandle'

export function ChatPanel({ node }: { node: NodeRow }) {
  const { chatPanelOpen, toggleChatPanel, chatWidth, setChatWidth } = useUIStore()
  const isDesktop = useIsDesktop()
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
    <>
      {/* Desktop-only drag handle on the panel's left edge. */}
      {isDesktop && (
        <ResizeHandle
          side="left"
          ariaLabel="Resize chat panel"
          getWidth={() => chatWidth}
          onResize={setChatWidth}
        />
      )}
    {/* Full-screen sheet on mobile — a 320px docked column would leave the topic
        itself unreadable. Docks as a column from md up. */}
    <div
      className="fixed inset-0 z-40 flex flex-col bg-bg md:static md:z-auto md:shrink-0 md:border-l md:border-border md:bg-transparent"
      style={isDesktop ? { width: chatWidth } : undefined}
    >
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
            <ChatMessage key={m.id} role={m.role} content={m.content}>
              {m.role === 'assistant' && (
                <button
                  onClick={() => saveAsResource(m.content)}
                  className="mt-1 text-xs text-muted hover:text-text"
                >
                  Save as resource
                </button>
              )}
            </ChatMessage>
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
    </>
  )
}
