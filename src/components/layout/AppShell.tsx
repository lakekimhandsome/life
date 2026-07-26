import type { CSSProperties } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { CREATE_ORDER, getSchema } from '../../domain/schemas'

export function AppShell() {
  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />
      <header className="topbar">
        <NavLink to="/" className="brand-mark" end>
          LIFE
        </NavLink>
        <nav className="topbar-nav" aria-label="생성">
          {CREATE_ORDER.map((type) => {
            const schema = getSchema(type)
            return (
              <NavLink
                key={type}
                to={`/create/${type}`}
                className={({ isActive }) =>
                  `nav-chip${isActive ? ' is-active' : ''}`
                }
                style={{ '--chip-accent': schema.accent } as CSSProperties}
              >
                {schema.labelKo}
              </NavLink>
            )
          })}
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
