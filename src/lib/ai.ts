import {
  chunkSummaryPrompt,
  detailsNodePrompt,
  type DetailsLength,
  formatNotesPrompt,
  quizPrompt,
  recapPrompt,
  reduceSummariesPrompt,
  roadmapChatPrompt,
  roadmapFromChatPrompt,
  roadmapPrompt,
  summarizeResourcePrompt,
  topicAnalysisPrompt,
} from '@/lib/prompts'
import { supabase } from '@/lib/supabase'
import type { AIProvider, QuizQuestion } from '@/types/db'

/**
 * OpenAI-compatible base URL per provider. NVIDIA NIM mirrors the OpenAI schema.
 * Cloudflare's endpoint is account-scoped, so its entry here is only a placeholder host —
 * the real per-account base is built with `cloudflareBase(accountId)` in resolveAIConfig.
 */
export const PROVIDER_BASE: Record<AIProvider, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  cloudflare: 'https://api.cloudflare.com/client/v4',
}

/** Cloudflare Workers AI OpenAI-compatible base URL for a given account id. */
export function cloudflareBase(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`
}

/** Whether a provider exposes an OpenAI-style /models list. Cloudflare does not — models are entered manually. */
export function providerListsModels(provider: AIProvider): boolean {
  return provider !== 'cloudflare'
}

// Providers whose API blocks browser CORS must be routed through the ai-proxy
// edge function instead of fetched directly.
const PROXIED_PROVIDERS: ReadonlySet<AIProvider> = new Set(['nvidia', 'cloudflare'])

function providerHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://knowledge-graph.app',
    'X-Title': 'Personal Knowledge Graph',
  }
}

/**
 * Single entry point for provider HTTP calls. OpenRouter is fetched directly
 * (CORS-friendly); NVIDIA is relayed through the ai-proxy edge function, which
 * forwards the key server-side. Returns the raw Response so callers keep their
 * existing status/error handling.
 */
async function providerFetch(
  provider: AIProvider,
  baseUrl: string,
  apiKey: string,
  path: '/models' | '/chat/completions',
  payload?: unknown
): Promise<Response> {
  if (PROXIED_PROVIDERS.has(provider)) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new AIError('Not signed in.', 'missing_key')
    return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        'X-Provider-Key': apiKey,
      },
      body: JSON.stringify({ base: baseUrl, path, payload }),
    })
  }

  const method = path === '/models' ? 'GET' : 'POST'
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: providerHeaders(apiKey),
    body: method === 'GET' ? undefined : JSON.stringify(payload),
  })
}

/** Resolved AI target: which provider, key, model, and endpoint to call. */
export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
  baseUrl: string
}

export class AIError extends Error {
  constructor(
    message: string,
    public code: 'missing_key' | 'request_failed' | 'parse_failed' = 'request_failed'
  ) {
    super(message)
  }
}

export interface OpenRouterModel {
  id: string
  name: string
  context_length?: number
  pricing?: { prompt: string; completion: string }
}

export function isFreeModel(model: OpenRouterModel): boolean {
  // NVIDIA build.nvidia.com models have no pricing block — all free.
  if (!model.pricing) return true
  return Number(model.pricing.prompt ?? 1) === 0 && Number(model.pricing.completion ?? 1) === 0
}

export async function listModels(
  apiKey: string,
  baseUrl: string = PROVIDER_BASE.openrouter,
  provider: AIProvider = 'openrouter'
): Promise<OpenRouterModel[]> {
  if (!apiKey) throw new AIError('No API key configured.', 'missing_key')
  const res = await providerFetch(provider, baseUrl, apiKey, '/models')
  if (!res.ok) throw new AIError(`Models request failed (${res.status})`)
  const data = await res.json()
  return (data.data ?? []) as OpenRouterModel[]
}

/**
 * Cheap liveness check for a model (max_tokens: 1 to barely touch quota).
 * Returns true if the provider accepts the request, false on any 4xx/5xx/network error.
 * Pass a model id to test a candidate other than cfg.model.
 */
export async function pingModel(cfg: AIConfig, model: string = cfg.model): Promise<boolean> {
  try {
    const res = await providerFetch(cfg.provider, cfg.baseUrl, cfg.apiKey, '/chat/completions', {
      model,
      max_tokens: 1,
      temperature: 0,
      messages: [{ role: 'user', content: 'ping' }],
    })
    return res.ok
  } catch {
    return false
  }
}

interface ChatOptions extends AIConfig {
  system: string
  user: string
  temperature?: number
  maxTokens?: number
}

async function chatCompletion({
  provider,
  apiKey,
  model,
  baseUrl,
  system,
  user,
  temperature = 0.4,
  maxTokens = 1500,
}: ChatOptions) {
  if (!apiKey) throw new AIError('No API key configured.', 'missing_key')
  const res = await providerFetch(provider, baseUrl, apiKey, '/chat/completions', {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new AIError(`AI request failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new AIError('AI response had no content.')
  return content
}

/** Chat completion returning plain text/markdown. */
export async function chatText(opts: ChatOptions): Promise<string> {
  return chatCompletion(opts)
}

export interface ChatConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatConversationOptions extends AIConfig {
  system: string
  history: ChatConversationMessage[]
  maxTokens?: number
}

/** Multi-turn chat completion — includes prior conversation history for context. */
export async function chatConversation({
  provider,
  apiKey,
  model,
  baseUrl,
  system,
  history,
  maxTokens = 1200,
}: ChatConversationOptions): Promise<string> {
  if (!apiKey) throw new AIError('No API key configured.', 'missing_key')
  const res = await providerFetch(provider, baseUrl, apiKey, '/chat/completions', {
    model,
    temperature: 0.5,
    max_tokens: maxTokens,
    messages: [{ role: 'system', content: system }, ...history],
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new AIError(`AI request failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new AIError('AI response had no content.')
  return content
}

function stripCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
}

/**
 * Scans for the first JSON array/object in `text`, tracking string/escape state and bracket depth.
 * Returns the first value that closes cleanly (`complete`) — ignoring any prose/citations that follow,
 * which `:online` web search likes to append — and, if the value was cut off mid-stream (token cap),
 * a best-effort `salvaged` array containing every top-level element that did finish.
 */
function scanJson(text: string): { complete: string | null; salvaged: string | null } {
  const start = text.search(/[[{]/)
  if (start === -1) return { complete: null, salvaged: null }
  const s = text.slice(start)
  const open = s[0]
  let depth = 0
  let inStr = false
  let escaped = false
  let lastElementEnd = -1 // index just past the last top-level element that closed (array only)
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '[' || ch === '{') depth++
    else if (ch === ']' || ch === '}') {
      depth--
      if (depth === 1) lastElementEnd = i + 1
      if (depth === 0) return { complete: s.slice(0, i + 1), salvaged: null }
    }
  }
  // Never returned to depth 0 → truncated. For an array, keep the elements that did complete.
  const salvaged =
    open === '[' && lastElementEnd > 0 ? s.slice(0, lastElementEnd).replace(/,\s*$/, '') + ']' : null
  return { complete: null, salvaged }
}

/** Chat completion that expects a JSON object/array back. Recovers from stray text/fences/truncation. */
export async function chatJSON<T = unknown>(opts: ChatOptions): Promise<T> {
  const raw = await chatCompletion(opts)
  const cleaned = stripCodeFences(raw)
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const { complete, salvaged } = scanJson(cleaned)
    for (const candidate of [complete, salvaged]) {
      if (!candidate) continue
      try {
        return JSON.parse(candidate) as T
      } catch {
        // try the next candidate
      }
    }
    throw new AIError(`Could not parse AI JSON response: ${cleaned.slice(0, 200)}`, 'parse_failed')
  }
}

export interface RoadmapChatAdd {
  title: string
  description?: string
  parentTitle?: string | null
}

export interface RoadmapChatResult {
  reply: string
  add: RoadmapChatAdd[]
}

/** Q&A about a proposed roadmap; may return topics to add to the proposal. */
export async function roadmapChat(
  cfg: AIConfig,
  question: string,
  proposalSerialization: string
): Promise<RoadmapChatResult> {
  const { system, user } = roadmapChatPrompt(question, proposalSerialization)
  const r = await chatJSON<{ reply?: string; add?: RoadmapChatAdd[] }>({
    ...cfg,
    system,
    user,
    temperature: 0.4,
    maxTokens: 1200,
  })
  return { reply: r.reply ?? '', add: r.add ?? [] }
}

export interface SiblingSuggestion {
  title: string
  reason?: string
}

export interface TopicAnalysis {
  title: string
  domain: string
  parent_id: string | null
  parent_new: string | null
  coverage: 'isolated' | 'part_of_larger'
  siblings: SiblingSuggestion[]
  prerequisites: string[]
  related_existing_ids: string[]
}

/** Analyzes one or more requested topics against the existing tree (siblings, domain, placement). */
export async function analyzeTopics(
  cfg: AIConfig,
  rawInput: string,
  treeSerialization: string
): Promise<TopicAnalysis[]> {
  const { system, user } = topicAnalysisPrompt(rawInput, treeSerialization)
  const result = await chatJSON<{ topics?: TopicAnalysis[] }>({
    ...cfg,
    system,
    user,
    temperature: 0.3,
    maxTokens: 1200,
  })
  return (result.topics ?? []).map((t) => ({
    ...t,
    siblings: t.siblings ?? [],
    prerequisites: t.prerequisites ?? [],
    related_existing_ids: t.related_existing_ids ?? [],
  }))
}

export interface AutoPlacementResult {
  parent_id: string | null
  reasoning: string
  suggested_path: string
}

const CHUNK_CHAR_THRESHOLD = 8000
const CHUNK_SIZE = 6000

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks
}

/** Summarizes resource content, map-reducing over chunks for long transcripts/pages. */
export async function summarizeResourceContent(
  cfg: AIConfig,
  title: string,
  rawContent: string
): Promise<string> {
  if (rawContent.length <= CHUNK_CHAR_THRESHOLD) {
    const { system, user } = summarizeResourcePrompt(title, rawContent)
    return chatText({ ...cfg, system, user })
  }

  const chunks = chunkText(rawContent, CHUNK_SIZE)
  const partials: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const { system, user } = chunkSummaryPrompt(title, i, chunks.length, chunks[i])
    partials.push(await chatText({ ...cfg, system, user, maxTokens: 500 }))
  }

  const { system, user } = reduceSummariesPrompt(title, partials)
  return chatText({ ...cfg, system, user, maxTokens: 1500 })
}

export interface RoadmapProposalNode {
  title: string
  description?: string
  prerequisites?: string[]
  children?: RoadmapProposalNode[]
}

// Models often nest children under a differently-named key, especially for cert "domains".
const CHILD_KEYS = ['children', 'subtopics', 'topics', 'items', 'nodes']

/** Coerces one loosely-shaped object into a RoadmapProposalNode, or null if it has no usable title. */
function coerceNode(raw: unknown): RoadmapProposalNode | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const title = typeof o.title === 'string' ? o.title : typeof o.name === 'string' ? o.name : null
  if (!title) return null
  const node: RoadmapProposalNode = { title: title.trim() }
  if (typeof o.description === 'string') node.description = o.description
  else if (typeof o.summary === 'string') node.description = o.summary
  if (Array.isArray(o.prerequisites)) {
    node.prerequisites = o.prerequisites.filter((p): p is string => typeof p === 'string')
  }
  for (const k of CHILD_KEYS) {
    if (Array.isArray(o[k])) {
      const kids = (o[k] as unknown[])
        .map(coerceNode)
        .filter((n): n is RoadmapProposalNode => n !== null)
      if (kids.length) node.children = kids
      break
    }
  }
  return node
}

/**
 * Normalizes whatever the model returned into a proposal array. Handles the common deviations from
 * the requested bare array: a wrapper object like `{ "domains": [...] }` / `{ "roadmap": [...] }`,
 * or a single root node `{ "title": "CCDAK", "children": [...] }` (whose children are the roadmap,
 * since the root topic already exists).
 */
export function normalizeProposal(raw: unknown): RoadmapProposalNode[] {
  if (Array.isArray(raw)) {
    return raw.map(coerceNode).filter((n): n is RoadmapProposalNode => n !== null)
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (typeof o.title === 'string' || typeof o.name === 'string') {
      const node = coerceNode(o)
      return node ? node.children ?? [node] : []
    }
    const arr = Object.values(o).find(Array.isArray) as unknown[] | undefined
    if (arr) return arr.map(coerceNode).filter((n): n is RoadmapProposalNode => n !== null)
  }
  return []
}

export async function generateRoadmap(
  cfg: AIConfig,
  context: string,
  opts: { webSearch?: boolean } = {}
): Promise<RoadmapProposalNode[]> {
  // OpenRouter's `:online` suffix runs a live web search before answering, so the
  // model can surface releases newer than its training cutoff. NVIDIA has no equivalent.
  const online = !!opts.webSearch && cfg.provider === 'openrouter'
  const { system, user } = roadmapPrompt(context, online)
  const model = online ? `${cfg.model}:online` : cfg.model
  // Cert-domain roadmaps and pasted-outline imports produce larger trees than a plain topic; the
  // online path needs extra headroom because web-grounded answers run longer and must not truncate
  // mid-JSON (a cut-off response can't be parsed).
  const raw = await chatJSON<unknown>({ ...cfg, model, system, user, maxTokens: online ? 5000 : 3200 })
  // Models don't reliably return the exact bare-array shape (esp. certs → "domains" objects);
  // normalize so a valid-but-differently-shaped response still yields a tree instead of nothing.
  return normalizeProposal(raw)
}

export interface ChatRoadmapProposal {
  /** Root topic title the roadmap should hang under, drawn from the conversation. */
  title: string
  nodes: RoadmapProposalNode[]
}

/**
 * Turns a dashboard planning conversation into a root title + roadmap tree,
 * deduped against every topic the user already has.
 */
export async function generateRoadmapFromChat(
  cfg: AIConfig,
  conversation: string,
  existingTree: string,
  opts: { webSearch?: boolean } = {}
): Promise<ChatRoadmapProposal> {
  const online = !!opts.webSearch && cfg.provider === 'openrouter'
  const { system, user } = roadmapFromChatPrompt(conversation, existingTree, online)
  const model = online ? `${cfg.model}:online` : cfg.model
  const raw = await chatJSON<unknown>({
    ...cfg,
    model,
    system,
    user,
    maxTokens: online ? 5000 : 3200,
  })

  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const title = typeof obj.title === 'string' ? obj.title.trim() : ''
  // Fall back to normalizing the whole payload: models sometimes drop the wrapper
  // and return the bare array, or nest the roadmap under a differently-named key.
  const nodes = normalizeProposal(obj.nodes ?? raw)
  return { title, nodes }
}

const DETAILS_MAX_TOKENS: Record<DetailsLength, number> = {
  brief: 1000,
  standard: 2500,
  'in-depth': 4000,
}

export type { DetailsLength }

/** Comprehensive topic write-up merging notes + resource material. */
export async function generateNodeDetails(
  cfg: AIConfig,
  context: string,
  opts: { length?: DetailsLength; instructions?: string } = {}
): Promise<string> {
  const length = opts.length ?? 'standard'
  const { system, user } = detailsNodePrompt(context, { length, instructions: opts.instructions })
  return chatText({ ...cfg, system, user, maxTokens: DETAILS_MAX_TOKENS[length] })
}

/** Merges appended blocks back into the body of a note, returning the rewritten Markdown. */
export async function formatNotes(cfg: AIConfig, notes: string): Promise<string> {
  const { system, user } = formatNotesPrompt(notes)
  const merged = await chatText({ ...cfg, system, user, maxTokens: 4000 })
  const trimmed = merged.trim()
  if (!trimmed) throw new AIError('The model returned an empty note.')
  return stripCodeFence(trimmed)
}

/** Models sometimes wrap the whole answer in a ```markdown fence despite being told not to. */
function stripCodeFence(text: string): string {
  const match = /^```(?:markdown|md)?\s*\n([\s\S]*)\n```$/.exec(text)
  return match ? match[1] : text
}

export async function generateRecap(cfg: AIConfig, context: string): Promise<string> {
  const { system, user } = recapPrompt(context)
  return chatText({ ...cfg, system, user, maxTokens: 400 })
}

export async function generateQuiz(cfg: AIConfig, context: string): Promise<QuizQuestion[]> {
  const { system, user } = quizPrompt(context)
  return chatJSON<QuizQuestion[]>({ ...cfg, system, user, maxTokens: 2000 })
}
