// ============================================================
// Personal Knowledge Graph — nightly-autofill Edge Function
// Triggered by pg_cron. Spends leftover FREE AI credits filling
// in details for topics that have none, rotating across every
// configured provider (OpenRouter -> NVIDIA -> Cloudflare):
// when one hits its free limit (429/402/403) we move to the next.
//
// Two ways in:
// - Cron: shared CRON_SECRET header, runs every enabled user due this UTC hour.
// - Manual "Run now": a signed-in user's own Bearer JWT, runs just for them,
//   ignoring autofill_enabled/autofill_hour (deploy with --no-verify-jwt so
//   this function does its own auth instead of Supabase's gateway check).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Provider = 'openrouter' | 'nvidia' | 'cloudflare'
interface ProviderCfg {
  provider: Provider
  base: string
  key: string
  model: string
}

const PAUSE_MS = 1200 // gentle pacing between calls to respect free rate limits
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const cronSecret = Deno.env.get('CRON_SECRET')
  const isCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret

  if (isCron) {
    const hour = new Date().getUTCHours()
    const { data: settingsRows, error: sErr } = await supabase
      .from('user_settings')
      .select('*')
      .eq('autofill_enabled', true)
      .eq('autofill_hour', hour)
    if (sErr) return json({ error: sErr.message }, 500)

    const summary: Record<string, unknown>[] = []
    for (const s of settingsRows ?? []) {
      summary.push(await runForUser(supabase, s))
    }
    return json({ ran: summary.length, users: summary })
  }

  // Manual "Run now": authenticate the caller as a real user via their own JWT,
  // then run just for them regardless of autofill_enabled/autofill_hour.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const { data: settings, error: sErr } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (sErr || !settings) return json({ error: 'No settings found for this user' }, 404)

  const result = await runForUser(supabase, settings)
  return json(result)
})

function buildProviders(s: Record<string, unknown>): ProviderCfg[] {
  const list: ProviderCfg[] = []
  if (s.openrouter_api_key && s.selected_model) {
    list.push({
      provider: 'openrouter',
      base: 'https://openrouter.ai/api/v1',
      key: String(s.openrouter_api_key),
      model: String(s.selected_model),
    })
  }
  if (s.nvidia_api_key && s.nvidia_model) {
    list.push({
      provider: 'nvidia',
      base: 'https://integrate.api.nvidia.com/v1',
      key: String(s.nvidia_api_key),
      model: String(s.nvidia_model),
    })
  }
  if (s.cloudflare_api_key && s.cloudflare_account_id && s.cloudflare_model) {
    list.push({
      provider: 'cloudflare',
      base: `https://api.cloudflare.com/client/v4/accounts/${s.cloudflare_account_id}/ai/v1`,
      key: String(s.cloudflare_api_key),
      model: String(s.cloudflare_model),
    })
  }
  return list
}

// deno-lint-ignore no-explicit-any
async function runForUser(supabase: any, s: Record<string, unknown>) {
  const userId = String(s.user_id)
  const providers = buildProviders(s)
  const cap = Number(s.autofill_max_per_run ?? 20)

  const filledList: { id: string; title: string }[] = []

  const finish = (count: number, status: string) =>
    supabase
      .from('user_settings')
      .update({
        autofill_last_run: new Date().toISOString(),
        autofill_last_count: count,
        autofill_last_status: status,
        autofill_last_filled: filledList,
      })
      .eq('user_id', userId)

  if (providers.length === 0) {
    await finish(0, 'error')
    return { userId, filled: 0, status: 'no_providers' }
  }

  // All of the user's nodes — for ancestor paths and the work queue.
  const { data: allNodes, error: nErr } = await supabase
    .from('nodes')
    .select('id, parent_id, title, description, notes_md, details_md')
    .eq('user_id', userId)
  if (nErr) {
    await finish(0, 'error')
    return { userId, filled: 0, status: nErr.message }
  }

  const byId = new Map<string, Record<string, unknown>>(
    (allNodes ?? []).map((n: Record<string, unknown>) => [String(n.id), n])
  )
  const queue = (allNodes ?? [])
    .filter((n: Record<string, unknown>) => !n.details_md || String(n.details_md).trim() === '')
    .slice(0, cap)

  const pathOf = (n: Record<string, unknown>): string => {
    const parts: string[] = [String(n.title)]
    let cur = n.parent_id ? byId.get(String(n.parent_id)) : undefined
    let guard = 0
    while (cur && guard++ < 50) {
      parts.unshift(String(cur.title))
      cur = cur.parent_id ? byId.get(String(cur.parent_id)) : undefined
    }
    return parts.join(' > ')
  }

  let providerIdx = 0
  let filled = 0

  for (const node of queue) {
    if (providerIdx >= providers.length) break // every provider exhausted

    // Resource summaries for grounding (best-effort).
    const { data: resources } = await supabase
      .from('resources')
      .select('title, summary_md, raw_content')
      .eq('node_id', node.id)

    const context = buildContext(node, pathOf(node), resources ?? [])

    let done = false
    while (!done && providerIdx < providers.length) {
      const p = providers[providerIdx]
      const res = await callProvider(p, context)
      if (res.ok && res.content) {
        await supabase
          .from('nodes')
          .update({ details_md: res.content, details_generated_at: new Date().toISOString() })
          .eq('id', node.id)
        filled++
        filledList.push({ id: String(node.id), title: String(node.title) })
        done = true
      } else if (res.exhausted) {
        providerIdx++ // this provider is out of free quota — rotate to the next
      } else {
        done = true // transient/other error for this node — skip it, keep the provider
      }
    }
    await sleep(PAUSE_MS)
  }

  const status = filled > 0 ? (providerIdx >= providers.length ? 'rate_limited' : 'ok') : 'rate_limited'
  await finish(filled, status)
  return { userId, filled, status, providersTried: providerIdx + 1 }
}

function buildContext(
  node: Record<string, unknown>,
  path: string,
  resources: Record<string, unknown>[]
): string {
  const parts = [`Topic path: ${path}`, `Topic: ${node.title}`]
  if (node.description) parts.push(`Description: ${node.description}`)
  if (node.notes_md) parts.push(`Notes:\n${node.notes_md}`)
  for (const r of resources) {
    const body = r.summary_md || (r.raw_content ? String(r.raw_content).slice(0, 3000) : '')
    if (body) parts.push(`Resource "${r.title ?? 'Untitled'}":\n${body}`)
  }
  return parts.join('\n\n')
}

const SYSTEM = `You are a study assistant. Write a comprehensive, well-structured explainer in Markdown
about the topic below, using the provided context (topic path, notes, resources). If a "Topic path" is
given, scope the explainer to that path and read the title relative to its parents rather than as a
generic word. Use clear headings: an overview, key concepts in depth, how they fit together, and
practical examples where the context supports it. Where a diagram clarifies (architecture, flow,
sequence, hierarchy), include a \`\`\`mermaid fenced block with valid syntax. Do not invent facts that
contradict the context; general foundational context is fine. Keep it accurate.`

async function callProvider(
  p: ProviderCfg,
  context: string
): Promise<{ ok: boolean; content?: string; exhausted?: boolean }> {
  try {
    const res = await fetch(`${p.base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${p.key}`,
      },
      body: JSON.stringify({
        model: p.model,
        temperature: 0.4,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: context },
        ],
      }),
    })
    // 429 rate limit, 402 out of credit, 403 key/credit limit exceeded → this provider is spent.
    if (res.status === 429 || res.status === 402 || res.status === 403) {
      return { ok: false, exhausted: true }
    }
    if (!res.ok) return { ok: false }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (typeof content === 'string' && content.trim()) return { ok: true, content }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
