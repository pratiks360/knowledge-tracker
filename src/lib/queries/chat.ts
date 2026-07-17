import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { ChatMessageRow, ChatThreadRow, NodeRow, ResourceRow } from '@/types/db'
import { chatConversation, type AIConfig, type ChatConversationMessage } from '@/lib/ai'
import { dashboardChatSystemPrompt, nodeChatSystemPrompt } from '@/lib/prompts'
import { computeProgress, getAncestors, serializeTreeForAI } from '@/lib/queries/nodes'

const chatKey = (nodeId: string) => ['chat_messages', nodeId] as const
/** One coach conversation — chat_messages rows with node_id NULL and this thread_id. */
const threadChatKey = (threadId: string) => ['chat_messages', 'thread', threadId] as const
const THREADS_KEY = ['chat_threads'] as const

export function useChatMessages(nodeId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: chatKey(nodeId ?? ''),
    enabled: !!user && !!nodeId,
    queryFn: async (): Promise<ChatMessageRow[]> => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('node_id', nodeId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as ChatMessageRow[]
    },
  })
}

// details_md is AI-generated and can run long; cap it so it can't crowd out the
// conversation itself in the context window.
const DETAILS_LIMIT = 4000

function buildChatContext(node: NodeRow, ancestors: NodeRow[], resources: ResourceRow[]): string {
  const parts: string[] = []
  if (ancestors.length)
    parts.push(`Breadcrumb: ${ancestors.map((a) => a.title).join(' > ')} > ${node.title}`)
  parts.push(`Topic: ${node.title}`)
  if (node.description) parts.push(`Description: ${node.description}`)
  if (node.details_md) parts.push(`Learning material:\n${node.details_md.slice(0, DETAILS_LIMIT)}`)
  if (node.notes_md) parts.push(`Notes:\n${node.notes_md}`)
  for (const r of resources) {
    const body = r.summary_md || r.raw_content?.slice(0, 1500)
    if (body) parts.push(`Resource "${r.title ?? r.url ?? 'Untitled'}":\n${body}`)
  }
  return parts.join('\n\n')
}

const HISTORY_LIMIT = 20

export function useSendChatMessage(node: NodeRow, allNodes: NodeRow[], resources: ResourceRow[]) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      content,
      config,
      webSearch,
    }: {
      content: string
      config: AIConfig
      webSearch: boolean
    }) => {
      if (!user) throw new Error('Not signed in')

      // Read history from the DB, not the query cache: the cache is cold on a
      // fresh login and can be evicted, which would silently send the model a
      // context-free conversation on a topic the user has been chatting about.
      const { data: prior, error: historyErr } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('node_id', node.id)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT)
      if (historyErr) throw historyErr

      const { error: insertUserErr } = await supabase
        .from('chat_messages')
        .insert({ user_id: user.id, node_id: node.id, role: 'user', content })
      if (insertUserErr) throw insertUserErr

      const history: ChatConversationMessage[] = [
        ...(prior ?? [])
          .reverse()
          .map((m) => ({ role: m.role as ChatConversationMessage['role'], content: m.content })),
        { role: 'user' as const, content },
      ]

      // The `:online` web-search suffix is an OpenRouter feature; NVIDIA ignores it.
      const useWebSearch = webSearch && config.provider === 'openrouter'
      const ancestors = getAncestors(allNodes, node.id)
      const system = nodeChatSystemPrompt(
        buildChatContext(node, ancestors, resources),
        useWebSearch
      )
      const model = useWebSearch ? `${config.model}:online` : config.model

      const reply = await chatConversation({ ...config, model, system, history })

      const { error: insertAssistantErr } = await supabase
        .from('chat_messages')
        .insert({ user_id: user.id, node_id: node.id, role: 'assistant', content: reply })
      if (insertAssistantErr) throw insertAssistantErr

      return reply
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: chatKey(node.id) }),
  })
}

// ── Dashboard (graph-wide) chat ───────────────────────────────

export function useChatThreads() {
  const { user } = useAuth()
  return useQuery({
    queryKey: THREADS_KEY,
    enabled: !!user,
    queryFn: async (): Promise<ChatThreadRow[]> => {
      const { data, error } = await supabase
        .from('chat_threads')
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as ChatThreadRow[]
    },
  })
}

export function useCreateThread() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (title = 'New chat'): Promise<ChatThreadRow> => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('chat_threads')
        .insert({ user_id: user.id, title })
        .select('*')
        .single()
      if (error) throw error
      return data as ChatThreadRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: THREADS_KEY }),
  })
}

export function useRenameThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from('chat_threads').update({ title }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: THREADS_KEY }),
  })
}

/** Permanent — the thread's messages cascade away with it. */
export function useDeleteThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat_threads').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: THREADS_KEY })
      queryClient.removeQueries({ queryKey: threadChatKey(id) })
    },
  })
}

/**
 * Thread ids whose title OR message content matches `query`. Titles are matched
 * client-side by the caller; this covers the "I know I discussed X somewhere"
 * case that a title search can't.
 */
export function useSearchThreadMessages(query: string) {
  const { user } = useAuth()
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['chat_thread_search', trimmed],
    enabled: !!user && trimmed.length > 1,
    queryFn: async (): Promise<Set<string>> => {
      // % and _ are ilike wildcards — a user searching "100%" would otherwise
      // match every thread.
      const escaped = trimmed.replace(/[\\%_]/g, '\\$&')
      const { data, error } = await supabase
        .from('chat_messages')
        .select('thread_id')
        .not('thread_id', 'is', null)
        // ilike over content: these threads are small and few, so a full-text
        // index would be more machinery than the problem needs.
        .ilike('content', `%${escaped}%`)
        .limit(200)
      if (error) throw error
      return new Set((data ?? []).map((r) => r.thread_id as string))
    },
  })
}

export function useGlobalChatMessages(threadId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: threadChatKey(threadId ?? ''),
    enabled: !!user && !!threadId,
    queryFn: async (): Promise<ChatMessageRow[]> => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as ChatMessageRow[]
    },
  })
}

const STALE_REVIEW_DAYS = 14

/**
 * Whole-graph context for the dashboard coach: the tree itself plus the progress
 * signals the dashboard surfaces, so it can talk about what's stalling and what's
 * next rather than just what exists.
 */
export function buildGraphContext(nodes: NodeRow[]): string {
  if (nodes.length === 0) return '(The user has no topics yet — this is a blank slate.)'

  const parts: string[] = [`Topic tree (id: title, indented by depth):\n${serializeTreeForAI(nodes)}`]

  const counts = { not_started: 0, learning: 0, done: 0 }
  nodes.forEach((n) => counts[n.status]++)
  parts.push(
    `Status: ${nodes.length} topics total — ${counts.done} done, ${counts.learning} in progress, ${counts.not_started} not started.`
  )

  const roots = nodes.filter((n) => !n.parent_id)
  if (roots.length) {
    const lines = roots.map((r) => `- ${r.title}: ${computeProgress(nodes, r.id)}% complete`)
    parts.push(`Progress per root topic:\n${lines.join('\n')}`)
  }

  const inProgress = nodes.filter((n) => n.status === 'learning')
  if (inProgress.length) {
    parts.push(`Currently learning: ${inProgress.map((n) => n.title).join(', ')}`)
  }

  const recent = nodes
    .filter((n) => n.last_visited_at)
    .sort((a, b) => (b.last_visited_at! > a.last_visited_at! ? 1 : -1))
    .slice(0, 8)
  if (recent.length) {
    parts.push(`Recently visited (most recent first): ${recent.map((n) => n.title).join(', ')}`)
  }

  const cutoff = Date.now() - STALE_REVIEW_DAYS * 24 * 60 * 60 * 1000
  const stale = nodes.filter(
    (n) =>
      (n.status === 'done' || n.status === 'learning') &&
      n.last_visited_at &&
      new Date(n.last_visited_at).getTime() < cutoff
  )
  if (stale.length) {
    parts.push(
      `Untouched for over ${STALE_REVIEW_DAYS} days (due for review): ${stale.map((n) => n.title).join(', ')}`
    )
  }

  const tagged = nodes.filter((n) => n.tags?.length)
  if (tagged.length) {
    const allTags = [...new Set(tagged.flatMap((n) => n.tags))]
    parts.push(`Tags in use: ${allTags.join(', ')}`)
  }

  return parts.join('\n\n')
}

/** First user message becomes the tab label, the way Claude names a conversation. */
function deriveThreadTitle(firstMessage: string): string {
  const oneLine = firstMessage.trim().replace(/\s+/g, ' ')
  return oneLine.length > 48 ? `${oneLine.slice(0, 48).trimEnd()}…` : oneLine
}

// threadId travels with the mutation rather than the hook: the first send of a new
// chat creates the thread moments earlier, and a hook-bound id would still be the
// stale one on that render.
export function useSendGlobalChatMessage(allNodes: NodeRow[]) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      threadId,
      content,
      config,
      webSearch,
    }: {
      threadId: string
      content: string
      config: AIConfig
      webSearch: boolean
    }) => {
      if (!user) throw new Error('Not signed in')
      if (!threadId) throw new Error('No conversation selected')

      const { data: prior, error: historyErr } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT)
      if (historyErr) throw historyErr

      const { error: insertUserErr } = await supabase
        .from('chat_messages')
        .insert({ user_id: user.id, node_id: null, thread_id: threadId, role: 'user', content })
      if (insertUserErr) throw insertUserErr

      // Name the tab from the opening message, and bump recency either way so the
      // tab order tracks what you're actually working on.
      const patch: Partial<ChatThreadRow> = { updated_at: new Date().toISOString() }
      if ((prior ?? []).length === 0) patch.title = deriveThreadTitle(content)
      await supabase.from('chat_threads').update(patch).eq('id', threadId)

      const history: ChatConversationMessage[] = [
        ...(prior ?? [])
          .reverse()
          .map((m) => ({ role: m.role as ChatConversationMessage['role'], content: m.content })),
        { role: 'user' as const, content },
      ]

      const useWebSearch = webSearch && config.provider === 'openrouter'
      const system = dashboardChatSystemPrompt(buildGraphContext(allNodes), useWebSearch)
      const model = useWebSearch ? `${config.model}:online` : config.model

      const reply = await chatConversation({ ...config, model, system, history })

      const { error: insertAssistantErr } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          node_id: null,
          thread_id: threadId,
          role: 'assistant',
          content: reply,
        })
      if (insertAssistantErr) throw insertAssistantErr

      return reply
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: threadChatKey(vars.threadId) })
      queryClient.invalidateQueries({ queryKey: THREADS_KEY })
    },
  })
}
