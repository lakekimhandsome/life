import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useAuth } from '../state/AuthContext'
import { useT } from '../state/LocaleContext'

type AuthorizationDetails = {
  authorization_id?: string
  redirect_url?: string
  redirect_uri?: string
  scope?: string
  client?: { name?: string }
}

export function OAuthConsentPage() {
  const t = useT()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { ready, user } = useAuth()
  const authorizationId = searchParams.get('authorization_id')
  const [details, setDetails] = useState<AuthorizationDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!ready) return
    if (!authorizationId || !isSupabaseConfigured()) {
      setError(t('oauth.invalid'))
      return
    }
    if (!user) {
      const next = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
      navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true })
      return
    }

    void supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: nextError }) => {
      if (nextError || !data) {
        setError(nextError?.message ?? t('oauth.invalid'))
        return
      }
      const nextDetails = data as AuthorizationDetails
      if (!nextDetails.authorization_id && nextDetails.redirect_url) {
        window.location.assign(nextDetails.redirect_url)
        return
      }
      setDetails(nextDetails)
    })
  }, [authorizationId, navigate, ready, t, user])

  async function decide(approve: boolean) {
    if (!authorizationId) return
    setBusy(true)
    setError(null)
    const { data, error: nextError } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId)
    if (nextError || !data?.redirect_url) {
      setError(nextError?.message ?? t('oauth.failed'))
      setBusy(false)
      return
    }
    window.location.assign(data.redirect_url)
  }

  return (
    <div className="login-page">
      <div className="atmosphere" aria-hidden="true" />
      <main className="login-card">
        <p className="login-brand">LIFE</p>
        <h1 className="login-title">{t('oauth.title')}</h1>
        {!details && !error ? <p className="login-copy">{t('common.loading')}</p> : null}
        {details ? (
          <>
            <p className="login-copy">
              {t('oauth.request', { client: details.client?.name ?? 'ChatGPT' })}
            </p>
            <div className="oauth-permissions">
              <strong>{t('oauth.permissions')}</strong>
              <ul>
                <li>{t('oauth.read')}</li>
                <li>{t('oauth.write')}</li>
              </ul>
            </div>
            <p className="login-hint">{t('oauth.safety')}</p>
            <div className="oauth-actions">
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void decide(false)}>
                {t('oauth.deny')}
              </button>
              <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void decide(true)}>
                {busy ? t('common.saving') : t('oauth.approve')}
              </button>
            </div>
          </>
        ) : null}
        {error ? <p className="login-hint is-error">{error}</p> : null}
      </main>
    </div>
  )
}
