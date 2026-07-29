import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../state/AuthContext'

export function RequireAuth() {
  const { ready, user } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="auth-gate">
        <p>세션 확인 중…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
