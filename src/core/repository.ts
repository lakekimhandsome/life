import { db } from './db'
import { createId } from './id'
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

export async function listObjects(type?: ObjectType): Promise<LifeObject[]> {
  const collection = type
    ? db.objects.where('type').equals(type)
    : db.objects.toCollection()
  const items = await collection.toArray()
  return items.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  )
}

export async function getObject(id: string): Promise<LifeObject | undefined> {
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
  await db.objects.add(object)
  return object
}

export async function updateObject(
  id: string,
  input: UpdateObjectInput,
): Promise<LifeObject | undefined> {
  const existing = await db.objects.get(id)
  if (!existing) return undefined

  const next: LifeObject = {
    ...existing,
    title: input.title?.trim() ?? existing.title,
    body: input.body !== undefined ? input.body.trim() : existing.body,
    occurredAt: input.occurredAt ?? existing.occurredAt,
    meta: input.meta ?? existing.meta,
    updatedAt: nowIso(),
  }
  await db.objects.put(next)
  return next
}

export async function deleteObject(id: string): Promise<void> {
  await db.transaction('rw', db.objects, db.relationships, async () => {
    await db.relationships.where('sourceId').equals(id).delete()
    await db.relationships.where('targetId').equals(id).delete()
    await db.objects.delete(id)
  })
}

export async function listRelationshipsFor(
  objectId: string,
): Promise<Relationship[]> {
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
  await db.relationships.delete(id)
}

export async function countByType(): Promise<Record<ObjectType, number>> {
  const objects = await db.objects.toArray()
  const counts: Record<ObjectType, number> = {
    journal: 0,
    project: 0,
    workout: 0,
    study: 0,
    goal: 0,
    asset: 0,
  }
  for (const object of objects) {
    counts[object.type] += 1
  }
  return counts
}
