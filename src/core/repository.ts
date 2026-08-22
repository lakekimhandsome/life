import { createId } from './id'
import {
  objectToRow,
  relationshipToRow,
  rowToObject,
  rowToRelationship,
} from '../lib/database'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type {
  CreateObjectInput,
  LifeObject,
  ObjectType,
  Relationship,
  RelationshipKind,
  UpdateObjectInput,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}

async function requireUserId(): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }
  return userId
}

function emptyCounts(): Record<ObjectType, number> {
  return {
    journal: 0,
    project: 0,
    note: 0,
    workout: 0,
    study: 0,
    goal: 0,
    asset: 0,
  }
}

function countObjects(objects: LifeObject[]): Record<ObjectType, number> {
  const counts = emptyCounts()
  for (const object of objects) {
    counts[object.type] += 1
  }
  return counts
}

export async function listObjects(type?: ObjectType): Promise<LifeObject[]> {
  const userId = await requireUserId()
  let query = supabase.from('life_objects').select('*').eq('user_id', userId)
  if (type) query = query.eq('type', type)
  const { data, error } = await query.order('occurred_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToObject)
}

export async function getObject(id: string): Promise<LifeObject | undefined> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('life_objects')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? rowToObject(data) : undefined
}

export async function createObject(input: CreateObjectInput): Promise<LifeObject> {
  const timestamp = nowIso()
  const object: LifeObject = {
    id: createId(),
    type: input.type,
    title: input.title.trim(),
    body: (input.body ?? '').trim(),
    occurredAt: input.occurredAt ?? timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    meta: input.meta ?? {},
  }

  const userId = await requireUserId()
  const { error } = await supabase
    .from('life_objects')
    .insert(objectToRow(object, userId))
  if (error) throw error
  return object
}

export async function updateObject(
  id: string,
  input: UpdateObjectInput,
): Promise<LifeObject | undefined> {
  const existing = await getObject(id)
  if (!existing) return undefined

  const next: LifeObject = {
    ...existing,
    title: input.title?.trim() ?? existing.title,
    body: input.body !== undefined ? input.body.trim() : existing.body,
    occurredAt: input.occurredAt ?? existing.occurredAt,
    meta: input.meta ?? existing.meta,
    updatedAt: nowIso(),
  }

  const userId = await requireUserId()
  const { error } = await supabase
    .from('life_objects')
    .update(objectToRow(next, userId))
    .eq('user_id', userId)
    .eq('id', id)
  if (error) throw error
  return next
}

export async function deleteObject(id: string): Promise<void> {
  const userId = await requireUserId()
  const { error: relError } = await supabase
    .from('life_relationships')
    .delete()
    .eq('user_id', userId)
    .or(`source_id.eq.${id},target_id.eq.${id}`)
  if (relError) throw relError

  const { error } = await supabase
    .from('life_objects')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
  if (error) throw error
}

export async function listRelationshipsFor(
  objectId: string,
): Promise<Relationship[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('life_relationships')
    .select('*')
    .eq('user_id', userId)
    .or(`source_id.eq.${objectId},target_id.eq.${objectId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToRelationship)
}

export async function createRelationship(input: {
  sourceId: string
  targetId: string
  kind: RelationshipKind
}): Promise<Relationship> {
  if (input.sourceId === input.targetId) {
    throw new Error('Cannot relate an object to itself')
  }

  const userId = await requireUserId()
  const { data: existing, error: existingError } = await supabase
    .from('life_relationships')
    .select('*')
    .eq('user_id', userId)
    .eq('source_id', input.sourceId)
    .eq('target_id', input.targetId)
    .eq('kind', input.kind)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return rowToRelationship(existing)

  const relationship: Relationship = {
    id: createId(),
    sourceId: input.sourceId,
    targetId: input.targetId,
    kind: input.kind,
    createdAt: nowIso(),
  }
  const { error } = await supabase
    .from('life_relationships')
    .insert(relationshipToRow(relationship, userId))
  if (error) throw error
  return relationship
}

export async function deleteRelationship(id: string): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('life_relationships')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
  if (error) throw error
}

export async function countByType(): Promise<Record<ObjectType, number>> {
  const objects = await listObjects()
  return countObjects(objects)
}
