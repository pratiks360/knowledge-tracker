import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { ChatMessageRow, NodeRow, ResourceRow } from '@/types/db'
import { chatConversation, type AIConfig, type ChatConversationMessage } from '@/lib/ai'
import { nodeChatSystemPrompt } from '@/lib/prompts'
import { getAncestors } from '@/lib/queries/nodes'

const chatKey = (nodeId: string) => ['chat_messages', nodeId] as const

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

function buildChatContext(node: NodeRow, ancestors: NodeRow[], resources: ResourceRow[]): string {
  const parts: string[] = []
  if (ancestors.length)
    parts.push(`Breadcrumb: ${ancestors.map((a) => a.title).join(' > ')} > ${node.title}`)
  parts.push(`Topic: ${node.title}`)
  if (node.description) parts.push(`Description: ${node.description}`)
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

      const { error: insertUserErr } = await supabase
        .from('chat_messages')
        .insert({ user_id: user.id, node_id: node.id, role: 'user', content })
      if (insertUserErr) throw insertUserErr

      const existing = queryClient.getQueryData<ChatMessageRow[]>(chatKey(node.id)) ?? []
      const history: ChatConversationMessage[] = [
        ...existing.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content })),
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
