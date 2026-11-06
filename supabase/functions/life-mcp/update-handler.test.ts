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

async function request(method: string, params = {}) {
  const response = await handler(new Request(`${url}/functions/v1/life-mcp`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }))
  assert.equal(response.status, 200)
  return (await response.json()).result
}

test('update discovery describes replacement and its safety boundaries', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'test-user' }))
  const { tools } = await request('tools/list')
  const update = tools.find((tool: { name: string }) => tool.name === 'update_object')
  assert.deepEqual(update.inputSchema.required, ['id', 'expectedUpdatedAt'])
  assert.equal(update.inputSchema.additionalProperties, false)
  assert.match(update.description, /replaces the entire body/)
  assert.deepEqual(update.annotations, {
    readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false,
  })
})

test('update preserves exact Markdown, omitted fields and meta through authenticated PATCH', async (t) => {
  const logs: string[] = []
  t.mock.method(console, 'info', (message: string) => logs.push(message))
  const existing = {
    id: 'test-note', title: 'Keep title', body: 'Keep body',
    meta: { folderId: 'keep-folder', status: 'active' }, visibility: 'private',
  }
  let stored = { ...existing }
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    const headers = new Headers(init.headers)
    assert.equal(headers.get('authorization'), 'Bearer test-token')
    assert.equal(headers.get('apikey'), 'test-key')
    if (input.endsWith('/auth/v1/user')) return Response.json({ id: 'test-user' })
    const { pathname, searchParams } = new URL(input)
    assert.equal(pathname, '/rest/v1/life_objects')
    assert.equal(searchParams.get('id'), 'eq.test-note')
    assert.equal(searchParams.get('type'), 'in.(journal,project,note,plan,goal,asset)')
    if (init.method !== 'PATCH') return Response.json([{ meta: stored.meta }])
    assert.equal(headers.get('prefer'), 'return=representation')
    const patch = JSON.parse(init.body as string)
    assert.equal(patch.user_id, undefined)
    assert.equal(patch.visibility, undefined)
    stored = { ...stored, ...patch }
    return Response.json([stored])
  })
  const markdown = '\n  ## 오답 분석\n- SiO₂ < 52%, Ω ∝ → 🔴\n\n| 항목 | 값 |\n| --- | --- |\n| 판 | `이동` |\n\n'
  for (const body of ['a', markdown, markdown.repeat(1000), '']) {
    const result = await request('tools/call', { name: 'update_object', arguments: { id: 'test-note', expectedUpdatedAt: '2026-11-07T00:00:00Z', body } })
    assert.equal(result.isError, undefined)
    assert.equal(result.structuredContent.body, body)
    assert.equal(result.structuredContent.title, existing.title)
    assert.deepEqual(result.structuredContent.meta, existing.meta)
  }
  const result = await request('tools/call', {
    name: 'update_object', arguments: { id: 'test-note', expectedUpdatedAt: '2026-11-07T00:00:00Z', title: 'New title', meta: { status: null } },
  })
  assert.equal(result.structuredContent.body, '')
  assert.deepEqual(result.structuredContent.meta, { folderId: 'keep-folder', status: null })
  assert.equal(logs.length, 10)
  const events = logs.map((message) => JSON.parse(message))
  assert.equal(events[0].outcome, 'received')
  assert.equal(events[1].outcome, 'success')
  assert.equal(events[0].callId, events[1].callId)
  for (const event of events) {
    assert.deepEqual(Object.keys(event).sort(), ['callId', 'event', 'outcome', 'tool'])
    assert.equal(event.tool, 'update_object')
  }
})

test('invalid input never writes and missing/denied rows return server tool errors', async (t) => {
  t.mock.method(console, 'info', () => {})
  let databaseCalls = 0
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    if (input.endsWith('/auth/v1/user')) return Response.json({ id: 'test-user' })
    databaseCalls++
    return Response.json([])
  })
  for (const args of [{}, { id: 'test-note' }, { id: 'test-note', body: 42 }, { id: 'test-note', meta: null }]) {
    const result = await request('tools/call', { name: 'update_object', arguments: args })
    assert.equal(result.isError, true)
  }
  assert.equal(databaseCalls, 0)
  const missing = await request('tools/call', {
    name: 'update_object', arguments: { id: 'test-note', expectedUpdatedAt: '2026-11-07T00:00:00Z', body: 'Content' },
  })
  assert.equal(missing.isError, true)
  assert.match(missing.content[0].text, /Record changed or was deleted/)
  t.mock.method(globalThis, 'fetch', async (input: string) => input.endsWith('/auth/v1/user')
    ? Response.json({ id: 'test-user' })
    : new Response('permission denied', { status: 403 }))
  const denied = await request('tools/call', {
    name: 'update_object', arguments: { id: 'test-note', expectedUpdatedAt: '2026-11-07T00:00:00Z', body: 'Content' },
  })
  assert.equal(denied.isError, true)
  assert.match(denied.content[0].text, /LIFE data request failed \(403\)/)
})
