const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const MCP_URL = `${SUPABASE_URL}/functions/v1/life-mcp`
const AUTH_ISSUER = `${SUPABASE_URL}/auth/v1`
const OBJECT_TYPES = ['journal', 'project', 'note', 'workout', 'study', 'goal', 'asset'] as const
const RELATIONSHIP_KINDS = ['related', 'supports', 'part_of'] as const

type JsonObject = Record<string, unknown>
type Tool = {
  name: string
  description: string
  inputSchema: JsonObject
  annotations: JsonObject
}

const tools: Tool[] = [
  {
    name: 'find_objects',
    description: 'List or search the signed-in user’s LIFE objects. Results are newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional text to find in titles or bodies.' },
        type: { type: 'string', enum: OBJECT_TYPES },
        before: { type: 'string', format: 'date-time', description: 'Pagination cursor using occurredAt.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'get_object',
    description: 'Get one LIFE object and all of its relationships.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'create_object',
    description: 'Create a journal, project, note, workout, study, goal, or asset in LIFE.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: OBJECT_TYPES },
        title: { type: 'string', minLength: 1 },
        body: { type: 'string', default: '' },
        occurredAt: { type: 'string', format: 'date-time' },
        meta: { type: 'object', additionalProperties: true },
      },
      required: ['type', 'title'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'update_object',
    description: 'Update an existing LIFE object. Omitted fields stay unchanged.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string', minLength: 1 },
        body: { type: 'string' },
        occurredAt: { type: 'string', format: 'date-time' },
        meta: { type: 'object', additionalProperties: true },
      },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'link_objects',
    description: 'Create a first-class relationship between two LIFE objects.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceId: { type: 'string' },
        targetId: { type: 'string' },
        kind: { type: 'string', enum: RELATIONSHIP_KINDS },
      },
      required: ['sourceId', 'targetId', 'kind'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
]

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, { status, headers })
}

function rpc(id: unknown, result: unknown) {
  return json({ jsonrpc: '2.0', id, result })
}

function rpcError(id: unknown, code: number, message: string) {
  return json({ jsonrpc: '2.0', id, error: { code, message } })
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
  return value.trim()
}

function optionalIso(value: unknown, field: string) {
  if (value === undefined) return undefined
  const text = requiredString(value, field)
  if (Number.isNaN(Date.parse(text))) throw new Error(`${field} must be an ISO date-time`)
  return new Date(text).toISOString()
}

function optionalMeta(value: unknown) {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('meta must be an object')
  for (const item of Object.values(value)) {
    if (item !== null && !['string', 'number', 'boolean'].includes(typeof item)) {
      throw new Error('meta values must be strings, numbers, booleans, or null')
    }
  }
  return value as JsonObject
}

function bearer(req: Request) {
  const authorization = req.headers.get('authorization') ?? ''
  return authorization.startsWith('Bearer ') ? authorization : null
}

async function getUser(authorization: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, authorization },
  })
  if (!response.ok) return null
  const user = await response.json()
  return typeof user.id === 'string' ? user : null
}

async function rest(path: string, authorization: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('apikey', SUPABASE_KEY)
  headers.set('authorization', authorization)
  headers.set('content-type', 'application/json')
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`LIFE data request failed (${response.status}): ${detail.slice(0, 300)}`)
  }
  return response.status === 204 ? null : response.json()
}

async function findObjects(args: JsonObject, authorization: string) {
  const limit = Math.min(50, Math.max(1, Number(args.limit) || 20))
  const query = typeof args.query === 'string' ? args.query.trim().toLocaleLowerCase() : ''
  const type = args.type === undefined ? undefined : requiredString(args.type, 'type')
  if (type && !OBJECT_TYPES.includes(type as typeof OBJECT_TYPES[number])) throw new Error('Invalid object type')
  const before = optionalIso(args.before, 'before')

  const params = new URLSearchParams({ select: '*', order: 'occurred_at.desc' })
  if (type) params.set('type', `eq.${type}`)
  if (before) params.set('occurred_at', `lt.${before}`)
  // ponytail: client-side search caps at 1,000 personal objects; add Postgres FTS when an account exceeds that.
  params.set('limit', query ? '1000' : String(limit))
  const rows = await rest(`life_objects?${params}`, authorization)
  const matches = query
    ? rows.filter((row: JsonObject) => `${row.title ?? ''}\n${row.body ?? ''}`.toLocaleLowerCase().includes(query)).slice(0, limit)
    : rows
  return { objects: matches, nextBefore: matches.length === limit ? matches.at(-1)?.occurred_at : null }
}

async function getObject(args: JsonObject, authorization: string) {
  const id = requiredString(args.id, 'id')
  const objectParams = new URLSearchParams({ select: '*', id: `eq.${id}`, limit: '1' })
  const objects = await rest(`life_objects?${objectParams}`, authorization)
  if (!objects.length) throw new Error('LIFE object not found')
  const relationships = await rest('life_relationships?select=*&order=created_at.desc', authorization)
  return {
    object: objects[0],
    relationships: relationships.filter((item: JsonObject) => item.source_id === id || item.target_id === id),
  }
}

async function createObject(args: JsonObject, authorization: string, userId: string) {
  const type = requiredString(args.type, 'type')
  if (!OBJECT_TYPES.includes(type as typeof OBJECT_TYPES[number])) throw new Error('Invalid object type')
  const timestamp = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    user_id: userId,
    type,
    title: requiredString(args.title, 'title'),
    body: typeof args.body === 'string' ? args.body.trim() : '',
    occurred_at: optionalIso(args.occurredAt, 'occurredAt') ?? timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    meta: optionalMeta(args.meta) ?? {},
  }
  return (await rest('life_objects', authorization, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  }))[0]
}

async function updateObject(args: JsonObject, authorization: string) {
  const id = requiredString(args.id, 'id')
  const patch: JsonObject = { updated_at: new Date().toISOString() }
  if (args.title !== undefined) patch.title = requiredString(args.title, 'title')
  if (args.body !== undefined) {
    if (typeof args.body !== 'string') throw new Error('body must be a string')
    patch.body = args.body.trim()
  }
  if (args.occurredAt !== undefined) patch.occurred_at = optionalIso(args.occurredAt, 'occurredAt')
  if (args.meta !== undefined) patch.meta = optionalMeta(args.meta)
  if (Object.keys(patch).length === 1) throw new Error('Provide at least one field to update')
  const params = new URLSearchParams({ id: `eq.${id}` })
  const rows = await rest(`life_objects?${params}`, authorization, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  if (!rows.length) throw new Error('LIFE object not found')
  return rows[0]
}

async function linkObjects(args: JsonObject, authorization: string, userId: string) {
  const sourceId = requiredString(args.sourceId, 'sourceId')
  const targetId = requiredString(args.targetId, 'targetId')
  const kind = requiredString(args.kind, 'kind')
  if (sourceId === targetId) throw new Error('An object cannot link to itself')
  if (!RELATIONSHIP_KINDS.includes(kind as typeof RELATIONSHIP_KINDS[number])) throw new Error('Invalid relationship kind')

  const source = await rest(`life_objects?${new URLSearchParams({ select: 'id', id: `eq.${sourceId}`, limit: '1' })}`, authorization)
  const target = await rest(`life_objects?${new URLSearchParams({ select: 'id', id: `eq.${targetId}`, limit: '1' })}`, authorization)
  if (!source.length || !target.length) throw new Error('Both LIFE objects must exist in this account')

  const existingParams = new URLSearchParams({
    select: '*',
    source_id: `eq.${sourceId}`,
    target_id: `eq.${targetId}`,
    kind: `eq.${kind}`,
    limit: '1',
  })
  const existing = await rest(`life_relationships?${existingParams}`, authorization)
  if (existing.length) return existing[0]

  return (await rest('life_relationships', authorization, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      user_id: userId,
      source_id: sourceId,
      target_id: targetId,
      kind,
      created_at: new Date().toISOString(),
    }),
  }))[0]
}

async function callTool(name: string, args: JsonObject, authorization: string, userId: string) {
  switch (name) {
    case 'find_objects': return findObjects(args, authorization)
    case 'get_object': return getObject(args, authorization)
    case 'create_object': return createObject(args, authorization, userId)
    case 'update_object': return updateObject(args, authorization)
    case 'link_objects': return linkObjects(args, authorization, userId)
    default: throw new Error(`Unknown tool: ${name}`)
  }
}

function protectedResourceMetadata() {
  return {
    resource: MCP_URL,
    authorization_servers: [AUTH_ISSUER],
    scopes_supported: ['openid', 'email', 'profile', 'offline_access'],
    resource_documentation: 'https://life.lakekim.com',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (new URL(req.url).pathname.endsWith('/.well-known/oauth-protected-resource')) {
    return json(protectedResourceMetadata())
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authorization = bearer(req)
  const user = authorization ? await getUser(authorization) : null
  if (!authorization || !user) {
    return json(
      { error: 'unauthorized' },
      401,
      { 'WWW-Authenticate': `Bearer resource_metadata="${MCP_URL}/.well-known/oauth-protected-resource"` },
    )
  }

  let request: JsonObject
  try {
    request = await req.json()
  } catch {
    return rpcError(null, -32700, 'Parse error')
  }

  const id = request.id ?? null
  if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    return rpcError(id, -32600, 'Invalid Request')
  }
  if (request.id === undefined) return new Response(null, { status: 202 })

  if (request.method === 'initialize') {
    return rpc(id, {
      protocolVersion: '2025-11-25',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'life', version: '1.0.0' },
      instructions: 'Use LIFE as the user’s connected Personal Life OS. Read before writing when identity is ambiguous. Preserve links between related objects. Never invent stored facts.',
    })
  }
  if (request.method === 'ping') return rpc(id, {})
  if (request.method === 'tools/list') return rpc(id, { tools })
  if (request.method !== 'tools/call') return rpcError(id, -32601, 'Method not found')

  const params = request.params as JsonObject | undefined
  if (!params || typeof params.name !== 'string') return rpcError(id, -32602, 'Invalid tool call')
  const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
    ? params.arguments as JsonObject
    : {}
  try {
    const result = await callTool(params.name, args, authorization, user.id)
    return rpc(id, {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool call failed'
    return rpc(id, { content: [{ type: 'text', text: message }], isError: true })
  }
})
