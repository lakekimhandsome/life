import { getMarketQuote, marketDayKey, saveMarketQuote } from './marketQuotes'

const API_BASE = 'https://www.alphavantage.co/query'
const MIN_GAP_MS = 12_000

type MemoryEntry = { value: number; day: string }

const memoryCache = new Map<string, MemoryEntry>()
const inflight = new Map<string, Promise<number>>()
let lastRequestAt = 0
let queue: Promise<void> = Promise.resolve()

function getApiKey(): string {
  const key = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY
  if (!key || typeof key !== 'string') {
    throw new Error('Alpha Vantage API 키가 없습니다. VITE_ALPHA_VANTAGE_API_KEY를 설정하세요.')
  }
  return key
}

function readMemory(key: string): number | null {
  const today = marketDayKey()
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (entry.day !== today) {
    memoryCache.delete(key)
    return null
  }
  return entry.value
}

function writeMemory(key: string, value: number) {
  memoryCache.set(key, { value, day: marketDayKey() })
}

async function throttle() {
  const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastRequestAt))
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequestAt = Date.now()
}

async function requestJson(params: Record<string, string>): Promise<unknown> {
  const run = queue.then(async () => {
    await throttle()
    const url = new URL(API_BASE)
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
    url.searchParams.set('apikey', getApiKey())

    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new Error(`시세 조회 실패 (${response.status})`)
    }
    return response.json() as Promise<unknown>
  })

  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** 당일 DB 캐시 → 없으면 API 호출 후 DB 저장. */
async function resolveQuote(
  cacheKey: string,
  fetchValue: () => Promise<number>,
): Promise<number> {
  const memory = readMemory(cacheKey)
  if (memory !== null) return memory

  const pending = inflight.get(cacheKey)
  if (pending) return pending

  const task = (async () => {
    const fromDb = await getMarketQuote(cacheKey)
    if (fromDb !== null) {
      writeMemory(cacheKey, fromDb)
      return fromDb
    }

    const value = await fetchValue()
    writeMemory(cacheKey, value)
    await saveMarketQuote(cacheKey, value)
    return value
  })().finally(() => {
    inflight.delete(cacheKey)
  })

  inflight.set(cacheKey, task)
  return task
}

export async function fetchStockPriceUsd(symbol: string): Promise<number> {
  const ticker = symbol.trim().toUpperCase()
  const cacheKey = `stock:${ticker}`

  return resolveQuote(cacheKey, async () => {
    const data = asRecord(await requestJson({ function: 'GLOBAL_QUOTE', symbol: ticker }))
    const quote = asRecord(data?.['Global Quote'])
    const price = parseNumber(quote?.['05. price'])
    if (price === null) {
      const note = typeof data?.Note === 'string' ? data.Note : null
      const info = typeof data?.Information === 'string' ? data.Information : null
      throw new Error(note ?? info ?? `${ticker} 주식 시세를 가져오지 못했습니다.`)
    }
    return price
  })
}

export async function fetchMetalPriceUsd(symbol: 'GOLD' | 'SILVER'): Promise<number> {
  const cacheKey = `metal:${symbol}`

  return resolveQuote(cacheKey, async () => {
    const data = asRecord(await requestJson({ function: 'GOLD_SILVER_SPOT', symbol }))
    const price = parseNumber(data?.price)
    if (price === null) {
      const note = typeof data?.Note === 'string' ? data.Note : null
      throw new Error(note ?? `${symbol} 시세를 가져오지 못했습니다.`)
    }
    return price
  })
}

export async function fetchFxRate(from: string, to: string): Promise<number> {
  const fromCode = from.trim().toUpperCase()
  const toCode = to.trim().toUpperCase()
  if (fromCode === toCode) return 1

  const cacheKey = `fx:${fromCode}:${toCode}`

  return resolveQuote(cacheKey, async () => {
    const data = asRecord(
      await requestJson({
        function: 'CURRENCY_EXCHANGE_RATE',
        from_currency: fromCode,
        to_currency: toCode,
      }),
    )
    const rateBlock = asRecord(data?.['Realtime Currency Exchange Rate'])
    const rate = parseNumber(rateBlock?.['5. Exchange Rate'])
    if (rate === null) {
      const note = typeof data?.Note === 'string' ? data.Note : null
      throw new Error(note ?? `${fromCode}/${toCode} 환율을 가져오지 못했습니다.`)
    }
    return rate
  })
}
