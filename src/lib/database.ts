import type { LifeObject, ObjectType, Relationship, RelationshipKind } from '../core/types'

export type LifeObjectRow = {
  id: string
  user_id: string
  type: ObjectType
  title: string
  body: string
  occurred_at: string
  created_at: string
  updated_at: string
  meta: LifeObject['meta']
}

export type LifeRelationshipRow = {
  id: string
  user_id: string
  source_id: string
  target_id: string
  kind: RelationshipKind
  created_at: string
}

export type MarketQuoteRow = {
  cache_key: string
  value: number
  fetched_on: string
  updated_at: string
}

export type AssetHistoryRow = {
  id: string
  user_id: string
  recorded_at: string
  total_value: number
  cash_value: number
  stock_value: number
  material_value: number
  crypto_value: number
  kind_values: Record<string, number>
  created_at: string
}

export type UserPrefsRow = {
  user_id: string
  prefs: Record<string, unknown>
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      life_objects: {
        Row: LifeObjectRow
        Insert: LifeObjectRow
        Update: Partial<LifeObjectRow>
        Relationships: []
      }
      life_relationships: {
        Row: LifeRelationshipRow
        Insert: LifeRelationshipRow
        Update: Partial<LifeRelationshipRow>
        Relationships: []
      }
      life_market_quotes: {
        Row: MarketQuoteRow
        Insert: MarketQuoteRow
        Update: Partial<MarketQuoteRow>
        Relationships: []
      }
      asset_history: {
        Row: AssetHistoryRow
        Insert: AssetHistoryRow
        Update: Partial<AssetHistoryRow>
        Relationships: []
      }
      life_user_prefs: {
        Row: UserPrefsRow
        Insert: UserPrefsRow
        Update: Partial<UserPrefsRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export function rowToObject(row: LifeObjectRow): LifeObject {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    meta: row.meta ?? {},
  }
}

export function objectToRow(object: LifeObject, userId: string): LifeObjectRow {
  return {
    id: object.id,
    user_id: userId,
    type: object.type,
    title: object.title,
    body: object.body,
    occurred_at: object.occurredAt,
    created_at: object.createdAt,
    updated_at: object.updatedAt,
    meta: object.meta,
  }
}

export function rowToRelationship(row: LifeRelationshipRow): Relationship {
  return {
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    kind: row.kind,
    createdAt: row.created_at,
  }
}

export function relationshipToRow(
  relationship: Relationship,
  userId: string,
): LifeRelationshipRow {
  return {
    id: relationship.id,
    user_id: userId,
    source_id: relationship.sourceId,
    target_id: relationship.targetId,
    kind: relationship.kind,
    created_at: relationship.createdAt,
  }
}
