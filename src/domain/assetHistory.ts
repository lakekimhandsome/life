import type { ValuedAsset } from './assets'
import { ASSET_KIND_ORDER, summarizePortfolio, type AssetKind } from './assets'

/** Known snapshot columns / chart series beyond total. */
export type AssetHistoryKindKey = AssetKind | 'crypto'

export interface AssetValueBreakdown {
  /** 순자산 (총자산 − 부채). */
  total: number
  cash: number
  stock: number
  /** Domain kind `commodity` → DB column `material_value`. */
  material: number
  crypto: number
  /** Flexible map keyed by AssetKind (+ future kinds like crypto). */
  kindValues: Record<string, number>
}

export function isFullyValued(items: ValuedAsset[]): boolean {
  return items.length > 0 && items.every((item) => item.valueKrw !== null)
}

/** Sum valued assets into net worth + per-kind amounts for a daily snapshot. */
export function summarizeAssetValues(items: ValuedAsset[]): AssetValueBreakdown | null {
  if (!isFullyValued(items)) return null

  const kindValues: Record<string, number> = {}
  for (const kind of ASSET_KIND_ORDER) kindValues[kind] = 0
  kindValues.crypto = 0

  for (const item of items) {
    const value = item.valueKrw ?? 0
    kindValues[item.kind] = (kindValues[item.kind] ?? 0) + value
  }

  const { netAssetsKrw } = summarizePortfolio(items)

  return {
    total: netAssetsKrw,
    cash: kindValues.cash ?? 0,
    stock: kindValues.stock ?? 0,
    material: kindValues.commodity ?? 0,
    crypto: kindValues.crypto ?? 0,
    kindValues,
  }
}

export type AssetHistoryRange = '1w' | '1m' | '3m' | '1y' | 'all'

export const ASSET_HISTORY_RANGE_OPTIONS: { value: AssetHistoryRange; label: string }[] = [
  { value: '1w', label: '1주' },
  { value: '1m', label: '1개월' },
  { value: '3m', label: '3개월' },
  { value: '1y', label: '1년' },
  { value: 'all', label: '전체' },
]

export function daysForRange(range: AssetHistoryRange): number | null {
  if (range === '1w') return 7
  if (range === '1m') return 30
  if (range === '3m') return 90
  if (range === '1y') return 365
  return null
}

export interface AssetHistoryChange {
  current: number
  previous: number | null
  amount: number | null
  percent: number | null
}

/** Period change from first → last point in the selected series. */
export function computeHistoryChange(
  points: { total: number }[],
): AssetHistoryChange {
  if (points.length === 0) {
    return { current: 0, previous: null, amount: null, percent: null }
  }

  const current = points[points.length - 1].total
  if (points.length === 1) {
    return { current, previous: null, amount: null, percent: null }
  }

  const previous = points[0].total
  const amount = current - previous
  const percent = previous === 0 ? null : (amount / previous) * 100
  return { current, previous, amount, percent }
}

export function formatSignedKrw(value: number): string {
  const abs = new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(Math.round(Math.abs(value)))
  if (value > 0) return `+${abs}`
  if (value < 0) return `-${abs}`
  return abs
}

export function formatSignedPercent(value: number): string {
  const abs = Math.abs(value).toFixed(1)
  if (value > 0) return `+${abs}%`
  if (value < 0) return `-${abs}%`
  return `${abs}%`
}
