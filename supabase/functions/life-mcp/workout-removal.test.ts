import assert from 'node:assert/strict'
import test from 'node:test'

const url = 'https://life-test.supabase.co'
const activeTypes = 'in.(journal,project,note,plan,goal,asset)'
let handler: (request: Request) => Promise<Response>
Object.assign(globalThis, {
  Deno: {
    env: { get: (key: string) => key === 'SUPABASE_URL' ? url : 'test-key' },
    serve: (callback: typeof handler) => { handler = callback },
  },
})
await import('./index.ts')

async function request(method: string, params = {}) {
  const response = await handler(new Request(`${url}/functions/v1/life-mcp`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }))
  return (await response.json()).result
}

test('workout is absent from discovery and cannot be created or searched', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    assert.ok(input.endsWith('/auth/v1/user'), 'unsupported types must never reach the database')
    return Response.json({ id: 'test-user' })
  })
  const discovery = await request('tools/list')
  assert.ok(!JSON.stringify(discovery).includes('workout'))
  for (const name of ['create_object', 'find_objects']) {
    const result = await request('tools/call', { name, arguments: { type: 'workout', title: 'Retired' } })
    assert.equal(result.isError, true)
    assert.equal(result.content[0].text, 'Invalid object type')
  }
})

test('unfiltered searches exclude stored workouts before pagination', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    if (input.endsWith('/auth/v1/user')) return Response.json({ id: 'test-user' })
    const params = new URL(input).searchParams
    assert.equal(params.get('type'), activeTypes)
    assert.equal(params.get('limit'), '1')
    return Response.json([{ id: 'note-id', type: 'note', occurred_at: '2026-10-31T00:00:00Z' }])
  })
  const result = await request('tools/call', { name: 'find_objects', arguments: { limit: 1 } })
  assert.equal(result.structuredContent.objects[0].type, 'note')
  assert.equal(result.isError, undefined)
})

test('stored workouts cannot be read, edited, deleted, or linked by ID', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    if (input.endsWith('/auth/v1/user')) return Response.json({ id: 'test-user' })
    assert.equal(new URL(input).searchParams.get('type'), activeTypes)
    return Response.json([])
  })
  for (const [name, args] of [
    ['get_object', { id: 'retired-id' }],
    ['update_object', { id: 'retired-id', title: 'Changed' }],
    ['update_object', { id: 'retired-id', meta: { durationMin: 30 } }],
    ['delete_object', { id: 'retired-id' }],
    ['link_objects', { sourceId: 'retired-id', targetId: 'note-id', kind: 'related' }],
  ] as const) {
    const result = await request('tools/call', { name, arguments: args })
    assert.equal(result.isError, true, name)
  }
})
