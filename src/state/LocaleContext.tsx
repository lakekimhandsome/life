import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  applyDocumentLocale,
  detectLocale,
  setLocale as setRuntimeLocale,
  translate,
  type Locale,
  type LocalePreference,
  type MessageKey,
  type MessageVars,
} from '../i18n'
import { getLocalePreference, saveLocalePreference } from '../lib/hubPrefs'
import { useAuth } from './AuthContext'

export type { LocalePreference }

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

function persistLocal(preference: LocalePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // The selected language still applies when storage is unavailable.
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, user } = useAuth()
  const [preference, setPreferenceState] = useState<LocalePreference>(() => {
    const next = storedPreference()
    setRuntimeLocale(next === 'system' ? detectLocale() : next)
    return next
  })
  const [systemLocale, setSystemLocale] = useState<Locale>(detectLocale)
  const locale = preference === 'system' ? systemLocale : preference
  const preferenceRef = useRef(preference)
  preferenceRef.current = preference

  useLayoutEffect(() => {
    setRuntimeLocale(locale)
    applyDocumentLocale(locale)
  }, [locale])

  useEffect(() => {
    persistLocal(preference)
  }, [preference])

  useEffect(() => {
    const sync = () => setSystemLocale(detectLocale())
    window.addEventListener('languagechange', sync)
    return () => window.removeEventListener('languagechange', sync)
  }, [])

  useEffect(() => {
    if (!authReady || !user) return

    let active = true
    ;(async () => {
      try {
        const cloud = await getLocalePreference()
        if (!active) return
        if (cloud) {
          setPreferenceState(cloud)
          return
        }
        await saveLocalePreference(preferenceRef.current)
      } catch (error) {
        console.error('Failed to load locale preference', error)
      }
    })()

    return () => {
      active = false
    }
  }, [authReady, user])

  const setPreference = useCallback(
    (next: LocalePreference) => {
      setPreferenceState(next)
      persistLocal(next)
      if (!user) return
      void saveLocalePreference(next).catch((error) => {
        console.error('Failed to save locale preference', error)
      })
    },
    [user],
  )

  const value = useMemo<LocaleContextValue>(
    () => ({
      preference,
      locale,
      setPreference,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [preference, locale, setPreference],
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
