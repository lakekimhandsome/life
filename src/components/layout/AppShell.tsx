import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
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
            나
          </button>
          {menuOpen ? (
            <div className="user-menu-panel" role="menu">
              <p className="user-menu-label">Personal Life OS</p>
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
