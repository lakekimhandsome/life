import { db } from './db'
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

async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

function emptyCounts(): Record<ObjectType, number> {
  return {
    journal: 0,
    project: 0,
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
  const userId = await currentUserId()
  if (userId) {
    let query = supabase.from('life_objects').select('*').eq('user_id', userId)
    if (type) query = query.eq('type', type)
    const { data, error } = await query.order('occurred_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(rowToObject)
  }

  const collection = type
    ? db.objects.where('type').equals(type)
    : db.objects.toCollection()
  const items = await collection.toArray()
  return items.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  )
}

export async function getObject(id: string): Promise<LifeObject | undefined> {
  const userId = await currentUserId()
  if (userId) {
    const { data, error } = await supabase
      .from('life_objects')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? rowToObject(data) : undefined
  }

  return db.objects.get(id)
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

  const userId = await currentUserId()
  if (userId) {
    const { error } = await supabase
      .from('life_objects')
      .insert(objectToRow(object, userId))
    if (error) throw error
    return object
  }

  await db.objects.add(object)
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

  const userId = await currentUserId()
  if (userId) {
    const { error } = await supabase
      .from('life_objects')
      .update(objectToRow(next, userId))
      .eq('user_id', userId)
      .eq('id', id)
    if (error) throw error
    return next
  }

  await db.objects.put(next)
  return next
}

export async function deleteObject(id: string): Promise<void> {
  const userId = await currentUserId()
  if (userId) {
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
    return
  }

  await db.transaction('rw', db.objects, db.relationships, async () => {
    await db.relationships.where('sourceId').equals(id).delete()
    await db.relationships.where('targetId').equals(id).delete()
    await db.objects.delete(id)
  })
}

export async function listRelationshipsFor(
  objectId: string,
): Promise<Relationship[]> {
  const userId = await currentUserId()
  if (userId) {
    const { data, error } = await supabase
      .from('life_relationships')
      .select('*')
      .eq('user_id', userId)
      .or(`source_id.eq.${objectId},target_id.eq.${objectId}`)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(rowToRelationship)
  }

  const asSource = await db.relationships.where('sourceId').equals(objectId).toArray()
  const asTarget = await db.relationships.where('targetId').equals(objectId).toArray()
  const byId = new Map<string, Relationship>()
  for (const rel of [...asSource, ...asTarget]) {
    byId.set(rel.id, rel)
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function createRelationship(input: {
  sourceId: string
  targetId: string
  kind: RelationshipKind
}): Promise<Relationship> {
  if (input.sourceId === input.targetId) {
    throw new Error('Cannot relate an object to itself')
  }

  const userId = await currentUserId()
  if (userId) {
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

  const existing = await db.relationships
    .where('sourceId')
    .equals(input.sourceId)
    .filter(
      (rel) => rel.targetId === input.targetId && rel.kind === input.kind,
    )
    .first()

  if (existing) return existing

  const relationship: Relationship = {
    id: createId(),
    sourceId: input.sourceId,
    targetId: input.targetId,
    kind: input.kind,
    createdAt: nowIso(),
  }
  await db.relationships.add(relationship)
  return relationship
}

export async function deleteRelationship(id: string): Promise<void> {
  const userId = await currentUserId()
  if (userId) {
    const { error } = await supabase
      .from('life_relationships')
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
    if (error) throw error
    return
  }

  await db.relationships.delete(id)
}

export async function countByType(): Promise<Record<ObjectType, number>> {
  const objects = await listObjects()
  return countObjects(objects)
}

/** Upload local IndexedDB data once when the cloud account is empty. */
export async function migrateLocalToCloudIfNeeded(): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return

  const { count, error: countError } = await supabase
    .from('life_objects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (countError) throw countError
  if ((count ?? 0) > 0) return

  const [localObjects, localRelationships] = await Promise.all([
    db.objects.toArray(),
    db.relationships.toArray(),
  ])
  if (localObjects.length === 0) return

  const { error: objectsError } = await supabase
    .from('life_objects')
    .insert(localObjects.map((object) => objectToRow(object, userId)))
  if (objectsError) throw objectsError

  if (localRelationships.length > 0) {
    const { error: relationshipsError } = await supabase
      .from('life_relationships')
      .insert(
        localRelationships.map((relationship) =>
          relationshipToRow(relationship, userId),
        ),
      )
    if (relationshipsError) throw relationshipsError
  }
}
