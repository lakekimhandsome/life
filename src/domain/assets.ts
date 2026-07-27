import type { LifeObject } from '../core/types'
import {
  fetchFxRate,
  fetchMetalPriceUsd,
  fetchStockPriceUsd,
  seedQuoteCache,
} from '../lib/alphavantage'
import { getMarketQuotes } from '../lib/marketQuotes'

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

/** KRW 현금처럼 외부 시세/환율 없이 바로 환산 가능한지. */
export function needsMarketPrice(kind: AssetKind, symbol: string): boolean {
  if (kind === 'cash') {
    return (symbol || 'KRW').toUpperCase() !== 'KRW'
  }
  return true
}

export function assetNeedsMarketPrice(object: LifeObject): boolean {
  const kind = getAssetKind(object)
  const symbol = getAssetSymbol(object)
  if (!kind || !symbol || getAssetQuantity(object) <= 0) return false
  return needsMarketPrice(kind, symbol)
}

/** 자산 평가에 필요한 life_market_quotes cache_key 목록. */
export function quoteKeysForAsset(kind: AssetKind, symbol: string): string[] {
  const code = (symbol || '').trim().toUpperCase()
  if (!code) return []

  if (kind === 'cash') {
    if (code === 'KRW') return []
    return [`fx:${code}:KRW`]
  }

  if (kind === 'stock') {
    return [`stock:${code}`, 'fx:USD:KRW']
  }

  const metal = code === 'SILVER' ? 'SILVER' : 'GOLD'
  return [`metal:${metal}`, 'fx:USD:KRW']
}

export function requiredQuoteKeys(objects: LifeObject[]): string[] {
  const keys = new Set<string>()
  for (const object of objects) {
    const kind = getAssetKind(object)
    const symbol = getAssetSymbol(object)
    if (!kind || !symbol || getAssetQuantity(object) <= 0) continue
    if (!needsMarketPrice(kind, symbol)) continue
    for (const key of quoteKeysForAsset(kind, symbol)) keys.add(key)
  }
  return [...keys]
}

function incompleteAsset(
  object: LifeObject,
  kind: AssetKind | null,
  symbol: string,
  quantity: number,
): ValuedAsset {
  return {
    object,
    kind: kind ?? 'cash',
    symbol,
    quantity,
    unitPriceKrw: null,
    valueKrw: null,
    error: '자산 정보가 불완전합니다.',
  }
}

/** 시세 없이 바로 표시할 수 있는 자산(KRW 현금 등). 불가하면 null. */
export function valueAssetLocally(object: LifeObject): ValuedAsset | null {
  const kind = getAssetKind(object)
  const symbol = getAssetSymbol(object)
  const quantity = getAssetQuantity(object)

  if (!kind || !symbol || quantity <= 0) return null
  if (needsMarketPrice(kind, symbol)) return null

  return {
    object,
    kind,
    symbol,
    quantity,
    unitPriceKrw: 1,
    valueKrw: quantity,
  }
}

/** 시세 조회 전에 자산 행을 먼저 보여주기 위한 스냅샷. 평가금은 로컬 환산 가능한 것만 채움. */
export function assetsSnapshot(objects: LifeObject[]): ValuedAsset[] {
  const results: ValuedAsset[] = []

  for (const object of objects) {
    const kind = getAssetKind(object)
    const symbol = getAssetSymbol(object)
    const quantity = getAssetQuantity(object)

    if (!kind || !symbol || quantity <= 0) {
      results.push(incompleteAsset(object, kind, symbol, quantity))
      continue
    }

    const local = valueAssetLocally(object)
    results.push(
      local ?? {
        object,
        kind,
        symbol,
        quantity,
        unitPriceKrw: null,
        valueKrw: null,
      },
    )
  }

  return results
}

function unitPriceFromQuotes(
  kind: AssetKind,
  symbol: string,
  quotes: Map<string, number>,
): number | null {
  if (kind === 'cash') {
    const code = symbol || 'KRW'
    if (code.toUpperCase() === 'KRW') return 1
    return quotes.get(`fx:${code}:KRW`) ?? null
  }

  if (kind === 'stock') {
    const priceUsd = quotes.get(`stock:${symbol}`)
    const usdKrw = quotes.get('fx:USD:KRW')
    if (priceUsd === undefined || usdKrw === undefined) return null
    return priceUsd * usdKrw
  }

  const metal = symbol === 'SILVER' ? 'SILVER' : 'GOLD'
  const priceUsd = quotes.get(`metal:${metal}`)
  const usdKrw = quotes.get('fx:USD:KRW')
  if (priceUsd === undefined || usdKrw === undefined) return null
  return (priceUsd * usdKrw) / GRAMS_PER_TROY_OUNCE
}

/** 당일 DB 시세로 바로 평가. 필요한 키가 하나라도 없으면 null. */
export function valueAssetsFromQuotes(
  objects: LifeObject[],
  quotes: Map<string, number>,
): ValuedAsset[] | null {
  const keys = requiredQuoteKeys(objects)
  if (keys.some((key) => !quotes.has(key))) return null

  const results: ValuedAsset[] = []
  for (const object of objects) {
    const kind = getAssetKind(object)
    const symbol = getAssetSymbol(object)
    const quantity = getAssetQuantity(object)

    if (!kind || !symbol || quantity <= 0) {
      results.push(incompleteAsset(object, kind, symbol, quantity))
      continue
    }

    const local = valueAssetLocally(object)
    if (local) {
      results.push(local)
      continue
    }

    const unit = unitPriceFromQuotes(kind, symbol, quotes)
    if (unit === null) return null

    results.push({
      object,
      kind,
      symbol,
      quantity,
      unitPriceKrw: unit,
      valueKrw: unit * quantity,
    })
  }
  return results
}

/**
 * 당일 DB에 필요한 시세가 모두 있으면 즉시 평가하고,
 * 없으면 null을 반환해 호출측에서 API 로드를 진행한다.
 */
export async function valueAssetsFromTodayCache(
  objects: LifeObject[],
): Promise<ValuedAsset[] | null> {
  const keys = requiredQuoteKeys(objects)
  if (keys.length === 0) {
    return valueAssetsFromQuotes(objects, new Map())
  }

  const quotes = await getMarketQuotes(keys)
  const valued = valueAssetsFromQuotes(objects, quotes)
  if (!valued) return null

  seedQuoteCache(quotes)
  return valued
}

async function unitPriceKrw(kind: AssetKind, symbol: string): Promise<number> {
  if (kind === 'cash') {
    const code = symbol || 'KRW'
    if (code.toUpperCase() === 'KRW') return 1
    return fetchFxRate(code, 'KRW')
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
      results.push(incompleteAsset(object, kind, symbol, quantity))
      continue
    }

    const local = valueAssetLocally(object)
    if (local) {
      results.push(local)
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
