import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  applyDocumentLocale,
  detectLocale,
  setLocale as setRuntimeLocale,
  translate,
  type Locale,
  type MessageKey,
  type MessageVars,
} from '../i18n'

export type LocalePreference = 'system' | Locale
type Translate = (key: MessageKey, vars?: MessageVars) => string

type LocaleContextValue = {
  preference: LocalePreference
  locale: Locale
  setPreference: (preference: LocalePreference) => void
  t: Translate
}

const STORAGE_KEY = 'life-locale'
const LocaleContext = createContext<LocaleContextValue | null>(null)

function storedPreference(): LocalePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'ko' || stored === 'en' || stored === 'system' ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<LocalePreference>(() => {
    const next = storedPreference()
    setRuntimeLocale(next === 'system' ? detectLocale() : next)
    return next
  })
  const [systemLocale, setSystemLocale] = useState<Locale>(detectLocale)
  const locale = preference === 'system' ? systemLocale : preference

  useLayoutEffect(() => {
    setRuntimeLocale(locale)
    applyDocumentLocale(locale)
  }, [locale])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preference)
    } catch {
      // The selected language still applies when storage is unavailable.
    }
  }, [preference])

  useEffect(() => {
    const sync = () => setSystemLocale(detectLocale())
    window.addEventListener('languagechange', sync)
    return () => window.removeEventListener('languagechange', sync)
  }, [])

  const value = useMemo<LocaleContextValue>(
    () => ({
      preference,
      locale,
      setPreference,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [preference, locale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) throw new Error('useLocale must be used within LocaleProvider')
  return context
}

// oxlint-disable-next-line react/only-export-components
export function useT(): Translate {
  return useLocale().t
}
