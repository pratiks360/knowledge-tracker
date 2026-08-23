import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { embedText, type EmbeddingConfig } from '@/lib/ai'
import type { MatchEmbeddingResult, NodeRow } from '@/types/db'

const PAUSE_MS = 250 // gentle pacing to stay under free-tier rate limits

/** Text worth embedding for one node: its own details/notes, concatenated with its title. */
function nodeContent(node: NodeRow): string | null {
  const body = [node.description, node.notes_md, node.details_md].filter(Boolean).join('\n\n')
  if (!body.trim()) return null
  return `${node.title}\n\n${body}`.slice(0, 6000)
}

/**
 * (Re)builds the semantic search index: embeds every node's details/notes and every
 * resource's summary/content that don't already have an up-to-date embedding, and
 * upserts them into `content_embeddings`. Safe to re-run — unchanged content is skipped.
 */
export function useBuildSearchIndex() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      cfg,
      onProgress,
    }: {
      cfg: EmbeddingConfig
      onProgress?: (done: number, total: number) => void
    }) => {
      if (!user) throw new Error('Not signed in')

      const [{ data: nodes, error: nErr }, { data: resources, error: rErr }] = await Promise.all([
        supabase.from('nodes').select('*'),
        supabase.from('resources').select('id, node_id, title, summary_md, raw_content'),
      ])
      if (nErr) throw nErr
      if (rErr) throw rErr

      const { data: existing, error: eErr } = await supabase
        .from('content_embeddings')
        .select('node_id, resource_id, kind, content')
      if (eErr) throw eErr
      const existingByKey = new Map(
        (existing ?? []).map((e) => [`${e.kind}:${e.node_id}:${e.resource_id ?? ''}`, e.content])
      )

      type Item = { key: string; node_id: string; resource_id: string | null; kind: 'node' | 'resource'; content: string }
      const items: Item[] = []
      for (const n of (nodes as NodeRow[]) ?? []) {
        const content = nodeContent(n)
        if (!content) continue
        items.push({ key: `node:${n.id}:`, node_id: n.id, resource_id: null, kind: 'node', content })
      }
      for (const r of resources ?? []) {
        const body = r.summary_md || r.raw_content
        if (!body?.trim()) continue
        const content = `${r.title ?? 'Untitled'}\n\n${body}`.slice(0, 6000)
        items.push({
          key: `resource:${r.node_id}:${r.id}`,
          node_id: r.node_id,
          resource_id: r.id,
          kind: 'resource',
          content,
        })
      }

      const toEmbed = items.filter((it) => existingByKey.get(it.key) !== it.content)
      let done = 0
      onProgress?.(done, toEmbed.length)
      for (const it of toEmbed) {
        const embedding = await embedText(cfg, it.content)
        const { error } = await supabase.from('content_embeddings').upsert(
          {
            user_id: user.id,
            node_id: it.node_id,
            resource_id: it.resource_id,
            kind: it.kind,
            content: it.content,
            embedding: embedding as unknown as never,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'kind,node_id,resource_id' }
        )
        if (error) throw error
        done++
        onProgress?.(done, toEmbed.length)
        if (done < toEmbed.length) await new Promise((r) => setTimeout(r, PAUSE_MS))
      }

      // Drop embeddings for content that no longer exists (deleted nodes/resources).
      const liveKeys = new Set(items.map((it) => it.key))
      const stale = (existing ?? []).filter(
        (e) => !liveKeys.has(`${e.kind}:${e.node_id}:${e.resource_id ?? ''}`)
      )
      for (const s of stale) {
        const q = supabase.from('content_embeddings').delete().eq('kind', s.kind).eq('node_id', s.node_id)
        await (s.resource_id ? q.eq('resource_id', s.resource_id) : q.is('resource_id', null))
      }

      await supabase
        .from('user_settings')
        .update({ embeddings_built_at: new Date().toISOString() })
        .eq('user_id', user.id)

      return { embedded: toEmbed.length, total: items.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_settings'] })
    },
  })
}

export function useSemanticSearch(query: string, cfg: EmbeddingConfig | null) {
  return useQuery({
    queryKey: ['semantic-search', query],
    enabled: !!cfg && query.trim().length > 2,
    queryFn: async (): Promise<MatchEmbeddingResult[]> => {
      const embedding = await embedText(cfg!, query.trim())
      const { data, error } = await supabase.rpc('match_embeddings', {
        query_embedding: embedding as unknown as never,
        match_count: 8,
      })
      if (error) throw error
      return data as MatchEmbeddingResult[]
    },
  })
}
