import { supabase } from './supabase'
import { marketDayKey } from './marketQuotes'

const memoryCache = new Map<string, { value: number; day: string }>()
const inflight = new Map<string, Promise<number>>()

export function seedQuoteCache(quotes: Map<string, number> | Record<string, number>) {
  for (const [key, value] of quotes instanceof Map ? quotes : Object.entries(quotes)) {
    if (Number.isFinite(value) && value > 0) memoryCache.set(key, { value, day: marketDayKey() })
  }
}

async function resolveQuote(key: string): Promise<number> {
  const cached = memoryCache.get(key)
  if (cached?.day === marketDayKey()) return cached.value
  const pending = inflight.get(key)
  if (pending) return pending
  const task = (async () => {
    const { data, error } = await supabase.rpc('get_life_market_quote', { p_cache_key: key })
    if (error) throw error
    if (typeof data !== 'number' || !Number.isFinite(data) || data <= 0) throw new Error('Invalid market quote')
    memoryCache.set(key, { value: data, day: marketDayKey() })
    return data
  })().finally(() => inflight.delete(key))
  inflight.set(key, task)
  return task
}

export function fetchStockPriceUsd(symbol: string): Promise<number> {
  return resolveQuote(`stock:${symbol.trim().toUpperCase()}`)
}

export function fetchMetalPriceUsd(symbol: 'GOLD' | 'SILVER'): Promise<number> {
  return resolveQuote(`metal:${symbol}`)
}

export function fetchFxRate(from: string, to: string): Promise<number> {
  const source = from.trim().toUpperCase()
  const target = to.trim().toUpperCase()
  return source === target ? Promise.resolve(1) : resolveQuote(`fx:${source}:${target}`)
}
