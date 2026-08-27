import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ObjectCard } from '../components/object/ObjectCard'
import { BackLink } from '../components/ui/BackLink'
import type { LifeObject } from '../core/types'
import { LIFE_MODULES, moduleTitle, type ModuleId } from '../domain/modules'
import { getSchema } from '../domain/schemas'
import type { MessageKey } from '../i18n'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'

const PROJECT_STATUS_VALUES = ['active', 'idea', 'paused', 'done'] as const
const PROJECT_STATUS_KEYS: Record<(typeof PROJECT_STATUS_VALUES)[number], MessageKey> = {
  active: 'status.active',
  idea: 'status.idea',
  paused: 'status.paused',
  done: 'status.done',
}

function projectStatus(object: LifeObject): (typeof PROJECT_STATUS_VALUES)[number] {
  const status = object.meta.status
  if (status === 'idea' || status === 'paused' || status === 'done' || status === 'active') {
    return status
  }
  return 'active'
}

export function ModulePage() {
  const t = useT()
  const { pathname } = useLocation()
  const { ready, listByType } = useLife()

  const moduleId = pathname.replace(/^\//, '') as ModuleId
  const module = LIFE_MODULES.find((item) => item.id === moduleId)
  const objectType = module?.objectType
  const items = objectType ? listByType(objectType) : []
  const isProject = objectType === 'project'

  const projectGroups = useMemo(() => {
    if (!isProject) return []
    return PROJECT_STATUS_VALUES.map((value) => ({
      value,
      label: t(PROJECT_STATUS_KEYS[value]),
      items: items.filter((object) => projectStatus(object) === value),
    }))
  }, [isProject, items, t])

  if (!module || !objectType) {
    return <Navigate to="/" replace />
  }

  const schema = getSchema(objectType)

  return (
    <div className="module-page">
      <div className={`module-header module-heading--${module.id}`}>
        <BackLink to="/" />
        <div className={`module-heading module-heading--${module.id}`}>
          <h1>{moduleTitle(module.id)}</h1>
        </div>
        <div className="module-header-actions">
          <Link
            to={`/create/${module.objectType}`}
            className="module-header-btn"
            aria-label={t('module.addAria', { type: schema.label })}
          >
            <Plus size={22} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {!ready ? (
        <p className="empty-state">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <h3>{t('module.emptyTitle')}</h3>
          <p>{t('module.emptyBody', { type: schema.label })}</p>
        </div>
      ) : isProject ? (
        <div className="object-groups">
          {projectGroups.map((group) => (
            <section key={group.value} className="object-group" aria-label={group.label}>
              <header className="object-group-header">
                <h2>{group.label}</h2>
                <strong>{group.items.length}</strong>
              </header>
              {group.items.length === 0 ? (
                <p className="object-group-empty">{t('common.none')}</p>
              ) : (
                <div className="object-stream">
                  {group.items.map((object) => (
                    <ObjectCard key={object.id} object={object} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="object-stream">
          {items.map((object) => (
            <ObjectCard key={object.id} object={object} />
          ))}
        </div>
      )}
    </div>
  )
}
