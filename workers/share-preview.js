const previewOrigin = 'https://life-share-preview.vercel.app'
const sharePath = /^\/share\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/?$/i
const properties = ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:image', 'og:url']

export default {
  async fetch(request, _env, ctx) {
    const url = new URL(request.url)
    if (!['GET', 'HEAD'].includes(request.method) || !sharePath.test(url.pathname)) return fetch(request)

    // GitHub Pages can still serve the read-only page if the preview service is unavailable.
    ctx.passThroughOnException()
    const canonical = new URL(url.pathname.replace(/\/$/, ''), url.origin)
    const upstream = new URL(canonical.pathname, previewOrigin)
    if (url.searchParams.has('image')) {
      upstream.searchParams.set('image', '1')
      return fetch(upstream, { method: request.method, redirect: 'manual' })
    }

    const [preview, page] = await Promise.all([
      fetch(upstream, { method: request.method, redirect: 'manual', signal: AbortSignal.timeout(5000) }),
      fetch(new URL('/', url), { method: request.method, redirect: 'manual' }),
    ])
    if (!preview.ok || !page.ok) return fetch(request)

    const headers = new Headers(page.headers)
    for (const name of ['Content-Length', 'ETag', 'Last-Modified', 'Expires']) headers.delete(name)
    headers.set('Cache-Control', 'private, no-store')
    headers.set('X-Robots-Tag', 'noindex, nofollow')
    headers.set('Referrer-Policy', 'no-referrer')
    const response = new Response(page.body, { headers })
    if (request.method === 'HEAD') return response

    const metadata = new Map()
    await new HTMLRewriter().on('head meta[property]', {
      element(element) {
        const property = element.getAttribute('property')
        const value = element.getAttribute('content')
        if (properties.includes(property) && value !== null) metadata.set(property, value)
      },
    }).transform(preview).text()
    metadata.set('og:url', canonical.href)
    if (metadata.get('og:image') === `${upstream.href}?image=1`) {
      metadata.set('og:image', `${canonical.href}?image=1`)
    }

    return new HTMLRewriter().on('head', {
      element(head) {
        for (const [property, value] of metadata) {
          // HTMLRewriter returns the source attribute with entities intact.
          const escaped = value.replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
          head.append(`<meta property="${property}" content="${escaped}">`, { html: true })
        }
      },
    }).transform(response)
  },
}
