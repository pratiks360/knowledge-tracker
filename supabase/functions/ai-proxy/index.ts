// ============================================================
// Personal Knowledge Graph — ai-proxy Edge Function
// Thin pass-through to OpenAI-compatible providers whose API
// blocks browser CORS (NVIDIA NIM). Verifies the Supabase JWT,
// forwards the user's provider key (sent in X-Provider-Key,
// never stored server-side), and relays the upstream response.
//
// Body: { base: string, path: '/models' | '/chat/completions', payload?: object }
// base must be in ALLOWED_BASES.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-provider-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Only providers that actually need a proxy. OpenRouter works browser-direct.
const ALLOWED_BASES = new Set(['https://integrate.api.nvidia.com/v1'])
// Cloudflare Workers AI is account-scoped, so its base varies per user — allow it by pattern
// (a 32-hex account id) rather than an exact string, so the proxy still can't relay to arbitrary URLs.
const ALLOWED_BASE_PATTERNS = [
  /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/[a-f0-9]{32}\/ai\/v1$/,
]
const ALLOWED_PATHS = new Set(['/models', '/chat/completions', '/embeddings'])

function isAllowedBase(base: string): boolean {
  return ALLOWED_BASES.has(base) || ALLOWED_BASE_PATTERNS.some((re) => re.test(base))
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const providerKey = req.headers.get('X-Provider-Key')
    if (!providerKey) return json({ error: 'Missing X-Provider-Key header' }, 400)

    let body: { base?: unknown; path?: unknown; payload?: unknown }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const base = String(body.base ?? '')
    const path = String(body.path ?? '')
    if (!isAllowedBase(base)) return json({ error: 'Provider base not allowed' }, 400)
    if (!ALLOWED_PATHS.has(path)) return json({ error: 'Path not allowed' }, 400)

    const isModels = path === '/models'
    const upstream = await fetch(`${base}${path}`, {
      method: isModels ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providerKey}`,
      },
      body: isModels ? undefined : JSON.stringify(body.payload ?? {}),
    })

    // Relay status + body verbatim so the client sees real 401/403/429 codes.
    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return json({ error: `Proxy error: ${(err as Error).message}` }, 500)
  }
})

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
