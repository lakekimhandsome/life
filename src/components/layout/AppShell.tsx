import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LifeMark } from '../ui/LifeMark'
import { Sidebar } from './Sidebar'
import { UserMenu } from './UserMenu'
import { useT } from '../../state/LocaleContext'

const WIDTH_KEY = 'life-sidebar-width'
const COLLAPSED_WIDTH = 64
const COLLAPSE_THRESHOLD = 160
const MIN_WIDTH = 200
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 248
const clampWidth = (width: number) =>
  width < COLLAPSE_THRESHOLD ? COLLAPSED_WIDTH : Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))

function storedWidth() {
  try {
    const stored = localStorage.getItem(WIDTH_KEY)
    const width = stored === null ? DEFAULT_WIDTH : Number(stored)
    return Number.isFinite(width) ? clampWidth(width) : DEFAULT_WIDTH
  } catch {
    return DEFAULT_WIDTH
  }
}

export function AppShell() {
  const t = useT()
  const [sidebarWidth, setSidebarWidth] = useState(storedWidth)
  const [resizing, setResizing] = useState(false)
  const drag = useRef({ x: 0, width: 0 })

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(sidebarWidth))
    } catch {
      // Resizing still works when browser storage is unavailable.
    }
  }, [sidebarWidth])

  return (
    <div
      className={`app-shell${sidebarWidth === COLLAPSED_WIDTH ? ' is-sidebar-collapsed' : ''}${resizing ? ' is-resizing-sidebar' : ''}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <div className="atmosphere" aria-hidden="true" />
      <Sidebar />
      <div
        className="sidebar-resizer"
        role="separator"
        tabIndex={0}
        aria-label={t('nav.resizeSidebar')}
        aria-orientation="vertical"
        aria-controls="app-sidebar"
        aria-valuemin={COLLAPSED_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={sidebarWidth}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return
          event.preventDefault()
          event.currentTarget.focus()
          drag.current = { x: event.clientX, width: sidebarWidth }
          event.currentTarget.setPointerCapture(event.pointerId)
          setResizing(true)
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
          setSidebarWidth(clampWidth(drag.current.width + event.clientX - drag.current.x))
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onLostPointerCapture={() => setResizing(false)}
        onDoubleClick={() => setSidebarWidth(DEFAULT_WIDTH)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            setSidebarWidth((width) => {
              if (event.key === 'ArrowRight') return width === COLLAPSED_WIDTH ? MIN_WIDTH : clampWidth(width + 10)
              return width <= MIN_WIDTH ? COLLAPSED_WIDTH : clampWidth(width - 10)
            })
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            setSidebarWidth(event.key === 'Home' ? COLLAPSED_WIDTH : MAX_WIDTH)
          }
        }}
      />
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
