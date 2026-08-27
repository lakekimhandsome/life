import { getLocale, intlLocale, t } from '../i18n'

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(intlLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(intlLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function toDateInputValue(iso: string): string {
  const date = new Date(iso)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 10)
}

export function fromDateInputValue(value: string): string {
  const date = new Date(`${value}T12:00:00`)
  return date.toISOString()
}

export function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addLocalDays(date: Date, days: number): Date {
  const next = startOfLocalDay(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Local calendar day key: YYYY-MM-DD */
export function toLocalDayKey(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isSameLocalDay(a: Date | string, b: Date | string): boolean {
  return toLocalDayKey(a) === toLocalDayKey(b)
}

export function noonOnLocalDay(date: Date): string {
  const local = startOfLocalDay(date)
  local.setHours(12, 0, 0, 0)
  return local.toISOString()
}

export function formatDayHeading(date: Date, today = new Date()): string {
  const label = new Intl.DateTimeFormat(intlLocale(), {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
  if (isSameLocalDay(date, today)) return t('format.today', { label })
  if (isSameLocalDay(date, addLocalDays(today, -1))) return t('format.yesterday', { label })
  if (isSameLocalDay(date, addLocalDays(today, 1))) return t('format.tomorrow', { label })
  return label
}

/** Calendar-day difference: positive = future, 0 = today, negative = past. */
export function daysUntilLocalDay(target: Date | string, today = new Date()): number {
  const targetDay = startOfLocalDay(
    typeof target === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(target)
      ? new Date(`${target}T12:00:00`)
      : new Date(target),
  )
  const todayDay = startOfLocalDay(today)
  return Math.round((targetDay.getTime() - todayDay.getTime()) / 86_400_000)
}

export function formatDday(days: number): string {
  if (days === 0) return 'D-Day'
  if (days > 0) return `D-${days}`
  return `D+${Math.abs(days)}`
}

export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value)
  if (getLocale() === 'ko') {
    if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`
    if (abs >= 10_000) return `${Math.round(value / 10_000)}만`
  }
  return new Intl.NumberFormat(intlLocale(), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}
