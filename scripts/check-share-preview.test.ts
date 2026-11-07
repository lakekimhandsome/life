import assert from 'node:assert/strict'
import test from 'node:test'
import { GET } from '../api/share.ts'

test('share previews use the existing token checks for record metadata and uploaded images', async (t) => {
  const database = 'https://database.example'
  const token = 'b2c5fcbc-1904-43e2-9830-985560a4e463'
  const preview = `https://preview.example/share/${token}`
  const imagePath = 'owner/cover.png'
  const image = `${database}/storage/v1/object/authenticated/body-images/${imagePath}`
  const signedPath = `/object/sign/body-images/${imagePath}?token=signed`
  process.env.VITE_SUPABASE_URL = database
  process.env.VITE_SUPABASE_ANON_KEY = 'anon-test-key'

  let record: { title: string; body: string }[] = [{
    title: '제목 "<script>" & 이미지',
    body: `## 본문 요약\n\n![대표 사진](${image})`,
  }]
  const upstream = t.mock.method(globalThis, 'fetch', async (input: string | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    assert.equal(request.headers.get('x-life-share-token'), token)
    if (request.url === `${database}/rest/v1/rpc/get_shared_life_object`) {
      assert.deepEqual(await request.json(), { p_share_token: token })
      return Response.json(record)
    }
    assert.equal(request.url, `${database}/storage/v1/object/sign/body-images/${imagePath}`)
    return Response.json({ signedURL: signedPath })
  })

  assert.equal((await GET(new Request(`${preview}-invalid`))).status, 404)
  assert.equal(upstream.mock.callCount(), 0)

  const response = await GET(new Request(preview))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /text\/html/)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const html = await response.text()
  assert.ok(html.includes('property="og:title" content="제목 &quot;&lt;script&gt;&quot; &amp; 이미지"'))
  assert.ok(html.includes('property="og:description" content="본문 요약"'))
  assert.ok(html.includes(`property="og:image" content="${preview}?image=1"`))
  assert.ok(html.includes(`href="https://life.lakekim.com/share/${token}"`))

  const cover = await GET(new Request(`${preview}?image=1`))
  assert.equal(cover.status, 302)
  assert.equal(cover.headers.get('location'), `${database}/storage/v1${signedPath}`)

  record = [{ title: '사진 없는 기록', body: '본문' }]
  const noImage = await GET(new Request(preview))
  assert.ok((await noImage.text()).includes('property="og:image" content="https://life.lakekim.com/life-share-cover.png?v=2"'))

  record = []
  assert.equal((await GET(new Request(preview))).status, 404)
  const revokedCover = await GET(new Request(`${preview}?image=1`))
  assert.equal(revokedCover.status, 404)
  assert.equal(revokedCover.headers.get('location'), null)
})
