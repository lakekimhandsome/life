import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import discordMark from '../assets/discord-signin.svg'
import googleMark from '../assets/google-signin.svg'
import kakaoButtonEn from '../assets/kakao-signin-en.svg'
import kakaoButtonKo from '../assets/kakao-signin-ko.svg'
import { LifeMark } from '../components/ui/LifeMark'
import { useAuth, type LoginProvider } from '../state/AuthContext'
import { useLocale } from '../state/LocaleContext'

export function LoginPage() {
  const { locale, t } = useLocale()
  const [searchParams] = useSearchParams()
  const { ready, configured, user, signIn } = useAuth()
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

  async function handleLogin(provider: LoginProvider) {
    setError(null)
    setBusy(true)
    const { error: nextError } = await signIn(provider, next)
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
              className="login-btn gsi-material-button"
              disabled={busy}
              onClick={() => void handleLogin('google')}
            >
              <span className="gsi-material-button-state" aria-hidden="true" />
              <span className="gsi-material-button-content-wrapper">
                <img className="gsi-material-button-icon" src={googleMark} alt="" width={20} height={20} />
                <span className="gsi-material-button-contents">{t('login.google')}</span>
              </span>
            </button>
            <button
              type="button"
              className="login-btn login-btn-kakao"
              disabled={busy}
              onClick={() => void handleLogin('kakao')}
            >
              <img
                src={locale === 'ko' ? kakaoButtonKo : kakaoButtonEn}
                alt={t('login.kakao')}
                width={224}
                height={46}
              />
            </button>
            {import.meta.env.VITE_NAVER_LOGIN_ENABLED === 'true' ? (
              <button
                type="button"
                className="login-btn login-btn-naver"
                disabled={busy}
                onClick={() => void handleLogin('custom:naver')}
              >
                <span className="login-naver-mark" aria-hidden="true" />
                <span>{t('login.naver')}</span>
              </button>
            ) : null}
            <button
              type="button"
              className="login-btn login-btn-discord"
              disabled={busy}
              onClick={() => void handleLogin('discord')}
            >
              <img src={discordMark} alt="" width={20} height={15} />
              <span>{t('login.discord')}</span>
            </button>
          </div>
        )}

        {error ? <p className="login-hint is-error">{error}</p> : null}
      </div>
    </div>
  )
}
