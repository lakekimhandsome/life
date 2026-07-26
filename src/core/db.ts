import Dexie, { type EntityTable } from 'dexie'
import type { LifeObject, Relationship } from './types'

export class LifeDatabase extends Dexie {
  objects!: EntityTable<LifeObject, 'id'>
  relationships!: EntityTable<Relationship, 'id'>

  constructor() {
    super('life_os')
    this.version(1).stores({
      objects: 'id, type, occurredAt, createdAt, updatedAt',
      relationships: 'id, sourceId, targetId, kind, createdAt',
    })
  }
}

export const db = new LifeDatabase()
