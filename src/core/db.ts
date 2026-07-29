import Dexie, { type EntityTable } from 'dexie'
import type { LifeObject, Relationship } from './types'

export type PrefsRow = {
  key: string
  value: unknown
  updatedAt: string
}

export class LifeDatabase extends Dexie {
  objects!: EntityTable<LifeObject, 'id'>
  relationships!: EntityTable<Relationship, 'id'>
  prefs!: EntityTable<PrefsRow, 'key'>

  constructor() {
    super('life_os')
    this.version(1).stores({
      objects: 'id, type, occurredAt, createdAt, updatedAt',
      relationships: 'id, sourceId, targetId, kind, createdAt',
    })
    this.version(2).stores({
      objects: 'id, type, occurredAt, createdAt, updatedAt',
      relationships: 'id, sourceId, targetId, kind, createdAt',
      prefs: 'key, updatedAt',
    })
  }
}

export const db = new LifeDatabase()
