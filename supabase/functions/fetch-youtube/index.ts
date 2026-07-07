// ============================================================
// Personal Knowledge Graph — fetch-youtube Edge Function
// Given a YouTube URL, fetch the caption track and return
// { title, text }. If no captions exist, returns a typed error
// (code: 'no_captions') so the UI can offer manual-paste fallback.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

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

    const videoId = extractVideoId(body.url.trim())
    if (!videoId) return json({ error: 'Could not find a YouTube video id in that URL' }, 400)

    const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    })
    if (!watchRes.ok) return json({ error: `Failed to load video page (${watchRes.status})` }, 502)
    const html = await watchRes.text()

    const playerResponse = extractPlayerResponse(html)
    const title: string =
      playerResponse?.videoDetails?.title ??
      playerResponse?.microformat?.playerMicroformatRenderer?.title?.simpleText ??
      'Untitled video'

    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return json({ error: 'This video has no captions available', code: 'no_captions' }, 422)
    }

    const track =
      tracks.find((t: { languageCode?: string }) => t.languageCode?.startsWith('en')) ?? tracks[0]
    if (!track?.baseUrl) {
      return json({ error: 'This video has no captions available', code: 'no_captions' }, 422)
    }

    const captionRes = await fetch(track.baseUrl, { headers: { 'User-Agent': UA } })
    if (!captionRes.ok) {
      return json({ error: 'This video has no captions available', code: 'no_captions' }, 422)
    }
    const xml = await captionRes.text()
    const text = parseTranscriptXml(xml)

    if (!text) {
      return json({ error: 'This video has no captions available', code: 'no_captions' }, 422)
    }

    return json({ title, text: text.slice(0, 100_000) })
  } catch (err) {
    console.error('fetch-youtube error:', err)
    return json({ error: 'An error occurred fetching this video.' }, 500)
  }
})

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const shortsMatch = u.pathname.match(/^\/shorts\/([^/]+)/)
      if (shortsMatch) return shortsMatch[1]
      const embedMatch = u.pathname.match(/^\/embed\/([^/]+)/)
      if (embedMatch) return embedMatch[1]
    }
    return null
  } catch {
    return null
  }
}

function extractPlayerResponse(html: string): any {
  const match =
    html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/s) ??
    html.match(/ytInitialPlayerResponse"\]\s*=\s*(\{.*?\});/s)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function parseTranscriptXml(xml: string): string {
  const matches = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
  return matches
    .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim())
    .filter(Boolean)
    .join(' ')
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
