import assert from 'node:assert/strict'
import test from 'node:test'

const url = 'https://life-test.supabase.co'
let handler: (request: Request) => Promise<Response>
Object.assign(globalThis, {
  Deno: {
    env: { get: (key: string) => key === 'SUPABASE_URL' ? url : 'test-key' },
    serve: (callback: typeof handler) => { handler = callback },
  },
})
await import('./index.ts')

test('unauthenticated GET and POST advertise the OAuth login flow', async () => {
  for (const method of ['GET', 'POST']) {
    const response = await handler(new Request(`${url}/functions/v1/life-mcp`, { method }))
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('www-authenticate'),
      `Bearer resource_metadata="${url}/functions/v1/life-mcp/.well-known/oauth-protected-resource"`)
  }
})

test('OAuth discovery stays public', async () => {
  const response = await handler(new Request(`${url}/functions/v1/life-mcp/.well-known/oauth-protected-resource`))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).authorization_servers, [`${url}/auth/v1`])
})

test('authenticated create_object inserts with the user token and returns the object', async (t) => {
  let inserted: Record<string, unknown> | undefined
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    const headers = new Headers(init.headers)
    assert.equal(headers.get('authorization'), 'Bearer test-token')
    if (input.endsWith('/auth/v1/user')) return Response.json({ id: 'test-user' })
    assert.equal(new URL(input).pathname, '/rest/v1/life_objects')
    assert.equal(init.method, 'POST')
    inserted = JSON.parse(init.body as string)
    return Response.json([inserted], { status: 201 })
  })
  const response = await handler(new Request(`${url}/functions/v1/life-mcp`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
      name: 'create_object', arguments: { type: 'note', title: 'Test note', body: 'Contents' },
    } }),
  }))
  const rpc = await response.json()
  assert.equal(rpc.result.isError, undefined)
  assert.equal(inserted?.user_id, 'test-user')
  assert.equal(inserted?.title, 'Test note')
  assert.equal(inserted?.type, 'note')
  assert.deepEqual(rpc.result.structuredContent, inserted)
})
