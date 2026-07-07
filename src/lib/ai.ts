import {
  chunkSummaryPrompt,
  detailsNodePrompt,
  quizPrompt,
  recapPrompt,
  reduceSummariesPrompt,
  roadmapPrompt,
  summarizeResourcePrompt,
} from '@/lib/prompts'
import { supabase } from '@/lib/supabase'
import type { AIProvider, QuizQuestion } from '@/types/db'

/** OpenAI-compatible base URL per provider. NVIDIA NIM mirrors the OpenAI schema. */
export const PROVIDER_BASE: Record<AIProvider, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  nvidia: 'https://integrate.api.nvidia.com/v1',
}

// Providers whose API blocks browser CORS must be routed through the ai-proxy
// edge function instead of fetched directly.
const PROXIED_PROVIDERS: ReadonlySet<AIProvider> = new Set(['nvidia'])

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

/** Chat completion that expects a JSON object/array back. Recovers from stray text/fences. */
export async function chatJSON<T = unknown>(opts: ChatOptions): Promise<T> {
  const raw = await chatCompletion(opts)
  const cleaned = stripCodeFences(raw)
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const match = cleaned.match(/[[{][\s\S]*[\]}]/)
    if (match) {
      try {
        return JSON.parse(match[0]) as T
      } catch {
        // fall through
      }
    }
    throw new AIError(`Could not parse AI JSON response: ${cleaned.slice(0, 200)}`, 'parse_failed')
  }
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

export async function generateRoadmap(
  cfg: AIConfig,
  context: string
): Promise<RoadmapProposalNode[]> {
  const { system, user } = roadmapPrompt(context)
  return chatJSON<RoadmapProposalNode[]>({ ...cfg, system, user, maxTokens: 2500 })
}

/** Comprehensive topic write-up merging notes + resource material. */
export async function generateNodeDetails(cfg: AIConfig, context: string): Promise<string> {
  const { system, user } = detailsNodePrompt(context)
  return chatText({ ...cfg, system, user, maxTokens: 2500 })
}

export async function generateRecap(cfg: AIConfig, context: string): Promise<string> {
  const { system, user } = recapPrompt(context)
  return chatText({ ...cfg, system, user, maxTokens: 400 })
}

export async function generateQuiz(cfg: AIConfig, context: string): Promise<QuizQuestion[]> {
  const { system, user } = quizPrompt(context)
  return chatJSON<QuizQuestion[]>({ ...cfg, system, user, maxTokens: 2000 })
}
