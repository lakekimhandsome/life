import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { stripMarkdown } from '../src/lib/markdown.ts'

const lifeOrigin = 'https://life.lakekim.com'
const imageBucket = 'body-images'
const fallbackImage = `${lifeOrigin}/life-share-cover.png?v=3`
const redirectScript = "location.replace(document.getElementById('open').href)"
const scriptHash = createHash('sha256').update(redirectScript).digest('base64')
const headers = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': `default-src 'none'; script-src 'sha256-${scriptHash}'; base-uri 'none'; frame-ancestors 'none'`,
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function firstImage(body: string) {
  // shortcut: inline Markdown images, use a Markdown parser if reference-style images need previews
  const text = body.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '')
  for (const match of text.matchAll(/!\[[^[\]\n]*\]\(<?(https:\/\/[^\s<>)]+)>?(?:[ \t]+["'][^\n]*?["'])?[ \t]*\)/gi)) {
    const image = URL.parse(match[1])
    if (image && !image.username && !image.password) return image
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') ?? url.pathname.split('/').at(-1) ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return new Response('Shared record not found', { status: 404, headers })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    console.error('Missing share preview database configuration')
    return new Response('LIFE is temporarily unavailable', { status: 503, headers })
  }
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { 'x-life-share-token': token } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await client.rpc('get_shared_life_object', { p_share_token: token })
  if (error) {
    console.error('Shared record lookup failed', error.code)
    return new Response('LIFE is temporarily unavailable', { status: 503, headers })
  }
  const record = data?.[0]
  if (!record) return new Response('Shared record not found', { status: 404, headers })

  const openUrl = `${lifeOrigin}/share/${token}`
  const previewUrl = new URL(`/share/${token}`, url.origin)
  const body = record.body ?? ''
  const image = firstImage(body)
  const imagePrefix = `/storage/v1/object/authenticated/${imageBucket}/`
  const storagePath = image?.origin === new URL(supabaseUrl).origin && image.pathname.startsWith(imagePrefix)
    ? image.pathname.slice(imagePrefix.length)
    : undefined

  if (url.searchParams.has('image')) {
    // Resolve the image only after verifying the current share token on both the record and storage.
    const signed = storagePath ? await client.storage.from(imageBucket).createSignedUrl(storagePath, 60) : null
    return new Response(null, { status: 302, headers: { ...headers, Location: signed?.data?.signedUrl ?? fallbackImage } })
  }

  const imageUrl = storagePath ? `${previewUrl}?image=1` : image?.href ?? fallbackImage
  const title = escapeHtml(record.title || 'LIFE')
  const description = escapeHtml(Array.from(stripMarkdown(body)).slice(0, 160).join('') || 'LIFE에서 공유한 기록')
  return new Response(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta property="og:type" content="article">
<meta property="og:site_name" content="LIFE">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:url" content="${escapeHtml(previewUrl.href)}">
</head><body><a id="open" href="${openUrl}">LIFE에서 기록 열기</a>
<script>${redirectScript}</script></body></html>`, {
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function HEAD(request: Request) {
  const { status, headers } = await GET(request)
  return new Response(null, { status, headers })
}
