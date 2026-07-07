import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { ResourceRow } from '@/types/db'

const resourcesKey = (nodeId: string) => ['resources', nodeId] as const

export function useResources(nodeId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: resourcesKey(nodeId ?? ''),
    enabled: !!user && !!nodeId,
    queryFn: async (): Promise<ResourceRow[]> => {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('node_id', nodeId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ResourceRow[]
    },
  })
}

/** Set of node ids that have at least one resource — for tree "has data" coloring. */
export function useNodeIdsWithResources() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['resource-node-ids'],
    enabled: !!user,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('resources').select('node_id')
      if (error) throw error
      return new Set((data as { node_id: string }[]).map((r) => r.node_id))
    },
  })
}

export function isYoutubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host.includes('youtube.com') || host.includes('youtu.be')
  } catch {
    return false
  }
}

interface IngestResult {
  title: string
  text: string
}

async function invokeEdgeFunction(
  name: 'fetch-web' | 'fetch-youtube',
  url: string
): Promise<IngestResult> {
  const { data, error } = await supabase.functions.invoke(name, { body: { url } })
  if (error) {
    // supabase-js surfaces non-2xx as FunctionsHttpError; try to read the JSON body it attached.
    const context = (error as { context?: Response }).context
    let message = error.message
    let code: string | undefined
    if (context) {
      try {
        const body = await context.clone().json()
        message = body.error ?? message
        code = body.code
      } catch {
        // ignore — keep default message
      }
    }
    const err = new Error(message) as Error & { code?: string }
    err.code = code
    throw err
  }
  return data as IngestResult
}

export function useIngestWebResource(nodeId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (url: string) => {
      if (!user) throw new Error('Not signed in')
      const { title, text } = await invokeEdgeFunction('fetch-web', url)
      const { data, error } = await supabase
        .from('resources')
        .insert({ user_id: user.id, node_id: nodeId, kind: 'web', url, title, raw_content: text })
        .select('*')
        .single()
      if (error) throw error
      return data as ResourceRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourcesKey(nodeId) })
      queryClient.invalidateQueries({ queryKey: ['resource-node-ids'] })
    },
  })
}

export function useIngestYoutubeResource(nodeId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (url: string) => {
      if (!user) throw new Error('Not signed in')
      const { title, text } = await invokeEdgeFunction('fetch-youtube', url)
      const { data, error } = await supabase
        .from('resources')
        .insert({
          user_id: user.id,
          node_id: nodeId,
          kind: 'youtube',
          url,
          title,
          raw_content: text,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as ResourceRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourcesKey(nodeId) })
      queryClient.invalidateQueries({ queryKey: ['resource-node-ids'] })
    },
  })
}

export function useAddManualResource(nodeId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { title: string; content: string; url?: string }) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('resources')
        .insert({
          user_id: user.id,
          node_id: nodeId,
          kind: 'manual',
          title: input.title,
          url: input.url ?? null,
          raw_content: input.content,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as ResourceRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourcesKey(nodeId) })
      queryClient.invalidateQueries({ queryKey: ['resource-node-ids'] })
    },
  })
}

export function useUpdateResource(nodeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ResourceRow> }) => {
      const { data, error } = await supabase
        .from('resources')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data as ResourceRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourcesKey(nodeId) })
      queryClient.invalidateQueries({ queryKey: ['resource-node-ids'] })
    },
  })
}

export function useDeleteResource(nodeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('resources').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourcesKey(nodeId) })
      queryClient.invalidateQueries({ queryKey: ['resource-node-ids'] })
    },
  })
}
