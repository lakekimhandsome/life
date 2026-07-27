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
  if (!isSupabaseConfigured()) return null

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null

  const today = marketDayKey()
  const { data, error } = await supabase
    .from('life_market_quotes')
    .select('value')
    .eq('cache_key', cacheKey)
    .eq('fetched_on', today)
    .maybeSingle()

  if (error) {
    console.warn('life_market_quotes read failed', error.message)
    return null
  }
  if (!data || typeof data.value !== 'number' || !Number.isFinite(data.value)) {
    return null
  }
  return data.value
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
