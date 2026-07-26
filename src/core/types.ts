export const OBJECT_TYPES = [
  'journal',
  'project',
  'workout',
  'study',
  'goal',
] as const

export type ObjectType = (typeof OBJECT_TYPES)[number]

export const RELATIONSHIP_KINDS = ['related', 'supports', 'part_of'] as const

export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number]

/** Every unit of life shares this shape. Type-specific data lives in `meta`. */
export interface LifeObject {
  id: string
  type: ObjectType
  title: string
  body: string
  /** When this happened in the user's life (ISO datetime). */
  occurredAt: string
  createdAt: string
  updatedAt: string
  meta: Record<string, string | number | boolean | null>
}

/** First-class link between any two life objects. */
export interface Relationship {
  id: string
  sourceId: string
  targetId: string
  kind: RelationshipKind
  createdAt: string
}

export interface CreateObjectInput {
  type: ObjectType
  title: string
  body?: string
  occurredAt?: string
  meta?: LifeObject['meta']
}

export interface UpdateObjectInput {
  title?: string
  body?: string
  occurredAt?: string
  meta?: LifeObject['meta']
}
