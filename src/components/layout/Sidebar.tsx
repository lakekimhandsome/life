import { useMemo } from 'react'
import { House } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { OBJECT_TYPES, type ObjectType } from '../../core/types'
import { resolveHubModules } from '../../domain/hubLayout'
import { getModuleForObjectType, moduleTitle } from '../../domain/modules'
import { useLife } from '../../state/LifeContext'
import { useT } from '../../state/LocaleContext'
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
  const t = useT()
  const { pathname } = useLocation()
  const { getObject } = useLife()
  const { hubLayout } = usePrefs()
  const modules = useMemo(
    () => resolveHubModules(hubLayout),
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
    <aside id="app-sidebar" className="app-sidebar">
      <NavLink to="/" className="sidebar-brand" aria-label={t('nav.lifeHome')} end>
        <LifeMark size={28} />
        <span>LIFE</span>
      </NavLink>

      <nav className="sidebar-nav" aria-label={t('nav.main')}>
        <NavLink
          to="/"
          end
          aria-label={t('common.home')}
          title={t('common.home')}
          className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}
        >
          <House size={20} strokeWidth={1.7} aria-hidden="true" />
          <span>{t('common.home')}</span>
        </NavLink>
        {modules.map((module) => (
          <NavLink
            key={module.id}
            to={module.path}
            aria-label={moduleTitle(module.id)}
            title={moduleTitle(module.id)}
            className={({ isActive }) =>
              `sidebar-link sidebar-link--${module.id}${
                isActive || activeModuleId === module.id ? ' is-active' : ''
              }`
            }
          >
            <ModuleIcon id={module.id} />
            <span>{moduleTitle(module.id)}</span>
          </NavLink>
        ))}
      </nav>

      <UserMenu variant="sidebar" />
    </aside>
  )
}
