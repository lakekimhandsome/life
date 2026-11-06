import { withMergedMeta } from './update.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const MCP_URL = `${SUPABASE_URL}/functions/v1/life-mcp`
const AUTH_ISSUER = `${SUPABASE_URL}/auth/v1`
const OBJECT_TYPES = ['journal', 'project', 'note', 'plan', 'goal', 'asset'] as const
const OBJECT_TYPE_FILTER = `in.(${OBJECT_TYPES.join(',')})`
const RELATIONSHIP_KINDS = ['related', 'supports', 'part_of'] as const
const OBJECT_COLUMNS = 'id,type,title,body,occurred_at,created_at,updated_at,meta,visibility,folder_id'

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
        before: { type: 'string', description: 'Pass nextBefore from the preceding response unchanged. Legacy ISO date-time cursors are accepted.' },
        folderId: { type: ['string', 'null'], description: 'Filter notes by folder; null selects notes at the root.' },
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
    description: 'Create a journal, project, note, plan, goal, or asset in LIFE.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: OBJECT_TYPES },
        title: { type: 'string', minLength: 1 },
        body: { type: 'string', default: '' },
        folderId: { type: ['string', 'null'], description: 'Note folder ID; omit or use null for root.' },
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
    description: 'Update an existing LIFE object in the signed-in account. Supply the exact updated_at from your last read as expectedUpdatedAt; a conflict leaves the stored record unchanged. On conflict, read again and reconcile your edit; never retry a stale replacement body unchanged. Omitted top-level fields stay unchanged. A supplied body replaces the entire body; read the current object and retain its content when making a partial edit. Supplied meta keys are shallow-merged; omitted meta keys stay unchanged, and an empty meta object does not change meta.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        expectedUpdatedAt: { type: 'string', description: 'Exact updated_at returned by the last read. Required to prevent overwriting another edit.' },
        folderId: { type: ['string', 'null'], description: 'Move a note to this folder; null moves it to root.' },
        title: { type: 'string', minLength: 1 },
        body: { type: 'string', description: 'Complete replacement Markdown body, preserved verbatim. Omit to leave the body unchanged.' },
        occurredAt: { type: 'string', format: 'date-time' },
        meta: {
          type: 'object',
          description: 'Keys to shallow-merge into the existing meta object. Omitted keys stay unchanged; an empty object changes nothing. Null is stored as a value and does not delete a key.',
          additionalProperties: true,
        },
      },
      required: ['id', 'expectedUpdatedAt'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'delete_object',
    description: 'Delete one LIFE object. Journals, projects, notes, and goals move to trash; use list_deleted_objects and restore_object to inspect or recover them with their links. Plans and assets are permanently deleted. This tool does not permanently erase items from trash.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
  {
    name: 'list_deleted_objects',
    description: 'List the signed-in user’s trash, newest deletion first, with the archived object contents. Only journals, projects, notes, and goals enter trash; permanently deleted plans and assets cannot be listed or restored.',
    inputSchema: {
      type: 'object',
      properties: {
        before: { type: 'string', description: 'Pass nextBefore from the preceding trash response unchanged.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'restore_object',
    description: 'Restore one object from the signed-in user’s trash by its archived ID. Restored objects are private, with sharing disabled. If its note folder no longer exists, it returns to the root. Saved relationships return when both endpoints exist. Permanently erased items cannot be restored.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
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
  {
    name: 'list_note_folders', description: 'List all note folders, including parent IDs, in the signed-in account.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'create_note_folder', description: 'Create a note folder, optionally inside another folder.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', minLength: 1, maxLength: 200 }, parentId: { type: ['string', 'null'] } }, required: ['name'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'unlink_objects', description: 'Remove one relationship by its ID, without deleting either object.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
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

function objectType(value: unknown) {
  const type = requiredString(value, 'type')
  const normalized = type === 'study' ? 'plan' : type
  if (!OBJECT_TYPES.includes(normalized as typeof OBJECT_TYPES[number])) {
    throw new Error('Invalid object type')
  }
  return normalized
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

function nullableFolder(value: unknown) {
  if (value === undefined || value === null) return value
  const id = requiredString(value, 'folderId')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid folder ID')
  return id
}

function paginationFilter(value: unknown, params: URLSearchParams, column: 'occurred_at' | 'deleted_at') {
  if (value === undefined) return null
  const before = requiredString(value, 'before')
  if (!Number.isNaN(Date.parse(before))) {
    params.set(column, `lt.${optionalIso(before, 'before')}`)
    return null
  }
  let cursor: JsonObject
  try { cursor = JSON.parse(atob(before)) } catch { throw new Error('Invalid pagination cursor') }
  const timestamp = cursor && (column === 'occurred_at' ? cursor.occurredAt : cursor.deletedAt)
  if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp)) || typeof cursor.id !== 'string') throw new Error('Invalid pagination cursor')
  const time = JSON.stringify(timestamp)
  return `or(${column}.lt.${time},and(${column}.eq.${time},id.lt.${JSON.stringify(cursor.id)}))`
}

async function listDeletedObjects(args: JsonObject, authorization: string, userId: string) {
  const limit = Math.min(50, Math.max(1, Math.trunc(Number(args.limit) || 20)))
  const params = new URLSearchParams({ select: 'id,deleted_at,object_data', user_id: `eq.${userId}`, order: 'deleted_at.desc,id.desc', limit: String(limit + 1) })
  const before = paginationFilter(args.before, params, 'deleted_at')
  if (before) params.set('and', `(${before})`)
  const rows = await rest(`life_deleted_objects?${params}`, authorization)
  const page = rows.slice(0, limit)
  const last = page.at(-1)
  return {
    objects: page.map((row: JsonObject) => ({
      id: row.id,
      deletedAt: row.deleted_at,
      object: Object.fromEntries(OBJECT_COLUMNS.split(',').map((column) => [column, (row.object_data as JsonObject)[column]])),
    })),
    nextBefore: rows.length > limit && last ? btoa(JSON.stringify({ deletedAt: last.deleted_at, id: last.id })) : null,
  }
}

async function findObjects(args: JsonObject, authorization: string) {
  const limit = Math.min(50, Math.max(1, Math.trunc(Number(args.limit) || 20)))
  const query = typeof args.query === 'string' ? args.query.trim() : ''
  const type = args.type === undefined ? undefined : objectType(args.type)
  const params = new URLSearchParams({ select: OBJECT_COLUMNS, type: OBJECT_TYPE_FILTER, order: 'occurred_at.desc,id.desc', limit: String(limit + 1) })
  if (type) params.set('type', `eq.${type}`)
  const folder = nullableFolder(args.folderId)
  if (folder !== undefined) {
    if (type && type !== 'note') throw new Error('Only notes can belong to folders')
    params.set('type', 'eq.note')
    params.set('folder_id', folder === null ? 'is.null' : `eq.${folder}`)
  }
  const filters: string[] = []
  const before = paginationFilter(args.before, params, 'occurred_at')
  if (before) filters.push(before)
  if (query) {
    const escaped = query.replace(/[\\%_*]/g, '\\$&')
    const pattern = JSON.stringify(`%${escaped}%`)
    filters.push(`or(title.ilike.${pattern},body.ilike.${pattern})`)
  }
  if (filters.length) params.set('and', `(${filters.join(',')})`)
  const rows = await rest(`life_objects?${params}`, authorization)
  const objects = rows.slice(0, limit)
  const last = objects.at(-1)
  return { objects, nextBefore: rows.length > limit && last ? btoa(JSON.stringify({ occurredAt: last.occurred_at, id: last.id })) : null }
}

async function getObject(args: JsonObject, authorization: string) {
  const id = requiredString(args.id, 'id')
  const objectParams = new URLSearchParams({ select: OBJECT_COLUMNS, type: OBJECT_TYPE_FILTER, id: `eq.${id}`, limit: '1' })
  const objects = await rest(`life_objects?${objectParams}`, authorization)
  if (!objects.length) throw new Error('LIFE object not found')
  const relationships = await rest(`life_relationships?${new URLSearchParams({ select: '*', or: `(source_id.eq.${JSON.stringify(id)},target_id.eq.${JSON.stringify(id)})`, order: 'created_at.desc' })}`, authorization)
  return {
    object: objects[0],
    relationships: relationships.filter((item: JsonObject) => item.source_id === id || item.target_id === id),
  }
}

async function createObject(args: JsonObject, authorization: string, userId: string) {
  const type = objectType(args.type)
  if (args.body !== undefined && typeof args.body !== 'string') throw new Error('body must be a string')
  if (args.folderId != null && type !== 'note') throw new Error('Only notes can belong to folders')
  const timestamp = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    user_id: userId,
    type,
    title: requiredString(args.title, 'title'),
    body: args.body === undefined ? '' : args.body,
    folder_id: nullableFolder(args.folderId) ?? null,
    occurred_at: optionalIso(args.occurredAt, 'occurredAt') ?? timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    meta: optionalMeta(args.meta) ?? {},
  }
  const params = new URLSearchParams({ select: OBJECT_COLUMNS })
  return (await rest(`life_objects?${params}`, authorization, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  }))[0]
}

async function updateObject(args: JsonObject, authorization: string) {
  const id = requiredString(args.id, 'id')
  const expected = requiredString(args.expectedUpdatedAt, 'expectedUpdatedAt')
  if (Number.isNaN(Date.parse(expected))) throw new Error('Invalid expectedUpdatedAt')
  let patch: JsonObject = { updated_at: new Date().toISOString() }
  if (args.folderId !== undefined) patch.folder_id = nullableFolder(args.folderId)
  if (args.title !== undefined) patch.title = requiredString(args.title, 'title')
  if (args.body !== undefined) {
    if (typeof args.body !== 'string') throw new Error('body must be a string')
    patch.body = args.body
  }
  if (args.occurredAt !== undefined) patch.occurred_at = optionalIso(args.occurredAt, 'occurredAt')
  const meta = optionalMeta(args.meta)
  if (Object.keys(patch).length === 1 && meta === undefined) throw new Error('Provide at least one field to update')
  if (meta !== undefined) {
    const currentParams = new URLSearchParams({ select: 'meta,updated_at', type: OBJECT_TYPE_FILTER, id: `eq.${id}`, updated_at: `eq.${expected}`, limit: '1' })
    const current = await rest(`life_objects?${currentParams}`, authorization)
    if (!current.length) throw new Error('Record changed or was deleted. Read it again before editing; your changes were not saved.')
    const value = current[0].meta
    const existingMeta = value && typeof value === 'object' && !Array.isArray(value)
      ? value as JsonObject
      : {}
    patch = withMergedMeta(patch, existingMeta, meta)
  }
  const params = new URLSearchParams({ select: OBJECT_COLUMNS, type: OBJECT_TYPE_FILTER, id: `eq.${id}`, updated_at: `eq.${expected}` })
  const rows = await rest(`life_objects?${params}`, authorization, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  if (!rows.length) throw new Error('Record changed or was deleted. Read it again before editing; your changes were not saved.')
  return rows[0]
}

async function deleteObject(args: JsonObject, authorization: string) {
  const id = requiredString(args.id, 'id')
  const params = new URLSearchParams({ select: OBJECT_COLUMNS, type: OBJECT_TYPE_FILTER, id: `eq.${id}` })
  const rows = await rest(`life_objects?${params}`, authorization, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
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

  const source = await rest(`life_objects?${new URLSearchParams({ select: 'id', type: OBJECT_TYPE_FILTER, id: `eq.${sourceId}`, limit: '1' })}`, authorization)
  const target = await rest(`life_objects?${new URLSearchParams({ select: 'id', type: OBJECT_TYPE_FILTER, id: `eq.${targetId}`, limit: '1' })}`, authorization)
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
    case 'list_note_folders': return { folders: await rest('life_note_folders?select=id,name,parent_id&order=name', authorization) }
    case 'create_note_folder': {
      const name = requiredString(args.name, 'name')
      if (name.length > 200) throw new Error('Folder name must be at most 200 characters')
      return (await rest('life_note_folders?select=id,name,parent_id', authorization, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ id: crypto.randomUUID(), user_id: userId, name, parent_id: nullableFolder(args.parentId) ?? null }) }))[0]
    }
    case 'unlink_objects': {
      const id = requiredString(args.id, 'id')
      await rest(`life_relationships?${new URLSearchParams({ id: `eq.${id}` })}`, authorization, { method: 'DELETE' })
      return { id, removed: true }
    }
    case 'list_deleted_objects': return listDeletedObjects(args, authorization, userId)
    case 'restore_object': {
      const id = requiredString(args.id, 'id')
      const restoredId = await rest('rpc/restore_deleted_life_object', authorization, { method: 'POST', body: JSON.stringify({ target_id: id }) })
      return { id: restoredId, restored: true }
    }
    case 'find_objects': return findObjects(args, authorization)
    case 'get_object': return getObject(args, authorization)
    case 'create_object': return createObject(args, authorization, userId)
    case 'update_object': return updateObject(args, authorization)
    case 'delete_object': return deleteObject(args, authorization)
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
  const authorization = bearer(req)
  const user = authorization ? await getUser(authorization) : null
  if (!authorization || !user) {
    return json(
      { error: 'unauthorized' },
      401,
      { 'WWW-Authenticate': `Bearer resource_metadata="${MCP_URL}/.well-known/oauth-protected-resource"` },
    )
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let request: JsonObject
  try {
    request = await req.json()
  } catch {
    return rpcError(null, -32700, 'Parse error')
  }

  if (!request || typeof request !== 'object' || Array.isArray(request)) return rpcError(null, -32600, 'Invalid Request')
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
      instructions: 'Use LIFE as the user’s connected Lake\'s Interface For Everything. Read before writing when identity is ambiguous. Preserve links between related objects. Never invent stored facts.',
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
  const callId = crypto.randomUUID()
  const tool = tools.find((tool) => tool.name === params.name)?.name ?? 'unknown'
  console.info(JSON.stringify({ event: 'life_mcp_call', callId, tool, outcome: 'received' }))
  try {
    const result = await callTool(params.name, args, authorization, user.id)
    console.info(JSON.stringify({ event: 'life_mcp_call', callId, tool, outcome: 'success' }))
    return rpc(id, {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    })
  } catch (error) {
    console.info(JSON.stringify({ event: 'life_mcp_call', callId, tool, outcome: 'error' }))
    const message = error instanceof Error ? error.message : 'Tool call failed'
    return rpc(id, { content: [{ type: 'text', text: message }], isError: true })
  }
})
