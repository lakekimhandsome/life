import { useMemo } from 'react'
import { House } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { OBJECT_TYPES, type ObjectType } from '../../core/types'
import { resolveExcludedModules, resolveHubModules } from '../../domain/hubLayout'
import { getModuleForObjectType } from '../../domain/modules'
import { useLife } from '../../state/LifeContext'
import { usePrefs } from '../../state/PrefsContext'
import { ModuleIcon } from '../ui/ModuleIcon'
import { LifeMark } from '../ui/LifeMark'
import { UserMenu } from './UserMenu'

function objectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/object\/([^/]+)/)
  return match?.[1] ?? null
}

function createTypeFromPath(pathname: string): ObjectType | null {
  const match = pathname.match(/^\/create\/([^/]+)/)
  const value = match?.[1]
  return value && (OBJECT_TYPES as readonly string[]).includes(value)
    ? (value as ObjectType)
    : null
}

export function Sidebar() {
  const { pathname } = useLocation()
  const { getObject } = useLife()
  const { hubLayout } = usePrefs()
  const modules = useMemo(
    () => [...resolveHubModules(hubLayout), ...resolveExcludedModules(hubLayout)],
    [hubLayout],
  )

  const activeModuleId = useMemo(() => {
    const createType = createTypeFromPath(pathname)
    if (createType) return getModuleForObjectType(createType)?.id ?? null

    const objectId = objectIdFromPath(pathname)
    if (objectId) {
      const object = getObject(objectId)
      return object ? (getModuleForObjectType(object.type)?.id ?? null) : null
    }

    return null
  }, [getObject, pathname])

  return (
    <aside className="app-sidebar">
      <NavLink to="/" className="sidebar-brand" aria-label="LIFE 홈" end>
        <LifeMark size={28} />
        <span>LIFE</span>
      </NavLink>

      <nav className="sidebar-nav" aria-label="주요 메뉴">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}
        >
          <House size={20} strokeWidth={1.7} aria-hidden="true" />
          홈
        </NavLink>
        {modules.map((module) => (
          <NavLink
            key={module.id}
            to={module.path}
            className={({ isActive }) =>
              `sidebar-link sidebar-link--${module.id}${
                isActive || activeModuleId === module.id ? ' is-active' : ''
              }`
            }
          >
            <ModuleIcon id={module.id} />
            {module.title}
          </NavLink>
        ))}
      </nav>

      <UserMenu variant="sidebar" />
    </aside>
  )
}
