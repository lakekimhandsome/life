import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import googleMark from '../assets/google-signin.png'
import kakaoMark from '../assets/kakao-signin.svg'
import { LifeMark } from '../components/ui/LifeMark'
import { useAuth } from '../state/AuthContext'
import { useT } from '../state/LocaleContext'

export function LoginPage() {
  const t = useT()
  const [searchParams] = useSearchParams()
  const { ready, configured, user, signInWithGoogle, signInWithKakao } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const next = searchParams.get('next') ?? '/'

  if (!ready) {
    return (
      <div className="auth-gate">
        <p>{t('login.checking')}</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleGoogle() {
    setError(null)
    setBusy(true)
    const { error: nextError } = await signInWithGoogle(next)
    if (nextError) {
      setError(nextError.message)
      setBusy(false)
    }
  }

  async function handleKakao() {
    setError(null)
    setBusy(true)
    const { error: nextError } = await signInWithKakao(next)
    if (nextError) {
      setError(nextError.message)
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="atmosphere" aria-hidden="true" />
      <div className="login-card">
        <p className="login-brand">
          <LifeMark size={48} />
          LIFE
        </p>
        <h1 className="login-title">Lake&apos;s Interface For Everything</h1>
        <p className="login-copy">{t('login.copy')}</p>

        {!configured ? (
          <p className="login-hint is-error">{t('login.needSupabase')}</p>
        ) : (
          <div className="login-actions">
            <button
              type="button"
              className="login-btn login-btn-google"
              disabled={busy}
              onClick={() => void handleGoogle()}
            >
              <img src={googleMark} alt="" width={20} height={20} />
              {t('login.google')}
            </button>
            <button
              type="button"
              className="login-btn login-btn-kakao"
              disabled={busy}
              onClick={() => void handleKakao()}
            >
              <img src={kakaoMark} alt="" width={20} height={20} />
              {t('login.kakao')}
            </button>
          </div>
        )}

        {error ? <p className="login-hint is-error">{error}</p> : null}
      </div>
    </div>
  )
}
