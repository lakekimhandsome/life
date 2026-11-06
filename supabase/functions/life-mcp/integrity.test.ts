import assert from 'node:assert/strict'
import test from 'node:test'

const url = 'https://life-test.supabase.co'
const version = '2026-11-07T03:00:00.123456Z'
const folder = '00000000-0000-4000-8000-000000000001'
let handler: (request: Request) => Promise<Response>
Object.assign(globalThis, { Deno: {
  env: { get: (key: string) => key === 'SUPABASE_URL' ? url : 'test-key' },
  serve: (callback: typeof handler) => { handler = callback },
} })
await import('./index.ts')
async function call(name: string, args = {}) {
  const response = await handler(new Request(`${url}/functions/v1/life-mcp`, {
    method: 'POST', headers: { authorization: 'Bearer token' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: name === 'tools/list' ? name : 'tools/call', params: { name, arguments: args } }),
  }))
  return (await response.json()).result
}

test('pagination reaches every equal-time record and preserves fractional precision', async (t) => {
  const rows = ['c','b','a'].map((id) => ({ id, type: 'note', occurred_at: version }))
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    if (input.endsWith('/auth/v1/user')) return Response.json({ id: 'user' })
    const params = new URL(input).searchParams
    assert.equal(params.get('order'), 'occurred_at.desc,id.desc')
    assert.equal(params.get('limit'), '3')
    const filter = params.get('and')
    if (filter) {
      assert.ok(filter.includes(version), 'do not round the database timestamp to milliseconds')
      assert.match(filter, /id\.lt\."b"/)
    }
    return Response.json(filter ? rows.slice(2) : rows)
  })
  const first = (await call('find_objects', { limit: 2 })).structuredContent
  const second = (await call('find_objects', { limit: 2, before: first.nextBefore })).structuredContent
  assert.deepEqual([...first.objects, ...second.objects].map((row: { id: string }) => row.id), ['c','b','a'])
  assert.equal(second.nextBefore, null)
})

test('search and folder filtering happen before the database limit', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    if (input.endsWith('/auth/v1/user')) return Response.json({ id: 'user' })
    const params = new URL(input).searchParams
    assert.equal(params.get('type'), 'eq.note')
    assert.equal(params.get('folder_id'), `eq.${folder}`)
    assert.match(params.get('and')!, /title\.ilike/)
    assert.equal(params.get('limit'), '21')
    return Response.json([])
  })
  assert.equal((await call('find_objects', { query: '52%, "판"', folderId: folder })).isError, undefined)
})

test('create preserves Markdown exactly and sends a real folder column', async (t) => {
  const body = '    indented code\n\n'
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    if (input.endsWith('/auth/v1/user')) return Response.json({ id: 'user' })
    const row = JSON.parse(init.body as string)
    assert.equal(row.body, body)
    assert.equal(row.folder_id, folder)
    assert.ok(new URL(input).searchParams.get('select')?.includes('folder_id'))
    return Response.json([row])
  })
  assert.equal((await call('create_object', { type: 'note', title: 'Code', body, folderId: folder })).isError, undefined)
})

test('stale MCP writes are rejected and cannot overwrite data', async (t) => {
  let writes = 0
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    if (input.endsWith('/auth/v1/user')) return Response.json({ id: 'user' })
    assert.equal(new URL(input).searchParams.get('updated_at'), `eq.${version}`)
    if (init.method === 'PATCH') writes++
    return Response.json([])
  })
  for (const changes of [{ body: 'stale' }, { meta: { status: 'done' } }]) {
    const result = await call('update_object', { id: 'note', expectedUpdatedAt: version, ...changes })
    assert.equal(result.isError, true)
    assert.match(result.content[0].text, /Record changed or was deleted/)
  }
  assert.equal(writes, 1, 'stale meta must stop before PATCH')
})

test('folder discovery, creation and relationship removal keep the user token', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer token')
    if (input.endsWith('/auth/v1/user')) return Response.json({ id: 'user' })
    const path = new URL(input).pathname
    if (path.endsWith('life_relationships')) {
      assert.equal(init.method, 'DELETE')
      assert.equal(new URL(input).searchParams.get('id'), 'eq.link')
      return new Response(null, { status: 204 })
    }
    if (init.method === 'POST') {
      const row = JSON.parse(init.body as string)
      assert.equal(row.parent_id, folder)
      assert.equal(row.user_id, 'user')
      return Response.json([row])
    }
    return Response.json([{ id: folder, name: 'Parent', parent_id: null }])
  })
  assert.equal((await call('list_note_folders')).structuredContent.folders[0].id, folder)
  assert.equal((await call('create_note_folder', { name: 'Child', parentId: folder })).isError, undefined)
  for (let i = 0; i < 2; i++) assert.equal((await call('unlink_objects', { id: 'link' })).structuredContent.removed, true)
  const discovery = await call('tools/list')
  assert.match(discovery.tools.find((tool: { name: string }) => tool.name === 'delete_object').description, /Plans and assets are permanently deleted/)
})

test('invalid cursors, folder IDs, missing versions and JSON null fail safely', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    assert.ok(input.endsWith('/auth/v1/user'), 'invalid inputs must never reach the database')
    return Response.json({ id: 'user' })
  })
  for (const [name, args] of [
    ['find_objects', { before: 'invalid-cursor' }],
    ['create_note_folder', { name: 'Child', parentId: 'invalid' }],
    ['update_object', { id: 'note', body: 'missing version' }],
    ['create_object', { type: 'project', title: 'x', folderId: folder }],
    ['create_object', { type: 'note', title: 'x', body: 42 }],
  ] as const) assert.equal((await call(name, args)).isError, true)
  const response = await handler(new Request(`${url}/functions/v1/life-mcp`, { method: 'POST', headers: { authorization: 'Bearer token' }, body: 'null' }))
  assert.equal((await response.json()).error.code, -32600)
})
