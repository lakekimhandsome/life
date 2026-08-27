import { NavLink, Outlet } from 'react-router-dom'
import { LifeMark } from '../ui/LifeMark'
import { Sidebar } from './Sidebar'
import { UserMenu } from './UserMenu'
import { useT } from '../../state/LocaleContext'

export function AppShell() {
  const t = useT()
  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />
      <Sidebar />
      <div className="app-frame">
        <header className="topbar">
          <NavLink to="/" className="brand-mark" aria-label={t('nav.lifeHome')} end>
            <LifeMark size={30} />
          </NavLink>
          <UserMenu />
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
