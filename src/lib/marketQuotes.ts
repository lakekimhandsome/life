import { isSupabaseConfigured, supabase } from './supabase'

/** Asia/Seoul 기준 날짜 (YYYY-MM-DD). */
export function marketDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export async function getMarketQuote(cacheKey: string): Promise<number | null> {
  const map = await getMarketQuotes([cacheKey])
  return map.get(cacheKey) ?? null
}

export type StoredMarketQuote = {
  value: number
  fetchedOn: string
}

/** 당일 저장된 시세를 cache_key 목록으로 일괄 조회. */
export async function getMarketQuotes(
  cacheKeys: string[],
): Promise<Map<string, number>> {
  const today = marketDayKey()
  const latest = await getLatestMarketQuotes(cacheKeys)
  const result = new Map<string, number>()
  for (const [key, quote] of latest) {
    if (quote.fetchedOn === today) result.set(key, quote.value)
  }
  return result
}

/** 가장 최근에 저장된 시세(전일 포함)를 cache_key 목록으로 일괄 조회. */
export async function getLatestMarketQuotes(
  cacheKeys: string[],
): Promise<Map<string, StoredMarketQuote>> {
  const result = new Map<string, StoredMarketQuote>()
  const unique = [...new Set(cacheKeys.filter(Boolean))]
  if (unique.length === 0 || !isSupabaseConfigured()) return result

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return result

  const { data, error } = await supabase
    .from('life_market_quotes')
    .select('cache_key, value, fetched_on')
    .in('cache_key', unique)

  if (error) {
    console.warn('life_market_quotes read failed', error.message)
    return result
  }

  for (const row of data ?? []) {
    if (typeof row.value === 'number' && Number.isFinite(row.value) && row.fetched_on) {
      result.set(row.cache_key, { value: row.value, fetchedOn: row.fetched_on })
    }
  }
  return result
}

export async function saveMarketQuote(cacheKey: string, value: number): Promise<void> {
  if (!isSupabaseConfigured()) return

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return

  const today = marketDayKey()
  const { error } = await supabase.from('life_market_quotes').upsert(
    {
      cache_key: cacheKey,
      value,
      fetched_on: today,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'cache_key' },
  )

  if (error) {
    console.warn('life_market_quotes write failed', error.message)
  }
}
