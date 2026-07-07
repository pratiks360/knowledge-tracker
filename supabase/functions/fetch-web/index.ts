// ============================================================
// Personal Knowledge Graph — fetch-web Edge Function
// Given a URL, fetch the page server-side (bypasses CORS),
// strip boilerplate via Readability, return { title, text }.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Readability } from 'https://esm.sh/@mozilla/readability@0.5.0?target=deno'
// deno-dom (WASM) instead of linkedom — linkedom drags in a native `canvas`
// dependency that Supabase's bundler can't resolve.
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    let body: { url?: unknown }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }
    if (typeof body.url !== 'string' || !body.url.trim()) {
      return json({ error: 'url must be a non-empty string' }, 400)
    }

    let target: URL
    try {
      target = new URL(body.url.trim())
    } catch {
      return json({ error: 'Invalid URL' }, 400)
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return json({ error: 'Only http/https URLs are supported' }, 400)
    }

    const pageRes = await fetch(target.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      },
      redirect: 'follow',
    })
    if (!pageRes.ok) {
      return json({ error: `Failed to fetch page (${pageRes.status})` }, 502)
    }
    const html = await pageRes.text()

    const document = new DOMParser().parseFromString(html, 'text/html')
    if (!document) {
      return json({ error: 'Could not parse this page' }, 422)
    }
    const reader = new Readability(document as never)
    const article = reader.parse()

    const title = article?.title || document.title || target.hostname
    const text = (article?.textContent || '').trim()

    if (!text) {
      return json({ error: 'Could not extract readable content from this page' }, 422)
    }

    return json({ title, text: text.slice(0, 100_000) })
  } catch (err) {
    console.error('fetch-web error:', err)
    return json({ error: 'An error occurred fetching this page.' }, 500)
  }
})

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
