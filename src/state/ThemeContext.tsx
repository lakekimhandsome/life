import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
type ResolvedTheme = Exclude<ThemePreference, 'system'>

type ThemeContextValue = {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

const STORAGE_KEY = 'life-theme'
const DARK_MODE_QUERY = '(prefers-color-scheme: dark)'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function storedPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_MODE_QUERY).matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(storedPreference)
  const [systemPreference, setSystemPreference] = useState<ResolvedTheme>(systemTheme)
  const resolvedTheme = preference === 'system' ? systemPreference : preference

  useEffect(() => {
    const media = window.matchMedia(DARK_MODE_QUERY)
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPreference(event.matches ? 'dark' : 'light')
    }

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preference)
    } catch {
      // The selected theme still applies when storage is unavailable.
    }
  }, [preference])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
