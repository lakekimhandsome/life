import { en, ko, type MessageKey } from './messages'

export type Locale = 'ko' | 'en'
export type LocalePreference = 'system' | Locale
export type { MessageKey }
export type MessageVars = Record<string, string | number>

export function isLocalePreference(value: unknown): value is LocalePreference {
  return value === 'system' || value === 'ko' || value === 'en'
}

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, ko }

let currentLocale: Locale = detectLocale()

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const language = navigator.language || navigator.languages?.[0] || 'en'
  return language.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

export function getLocale(): Locale {
  return currentLocale
}

export function setLocale(locale: Locale) {
  currentLocale = locale
}

export function intlLocale(locale: Locale = currentLocale): string {
  if (typeof navigator === 'undefined') return locale === 'ko' ? 'ko-KR' : 'en-US'
  const language = navigator.language || ''
  if (locale === 'ko') return language.toLowerCase().startsWith('ko') ? language : 'ko-KR'
  return language.toLowerCase().startsWith('en') ? language : 'en-US'
}

function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  )
}

export function translate(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  return interpolate(catalogs[locale][key] ?? catalogs.en[key], vars)
}

export function t(key: MessageKey, vars?: MessageVars): string {
  return translate(currentLocale, key, vars)
}

export function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale
  const description = document.querySelector('meta[name="description"]')
  if (description) description.setAttribute('content', translate(locale, 'meta.description'))
}
