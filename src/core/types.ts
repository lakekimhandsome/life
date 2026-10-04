export const OBJECT_TYPES = [
  'journal',
  'project',
  'note',
  'workout',
  'plan',
  'goal',
  'asset',
] as const

export type ObjectType = (typeof OBJECT_TYPES)[number]

export const OBJECT_VISIBILITIES = ['private', 'unlisted'] as const

export type ObjectVisibility = (typeof OBJECT_VISIBILITIES)[number]

export const SHAREABLE_OBJECT_TYPES = ['journal', 'project', 'note'] as const

export type ShareableObjectType = (typeof SHAREABLE_OBJECT_TYPES)[number]

export function isShareableObjectType(type: ObjectType): type is ShareableObjectType {
  return (SHAREABLE_OBJECT_TYPES as readonly ObjectType[]).includes(type)
}

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
  visibility: ObjectVisibility
  shareToken: string | null
  meta: Record<string, string | number | boolean | null>
}

export interface SharedLifeObject {
  type: ShareableObjectType
  title: string
  body: string
  occurredAt: string
  createdAt: string
  updatedAt: string
  meta: LifeObject['meta']
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
  visibility?: ObjectVisibility
  meta?: LifeObject['meta']
}
