import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LifeMark } from '../components/ui/LifeMark'
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

function ConnectionView({
  client,
  busy = false,
  demo = false,
  onDecide,
}: {
  client: string
  busy?: boolean
  demo?: boolean
  onDecide: (approve: boolean) => void
}) {
  const t = useT()

  return (
    <div className="oauth-page">
      <div className="atmosphere" aria-hidden="true" />
      {demo ? (
        <nav className="oauth-demo-nav" aria-label="Connection preview">
          <a className={client === 'ChatGPT' ? 'is-active' : undefined} href="?client=ChatGPT">
            ChatGPT
          </a>
          <a className={client === 'Codex' ? 'is-active' : undefined} href="?client=Codex">
            Codex
          </a>
        </nav>
      ) : null}
      <main className="oauth-sheet">
        <header className="oauth-brand">
          <LifeMark size={28} />
          <span>LIFE</span>
        </header>

        <div className="oauth-heading">
          <p>{t('oauth.eyebrow')}</p>
          <h1>{t('oauth.title', { client })}</h1>
          <span>{t('oauth.request', { client })}</span>
        </div>

        <section className="oauth-permissions" aria-labelledby="oauth-permissions-title">
          <h2 id="oauth-permissions-title">{t('oauth.permissions', { client })}</h2>
          <ul>
            <li>{t('oauth.read')}</li>
            <li>{t('oauth.write')}</li>
          </ul>
        </section>

        <p className="oauth-safety">{t('oauth.safety')}</p>
        <div className="oauth-actions">
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => onDecide(false)}>
            {t('oauth.deny')}
          </button>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => onDecide(true)}>
            {busy ? t('common.saving') : t('oauth.approve')}
          </button>
        </div>
      </main>
    </div>
  )
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

  if (details) {
    return (
      <ConnectionView
        client={details.client?.name ?? 'ChatGPT'}
        busy={busy}
        onDecide={(approve) => void decide(approve)}
      />
    )
  }

  return (
    <div className="auth-gate">
      <p className={error ? 'is-error' : undefined}>{error ?? t('common.loading')}</p>
    </div>
  )
}

export function OAuthConsentDemoPage() {
  const [searchParams] = useSearchParams()
  const client = searchParams.get('client') === 'Codex' ? 'Codex' : 'ChatGPT'
  return <ConnectionView client={client} demo onDecide={() => undefined} />
}
