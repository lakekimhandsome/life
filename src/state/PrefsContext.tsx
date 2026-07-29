import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  defaultHubLayout,
  type HubLayout,
} from '../domain/hubLayout'
import { getHubLayout, saveHubLayout } from '../lib/hubPrefs'
import { useAuth } from './AuthContext'

type PrefsContextValue = {
  ready: boolean
  hubLayout: HubLayout
  setHubLayout: (layout: HubLayout) => Promise<void>
}

const PrefsContext = createContext<PrefsContextValue | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, user } = useAuth()
  const [ready, setReady] = useState(false)
  const [hubLayout, setHubLayoutState] = useState<HubLayout>(defaultHubLayout)

  useEffect(() => {
    if (!authReady) return

    let active = true

    if (!user) {
      setHubLayoutState(defaultHubLayout())
      setReady(true)
      return () => {
        active = false
      }
    }

    setReady(false)
    ;(async () => {
      try {
        const layout = await getHubLayout()
        if (active) setHubLayoutState(layout)
      } catch (error) {
        console.error('Failed to load prefs', error)
      } finally {
        if (active) setReady(true)
      }
    })()

    return () => {
      active = false
    }
  }, [authReady, user])

  const setHubLayout = useCallback(async (layout: HubLayout) => {
    setHubLayoutState(layout)
    try {
      const saved = await saveHubLayout(layout)
      setHubLayoutState(saved)
    } catch (error) {
      console.error('Failed to save hub layout', error)
      const current = await getHubLayout()
      setHubLayoutState(current)
    }
  }, [])

  const value = useMemo(
    () => ({
      ready,
      hubLayout,
      setHubLayout,
    }),
    [ready, hubLayout, setHubLayout],
  )

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs(): PrefsContextValue {
  const context = useContext(PrefsContext)
  if (!context) {
    throw new Error('usePrefs must be used within PrefsProvider')
  }
  return context
}
