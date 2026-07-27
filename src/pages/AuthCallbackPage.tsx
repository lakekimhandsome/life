import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('로그인 처리 중…')

  useEffect(() => {
    let cancelled = false

    async function finish() {
      if (!isSupabaseConfigured()) {
        setMessage('Supabase 환경 변수가 없습니다.')
        return
      }

      const url = new URL(window.location.href)
      const next = safeNextPath(url.searchParams.get('next'))
      const code = url.searchParams.get('code')
      const oauthError =
        url.searchParams.get('error_description') ??
        url.searchParams.get('error')

      if (oauthError) {
        if (!cancelled) setMessage(oauthError)
        return
      }

      if (!code) {
        if (!cancelled) setMessage('인증 코드가 없습니다.')
        return
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (cancelled) return

      if (error) {
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
      {message !== '로그인 처리 중…' ? (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate('/', { replace: true })}
        >
          홈으로
        </button>
      ) : null}
    </div>
  )
}
