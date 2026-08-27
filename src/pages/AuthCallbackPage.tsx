import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { t } from '../i18n'
import { useT } from '../state/LocaleContext'

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

export function AuthCallbackPage() {
  const ui = useT()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const [message, setMessage] = useState(() => t('auth.processing'))

  useEffect(() => {
    let cancelled = false

    async function finish() {
      if (!isSupabaseConfigured()) {
        setFailed(true)
        setMessage(t('auth.noSupabase'))
        return
      }

      const url = new URL(window.location.href)
      const next = safeNextPath(url.searchParams.get('next'))
      const code = url.searchParams.get('code')
      const oauthError =
        url.searchParams.get('error_description') ??
        url.searchParams.get('error')

      if (oauthError) {
        if (!cancelled) {
          setFailed(true)
          setMessage(oauthError)
        }
        return
      }

      if (!code) {
        if (!cancelled) {
          setFailed(true)
          setMessage(t('auth.noCode'))
        }
        return
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (cancelled) return

      if (error) {
        setFailed(true)
        setMessage(error.message)
        return
      }

      navigate(next, { replace: true })
    }

    void finish()
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className="auth-callback">
      <p>{message}</p>
      {failed ? (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate('/login', { replace: true })}
        >
          {ui('auth.backToLogin')}
        </button>
      ) : null}
    </div>
  )
}
