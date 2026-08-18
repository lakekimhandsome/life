import { useEffect, useRef, useState } from 'react'
import { LogOut, Settings } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { displayEmail, displayName, resolveAvatarUrl } from '../../lib/userProfile'
import { useAuth } from '../../state/AuthContext'
import { Avatar } from '../ui/Avatar'
import { LifeMark } from '../ui/LifeMark'

export function AppShell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
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

  const label = displayName(user)
  const email = displayEmail(user)
  const avatarSrc = resolveAvatarUrl(user)

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
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />
      <header className="topbar">
        <NavLink to="/" className="brand-mark" aria-label="LIFE 홈" end>
          <LifeMark size={30} />
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
            <Avatar src={avatarSrc} name={label} size={36} alt="" />
          </button>
          {menuOpen ? (
            <div className="user-menu-panel" role="menu">
              <div className="user-menu-identity">
                <Avatar src={avatarSrc} name={label} size={40} alt="" />
                <div className="user-menu-identity-copy">
                  <p className="user-menu-label">{label}</p>
                  {email ? <p className="user-menu-email">{email}</p> : null}
                </div>
              </div>

              <button
                type="button"
                className="user-menu-item is-action"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/settings')
                }}
              >
                <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
                설정
              </button>

              <button
                type="button"
                className="user-menu-item is-action"
                role="menuitem"
                disabled={authBusy}
                onClick={() => void handleSignOut()}
              >
                <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
                로그아웃
              </button>

              {authError ? <p className="user-menu-hint is-error">{authError}</p> : null}
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
