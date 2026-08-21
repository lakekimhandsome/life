import { createId } from '../core/id'
import {
  summarizeAssetValues,
  type AssetHistoryRange,
  type AssetValueBreakdown,
  daysForRange,
} from '../domain/assetHistory'
import type { ValuedAsset } from '../domain/assets'
import { addLocalDays, startOfLocalDay, toLocalDayKey } from './format'
import type { AssetHistoryRow } from './database'
import { isSupabaseConfigured, supabase } from './supabase'

export interface AssetHistoryPoint {
  id: string
  recordedAt: string
  total: number
  cash: number
  stock: number
  material: number
  crypto: number
  kindValues: Record<string, number>
}

function rowToPoint(row: AssetHistoryRow): AssetHistoryPoint {
  return {
    id: row.id,
    recordedAt: row.recorded_at,
    total: row.total_value,
    cash: row.cash_value,
    stock: row.stock_value,
    material: row.material_value,
    crypto: row.crypto_value,
    kindValues: row.kind_values ?? {},
  }
}

function rangeStartKey(range: AssetHistoryRange, today = new Date()): string | null {
  const days = daysForRange(range)
  if (days === null) return null
  return toLocalDayKey(addLocalDays(startOfLocalDay(today), -(days - 1)))
}

/** Load snapshots for a period, oldest → newest. */
export async function listAssetHistory(
  range: AssetHistoryRange,
): Promise<AssetHistoryPoint[]> {
  if (!isSupabaseConfigured()) return []

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return []

  let query = supabase
    .from('asset_history')
    .select('*')
    .eq('user_id', session.user.id)
    .order('recorded_at', { ascending: true })

  const from = rangeStartKey(range)
  if (from) query = query.gte('recorded_at', from)

  const { data, error } = await query
  if (error) {
    console.warn('asset_history read failed', error.message)
    return []
  }

  return (data ?? []).map(rowToPoint)
}

export async function hasAssetHistoryForDay(dayKey: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return false

  const { data, error } = await supabase
    .from('asset_history')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('recorded_at', dayKey)
    .maybeSingle()

  if (error) {
    console.warn('asset_history day check failed', error.message)
    return false
  }

  return Boolean(data)
}

async function insertAssetHistory(
  dayKey: string,
  breakdown: AssetValueBreakdown,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return false

  const row: AssetHistoryRow = {
    id: createId(),
    user_id: session.user.id,
    recorded_at: dayKey,
    total_value: breakdown.total,
    cash_value: breakdown.cash,
    stock_value: breakdown.stock,
    material_value: breakdown.material,
    crypto_value: breakdown.crypto,
    kind_values: breakdown.kindValues,
    created_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('asset_history').insert(row)
  if (error) {
    // Unique violation = already snapshotted today — treat as success.
    if (error.code === '23505') return true
    console.warn('asset_history insert failed', error.message)
    return false
  }

  return true
}

export async function deleteAssetHistory(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('저장소가 설정되지 않았습니다.')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('로그인이 필요합니다.')
  }

  const { error } = await supabase
    .from('asset_history')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id)

  if (error) {
    throw new Error(error.message || '기록을 삭제하지 못했습니다.')
  }
}

/**
 * Once per local calendar day: persist the first fully-valued portfolio snapshot.
 * No-ops if assets are incomplete, empty, or today's row already exists.
 */
export async function ensureDailyAssetSnapshot(
  items: ValuedAsset[],
): Promise<void> {
  const breakdown = summarizeAssetValues(items)
  if (!breakdown) return

  const dayKey = toLocalDayKey(new Date())
  if (await hasAssetHistoryForDay(dayKey)) return
  await insertAssetHistory(dayKey, breakdown)
}
