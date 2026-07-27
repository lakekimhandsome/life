import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type AuthContextValue = {
  ready: boolean
  configured: boolean
  session: Session | null
  user: User | null
  signInWithKakao: () => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function authRedirectTo(next = '/') {
  const url = new URL('/auth/callback', window.location.origin)
  if (next && next !== '/') {
    url.searchParams.set('next', next)
  }
  return url.toString()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [ready, setReady] = useState(!configured)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!configured) return

    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setReady(true)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [configured])

  const signInWithKakao = useCallback(async () => {
    if (!configured) {
      return { error: new Error('Supabase가 설정되지 않았습니다.') }
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: authRedirectTo('/'),
      },
    })

    return { error: error ? new Error(error.message) : null }
  }, [configured])

  const signInWithGoogle = useCallback(async () => {
    if (!configured) {
      return { error: new Error('Supabase가 설정되지 않았습니다.') }
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authRedirectTo('/'),
      },
    })

    return { error: error ? new Error(error.message) : null }
  }, [configured])

  const signOut = useCallback(async () => {
    if (!configured) {
      return { error: new Error('Supabase가 설정되지 않았습니다.') }
    }

    const { error } = await supabase.auth.signOut()
    return { error: error ? new Error(error.message) : null }
  }, [configured])

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      configured,
      session,
      user: session?.user ?? null,
      signInWithKakao,
      signInWithGoogle,
      signOut,
    }),
    [ready, configured, session, signInWithGoogle, signInWithKakao, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
