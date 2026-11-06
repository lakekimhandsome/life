import assert from 'node:assert/strict'
import test from 'node:test'

const url = 'https://life-test.supabase.co'
const deletedAt = '2026-11-07T03:00:00.123456+00:00'
let handler: (request: Request) => Promise<Response>
Object.assign(globalThis, { Deno: {
  env: { get: (key: string) => key === 'SUPABASE_URL' ? url : 'test-key' },
  serve: (callback: typeof handler) => { handler = callback },
} })
await import('./index.ts')
async function request(method: string, params = {}) {
  const response = await handler(new Request(`${url}/functions/v1/life-mcp`, {
    method: 'POST', headers: { authorization: 'Bearer user-token' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }))
  return (await response.json()).result
}
const call = (name: string, args = {}) => request('tools/call', { name, arguments: args })

test('trash discovery describes read permissions and private restoration', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'owner' }))
  const { tools } = await request('tools/list')
  const list = tools.find((tool: { name: string }) => tool.name === 'list_deleted_objects')
  const restore = tools.find((tool: { name: string }) => tool.name === 'restore_object')
  assert.equal(list.annotations.readOnlyHint, true)
  assert.match(list.description, /plans and assets cannot/)
  assert.deepEqual(restore.inputSchema.required, ['id'])
  assert.equal(restore.annotations.destructiveHint, false)
  assert.match(restore.description, /sharing disabled/)
})

test('trash pages use the owner token and reach records deleted at the same time', async (t) => {
  const rows = ['c','b','a'].map((id) => ({
    id, deleted_at: deletedAt,
    object_data: { id, type: 'note', title: id, body: '  original\n', user_id: 'owner', share_token: 'old-secret', meta: { status: 'active' } },
  }))
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer user-token')
    if (input.endsWith('/auth/v1/user')) return Response.json({ id: 'owner' })
    const { pathname, searchParams } = new URL(input)
    assert.equal(pathname, '/rest/v1/life_deleted_objects')
    assert.equal(searchParams.get('user_id'), 'eq.owner')
    assert.equal(searchParams.get('order'), 'deleted_at.desc,id.desc')
    assert.equal(searchParams.get('limit'), '3')
    const filter = searchParams.get('and')
    if (filter) {
      assert.ok(filter.includes(deletedAt))
      assert.match(filter, /id\.lt\."b"/)
    }
    return Response.json(filter ? rows.slice(2) : rows)
  })
  const first = (await call('list_deleted_objects', { limit: 2 })).structuredContent
  const second = (await call('list_deleted_objects', { limit: 2, before: first.nextBefore })).structuredContent
  assert.deepEqual([...first.objects,...second.objects].map((row: { id: string }) => row.id), ['c','b','a'])
  assert.equal(first.objects[0].deletedAt, deletedAt)
  assert.equal(first.objects[0].object.body, '  original\n')
  assert.equal(first.objects[0].object.user_id, undefined)
  assert.equal(first.objects[0].object.share_token, undefined)
  assert.equal(second.nextBefore, null)
})

test('restore uses the existing atomic RPC under the user token', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer user-token')
    if (input.endsWith('/auth/v1/user')) return Response.json({ id: 'owner' })
    assert.equal(new URL(input).pathname, '/rest/v1/rpc/restore_deleted_life_object')
    assert.equal(init.method, 'POST')
    assert.deepEqual(JSON.parse(init.body as string), { target_id: 'note' })
    return Response.json('note')
  })
  assert.deepEqual((await call('restore_object', { id: 'note' })).structuredContent, { id: 'note', restored: true })
})

test('empty trash, invalid inputs and denied or missing restores fail safely', async (t) => {
  let databaseCalls = 0
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    if (input.endsWith('/auth/v1/user')) return Response.json({ id: 'owner' })
    databaseCalls++
    return Response.json([])
  })
  assert.equal((await call('restore_object', {})).isError, true)
  assert.equal((await call('list_deleted_objects', { before: 'not-a-cursor' })).isError, true)
  assert.equal(databaseCalls, 0)
  assert.deepEqual((await call('list_deleted_objects')).structuredContent, { objects: [], nextBefore: null })
  for (const status of [400, 403]) {
    t.mock.method(globalThis, 'fetch', async (input: string) => input.endsWith('/auth/v1/user')
      ? Response.json({ id: 'owner' }) : new Response('Deleted item not found or permission denied', { status }))
    const result = await call('restore_object', { id: 'not-owned-or-missing' })
    assert.equal(result.isError, true)
    assert.equal(result.structuredContent, undefined)
  }
})
