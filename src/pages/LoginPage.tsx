import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'

export function LoginPage() {
  const { ready, configured, user, signInWithGoogle, signInWithKakao } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!ready) {
    return (
      <div className="auth-gate">
        <p>세션 확인 중…</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleGoogle() {
    setError(null)
    setBusy(true)
    const { error: nextError } = await signInWithGoogle()
    if (nextError) {
      setError(nextError.message)
      setBusy(false)
    }
  }

  async function handleKakao() {
    setError(null)
    setBusy(true)
    const { error: nextError } = await signInWithKakao()
    if (nextError) {
      setError(nextError.message)
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="atmosphere" aria-hidden="true" />
      <div className="login-card">
        <p className="login-brand">LIFE</p>
        <h1 className="login-title">Personal Life OS</h1>
        <p className="login-copy">로그인 후 삶의 데이터를 이어서 관리하세요.</p>

        {!configured ? (
          <p className="login-hint is-error">Supabase 환경 변수를 설정하세요.</p>
        ) : (
          <div className="login-actions">
            <button
              type="button"
              className="login-btn login-btn-google"
              disabled={busy}
              onClick={() => void handleGoogle()}
            >
              Google로 로그인
            </button>
            <button
              type="button"
              className="login-btn login-btn-kakao"
              disabled={busy}
              onClick={() => void handleKakao()}
            >
              카카오로 로그인
            </button>
          </div>
        )}

        {error ? <p className="login-hint is-error">{error}</p> : null}
      </div>
    </div>
  )
}
