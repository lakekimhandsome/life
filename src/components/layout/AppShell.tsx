import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../state/AuthContext'

function displayName(user: {
  email?: string | null
  user_metadata?: Record<string, unknown>
}) {
  const meta = user.user_metadata ?? {}
  const nickname =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    (typeof meta.nickname === 'string' && meta.nickname) ||
    (typeof meta.preferred_username === 'string' && meta.preferred_username)
  if (nickname) return nickname
  if (user.email) return user.email.split('@')[0]
  return '나'
}

export function AppShell() {
  const { ready, configured, user, signInWithKakao, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const label = user ? displayName(user) : '나'
  const triggerLabel = user ? label.slice(0, 1) : '나'

  async function handleKakaoLogin() {
    setAuthError(null)
    setAuthBusy(true)
    const { error } = await signInWithKakao()
    if (error) {
      setAuthError(error.message)
      setAuthBusy(false)
    }
  }

  async function handleSignOut() {
    setAuthError(null)
    setAuthBusy(true)
    const { error } = await signOut()
    setAuthBusy(false)
    if (error) {
      setAuthError(error.message)
      return
    }
    setMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />
      <header className="topbar">
        <NavLink to="/" className="brand-mark" end>
          LIFE
        </NavLink>

        <div className="user-menu" ref={menuRef}>
          <button
            type="button"
            className="user-menu-trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="사용자 메뉴"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {triggerLabel}
          </button>
          {menuOpen ? (
            <div className="user-menu-panel" role="menu">
              <p className="user-menu-label">
                {!ready
                  ? '세션 확인 중…'
                  : user
                    ? label
                    : 'Personal Life OS'}
              </p>

              {user ? (
                <button
                  type="button"
                  className="user-menu-item is-action"
                  role="menuitem"
                  disabled={authBusy}
                  onClick={() => void handleSignOut()}
                >
                  로그아웃
                </button>
              ) : (
                <button
                  type="button"
                  className="user-menu-item is-action user-menu-kakao"
                  role="menuitem"
                  disabled={authBusy || !configured}
                  onClick={() => void handleKakaoLogin()}
                >
                  카카오로 로그인
                </button>
              )}

              {!configured ? (
                <p className="user-menu-hint">Supabase 환경 변수를 설정하세요.</p>
              ) : null}
              {authError ? <p className="user-menu-hint is-error">{authError}</p> : null}

              <button
                type="button"
                className="user-menu-item"
                role="menuitem"
                disabled
              >
                설정
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
