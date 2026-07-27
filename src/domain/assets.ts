import type { LifeObject } from '../core/types'
import {
  fetchFxRate,
  fetchMetalPriceUsd,
  fetchStockPriceUsd,
} from '../lib/alphavantage'

export type AssetKind = 'cash' | 'stock' | 'commodity'

export const ASSET_KIND_LABEL: Record<AssetKind, string> = {
  cash: '현금',
  stock: '주식',
  commodity: '물질',
}

export const ASSET_KIND_ORDER: AssetKind[] = ['cash', 'stock', 'commodity']

export interface ValuedAsset {
  object: LifeObject
  kind: AssetKind
  symbol: string
  quantity: number
  unitPriceKrw: number | null
  valueKrw: number | null
  error?: string
}

export function getAssetKind(object: LifeObject): AssetKind | null {
  const kind = object.meta.kind
  if (kind === 'cash' || kind === 'stock' || kind === 'commodity') return kind
  return null
}

export function getAssetQuantity(object: LifeObject): number {
  const quantity = object.meta.quantity
  return typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : 0
}

export function getAssetSymbol(object: LifeObject): string {
  const symbol = object.meta.symbol
  return typeof symbol === 'string' ? symbol.trim().toUpperCase() : ''
}

export function formatKrw(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(Math.round(value))
}

/** Troy ounce → grams (Alpha Vantage metal spot is USD / oz). */
const GRAMS_PER_TROY_OUNCE = 31.1034768

export function formatQuantity(kind: AssetKind, quantity: number, symbol: string): string {
  const amount = new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 6,
  }).format(quantity)

  if (kind === 'cash') return `${amount} ${symbol}`
  if (kind === 'commodity') return `${amount} g`
  return `${amount}주`
}

async function unitPriceKrw(kind: AssetKind, symbol: string): Promise<number> {
  if (kind === 'cash') {
    return fetchFxRate(symbol || 'KRW', 'KRW')
  }

  if (kind === 'stock') {
    const [priceUsd, usdKrw] = await Promise.all([
      fetchStockPriceUsd(symbol),
      fetchFxRate('USD', 'KRW'),
    ])
    return priceUsd * usdKrw
  }

  const metal = symbol === 'SILVER' ? 'SILVER' : 'GOLD'
  const [priceUsd, usdKrw] = await Promise.all([
    fetchMetalPriceUsd(metal),
    fetchFxRate('USD', 'KRW'),
  ])
  return (priceUsd * usdKrw) / GRAMS_PER_TROY_OUNCE
}

export async function valueAssets(objects: LifeObject[]): Promise<ValuedAsset[]> {
  const results: ValuedAsset[] = []

  for (const object of objects) {
    const kind = getAssetKind(object)
    const symbol = getAssetSymbol(object)
    const quantity = getAssetQuantity(object)

    if (!kind || !symbol || quantity <= 0) {
      results.push({
        object,
        kind: kind ?? 'cash',
        symbol,
        quantity,
        unitPriceKrw: null,
        valueKrw: null,
        error: '자산 정보가 불완전합니다.',
      })
      continue
    }

    try {
      const unit = await unitPriceKrw(kind, symbol)
      results.push({
        object,
        kind,
        symbol,
        quantity,
        unitPriceKrw: unit,
        valueKrw: unit * quantity,
      })
    } catch (error) {
      results.push({
        object,
        kind,
        symbol,
        quantity,
        unitPriceKrw: null,
        valueKrw: null,
        error: error instanceof Error ? error.message : '시세 조회 실패',
      })
    }
  }

  return results
}
