import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../state/AuthContext'
import { useT } from '../../state/LocaleContext'

export function RequireAuth() {
  const { ready, user } = useAuth()
  const t = useT()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="auth-gate">
        <p>{t('login.checking')}</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
