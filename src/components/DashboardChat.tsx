import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ChatMessageRow, NodeRow } from '@/types/db'
import {
  useChatThreads,
  useCreateThread,
  useDeleteThread,
  useGlobalChatMessages,
  useSendGlobalChatMessage,
} from '@/lib/queries/chat'
import { useAIConfig } from '@/lib/queries/settings'
import { ChatMessage } from '@/components/ChatMessage'
import { ChatTabs } from '@/components/ChatTabs'

/**
 * Phrase-detection for "…create the roadmap". Deliberately conservative: the button
 * is always there, so a miss costs a click, while a false positive would yank the
 * user into a modal they didn't ask for.
 */
const ROADMAP_INTENT = /\b(create|build|make|generate)\b[^.?!]{0,40}\broadmaps?\b/i
const NEGATION = /\b(don'?t|do not|no need|not yet|never|later|hold off|before|without|instead of)\b/i

function wantsRoadmap(text: string): boolean {
  return ROADMAP_INTENT.test(text) && !NEGATION.test(text)
}

/**
 * The fast single-topic path, now that the quick-add box is gone. Deliberately an
 * explicit command rather than loose intent detection — "add some detail about
 * streams" is a question for the coach, "add topic: Streams in Java" is not.
 */
const ADD_TOPIC = /^add (?:a )?(?:new )?topic:?\s+(.+)$/i

function addTopicTitle(text: string): string | null {
  const match = ADD_TOPIC.exec(text.trim())
  return match ? match[1].trim().replace(/^["']|["']$/g, '').slice(0, 120) : null
}

// A short, question-free phrase typed alone reads as a topic name ("SSO",
// "Kafka RBAC") rather than a question — offer to plan it. Conservative: the
// coach is still one click away, so a miss costs nothing.
const QUESTION_LEAD =
  /^(how|what|why|should|shall|can|could|when|where|which|who|is|are|am|do|does|did|will|would|help|tell|give|explain|list|show|compare|teach|plan)\b/i

function looksLikeBareTopic(text: string): boolean {
  const t = text.trim()
  if (!t || t.includes('\n') || t.endsWith('?')) return false
  if (addTopicTitle(t)) return false // explicit "add topic:" handled elsewhere
  if (QUESTION_LEAD.test(t)) return false
  return t.split(/\s+/).length <= 5 && t.length <= 48
}

/** Strips a leading markdown marker so an outline's first line can seed a topic title. */
function cleanTitle(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*+]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^\[[ xX]\]\s*/, '')
    .trim()
    .slice(0, 80)
}

export function DashboardChat({
  allNodes,
  onBuildRoadmap,
  onImportOutline,
  onAddTopic,
  onActiveMessages,
}: {
  allNodes: NodeRow[]
  /** Opens the roadmap builder over the current conversation. */
  onBuildRoadmap: (webSearch: boolean) => void
  /** Turns a pasted outline straight into a roadmap, bypassing the conversation. */
  onImportOutline: (input: { title: string; sourceOutline: string; webSearch: boolean }) => void
  /** Fast single-topic add via "add topic: X", with AI placement. */
  onAddTopic: (title: string) => void
  /** Lifts the visible conversation up so the roadmap builder reads the right tab. */
  onActiveMessages: (messages: ChatMessageRow[]) => void
}) {
  const aiConfig = useAIConfig()
  const { data: threads } = useChatThreads()
  const createThread = useCreateThread()
  const deleteThread = useDeleteThread()

  const [activeId, setActiveId] = useState<string | undefined>()
  // A pending new chat has no row yet — threads are created on first send so the
  // strip never fills up with empty "New chat" tabs.
  const [startingNew, setStartingNew] = useState(false)

  const { data: messages } = useGlobalChatMessages(activeId)
  const sendMessage = useSendGlobalChatMessage(allNodes)

  const [draft, setDraft] = useState('')
  const [webSearch, setWebSearch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const configured = !!aiConfig
  const webSearchAvailable = aiConfig?.provider === 'openrouter'
  const hasMessages = !!messages && messages.length > 0

  // Fall back to the most recent conversation on load, and after the active tab
  // is closed. Skipped while a new chat is pending, or it would snap back.
  useEffect(() => {
    if (!threads || startingNew) return
    if (activeId && threads.some((t) => t.id === activeId)) return
    setActiveId(threads[0]?.id)
  }, [threads, activeId, startingNew])

  useEffect(() => {
    onActiveMessages(messages ?? [])
  }, [messages, onActiveMessages])

  // A multi-line paste is almost certainly an outline (roadmap.sh export, a syllabus),
  // not a question — offer to import it rather than sending it to the coach as chat.
  const outlineLines = useMemo(
    () => draft.split('\n').map((l) => l.trim()).filter(Boolean),
    [draft]
  )
  const isOutline = outlineLines.length > 1

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, sendMessage.isPending])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content || !aiConfig) return
    setError(null)

    // "add topic: X" is a command, not something to discuss — route it and don't
    // burn an AI call replying to it.
    const topic = addTopicTitle(content)
    if (topic) {
      setDraft('')
      onAddTopic(topic)
      return
    }

    setDraft('')

    let threadId = activeId
    if (!threadId) {
      try {
        const created = await createThread.mutateAsync()
        threadId = created.id
        setActiveId(created.id)
        setStartingNew(false)
      } catch {
        setError('Could not start a new conversation.')
        return
      }
    }

    // Detected intent still sends the message, so the conversation reads normally
    // and the builder has the user's final instructions in the transcript.
    const alsoBuild = wantsRoadmap(content)
    sendMessage.mutate(
      { threadId, content, config: aiConfig, webSearch },
      {
        onSuccess: () => {
          if (alsoBuild) onBuildRoadmap(webSearch)
        },
        onError: (err) => setError(err instanceof Error ? err.message : 'Failed to get a reply.'),
      }
    )
  }

  const handleNewChat = () => {
    setStartingNew(true)
    setActiveId(undefined)
    setError(null)
  }

  const handleSelectThread = (id: string) => {
    setStartingNew(false)
    setActiveId(id)
    setError(null)
  }

  const handleDeleteThread = (id: string) => {
    const thread = threads?.find((t) => t.id === id)
    if (!window.confirm(`Delete "${thread?.title ?? 'this chat'}" and all its messages? This cannot be undone.`)) {
      return
    }
    deleteThread.mutate(id)
  }

  const handleImport = () => {
    const raw = draft.trim()
    if (!raw) return
    onImportOutline({
      title: cleanTitle(outlineLines[0]) || 'Imported roadmap',
      sourceOutline: raw,
      webSearch: webSearch && !!webSearchAvailable,
    })
    setDraft('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter newlines. An outline keeps its newlines either way.
    if (e.key === 'Enter' && !e.shiftKey && !isOutline) {
      e.preventDefault()
      handleSend(e)
    }
  }

  return (
    <section className="mb-8 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold text-text">Coach</h2>
          <p className="text-xs text-muted">
            Ask about a topic, your progress, or talk through what to learn next — then turn it into a
            roadmap.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => onBuildRoadmap(webSearch)}
            disabled={!hasMessages || !configured}
            title={
              hasMessages
                ? 'Turn this conversation into a reviewable roadmap'
                : 'Talk through what you want to learn first'
            }
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:opacity-90 disabled:opacity-40"
          >
            Build roadmap
          </button>
        </div>
      </div>

      <ChatTabs
        threads={threads ?? []}
        activeId={activeId}
        onSelect={handleSelectThread}
        onNew={handleNewChat}
        onDelete={handleDeleteThread}
      />


      <div ref={scrollRef} className="max-h-[26rem] min-h-[9rem] overflow-y-auto px-4 py-4">
        {!configured && (
          <p className="text-sm text-muted">
            Add an AI key in{' '}
            <Link to="/settings" className="text-accent hover:underline">
              Settings
            </Link>{' '}
            to chat with your coach.
          </p>
        )}
        {configured && !hasMessages && (
          <div className="text-sm text-muted">
            <p className="mb-1">
              Tell me what you want to learn and we&apos;ll plan it together — then hit{' '}
              <span className="text-text">Build roadmap</span>.
            </p>
            <p className="mb-3 text-xs">
              Paste a roadmap (e.g. from roadmap.sh) to import it, or type{' '}
              <span className="text-text">add topic: Streams in Java</span> to file a single topic
              straight away.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'How am I doing overall?',
                'What should I pick up next?',
                'I want to learn Kubernetes in 3 months — help me plan it',
                'What have I been neglecting?',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setDraft(s)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted transition hover:border-accent hover:text-text"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {messages?.map((m) => (
            <ChatMessage key={m.id} role={m.role} content={m.content} />
          ))}
          {sendMessage.isPending && <p className="text-sm text-muted">Thinking…</p>}
        </div>
      </div>

      {error && <p className="px-4 pb-1 text-xs text-error">{error}</p>}

      <form onSubmit={handleSend} className="border-t border-border p-3">
        {isOutline && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-text">
            <span className="flex-1">
              That looks like an outline ({outlineLines.length} lines). Import it as a roadmap?
            </span>
            <button
              type="button"
              onClick={handleImport}
              disabled={!configured}
              className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-bg disabled:opacity-50"
            >
              Import as roadmap
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!configured}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:text-text disabled:opacity-50"
            >
              Send as message
            </button>
          </div>
        )}
        {!isOutline && looksLikeBareTopic(draft) && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-text">
            <span className="flex-1">
              Looks like a topic. Plan it — see where it fits and what to learn alongside?
            </span>
            <button
              type="button"
              onClick={() => {
                onAddTopic(draft.trim())
                setDraft('')
              }}
              disabled={!configured}
              className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-bg disabled:opacity-50"
            >
              Plan this topic
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!configured}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:text-text disabled:opacity-50"
            >
              Ask coach
            </button>
          </div>
        )}
        {webSearchAvailable && (
          <label
            className="mb-2 flex w-fit items-center gap-1.5 text-xs text-muted"
            title="Runs a live web search so current versions, tools, and exam objectives are included"
          >
            <input
              type="checkbox"
              checked={webSearch}
              onChange={(e) => setWebSearch(e.target.checked)}
            />
            Include latest (web search)
          </label>
        )}
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={Math.min(8, Math.max(1, draft.split('\n').length))}
            placeholder="Ask anything, paste a roadmap, or “add topic: …”"
            disabled={!configured}
            className="flex-1 resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none transition focus:border-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!configured || !draft.trim() || sendMessage.isPending}
            className="self-end rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  )
}
