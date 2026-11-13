import { useMemo, useState } from 'react'
import { ChevronRight, SquarePen } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ObjectCard } from '../components/object/ObjectCard'
import { BackLink } from '../components/ui/BackLink'
import type { LifeObject } from '../core/types'
import { LIFE_MODULES, moduleTitle, type ModuleId } from '../domain/modules'
import { getSchema } from '../domain/schemas'
import type { MessageKey } from '../i18n'
import { comparePinnedObjects } from '../lib/pinnedObjects'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'

const STATUS_VALUES = {
  project: ['active', 'idea', 'paused', 'done'],
  goal: ['active', 'achieved', 'paused'],
} as const
const STATUS_KEYS: Record<string, MessageKey> = {
  active: 'status.active',
  idea: 'status.idea',
  paused: 'status.paused',
  done: 'status.done',
  achieved: 'status.achieved',
}

function objectStatus(object: LifeObject, values: readonly string[]): string {
  const status = object.meta.status
  if (typeof status === 'string' && values.includes(status)) {
    return status
  }
  return 'active'
}

export function ModulePage() {
  const t = useT()
  const { pathname } = useLocation()
  const { ready, listByType } = useLife()
  const [closedGroups, setClosedGroups] = useState(() => {
    try {
      return Object.entries(STATUS_VALUES).flatMap(([type, statuses]) =>
        statuses.map((status) => `life-${type}-group-${status}`)
          .filter((key) => localStorage.getItem(key) === 'closed'))
    } catch {
      return []
    }
  })

  const moduleId = pathname.replace(/^\//, '') as ModuleId
  const module = LIFE_MODULES.find((item) => item.id === moduleId)
  const objectType = module?.objectType
  const items = useMemo(() => objectType
    ? listByType(objectType).sort(comparePinnedObjects)
    : [], [listByType, objectType])
  const groupedType = objectType === 'project' || objectType === 'goal' ? objectType : null

  const statusGroups = useMemo(() => {
    if (!groupedType) return []
    const values = STATUS_VALUES[groupedType]
    return values.map((value) => ({
      value,
      storageKey: `life-${groupedType}-group-${value}`,
      label: t(STATUS_KEYS[value]),
      items: items.filter((object) => objectStatus(object, values) === value),
    }))
  }, [groupedType, items, t])

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
            <SquarePen size={22} strokeWidth={1.75} aria-hidden="true" />
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
      ) : groupedType ? (
        <div className="object-groups">
          {statusGroups.map((group) => (
            <details key={group.storageKey} className="object-group" open={!closedGroups.includes(group.storageKey)}
              onToggle={(event) => {
                const closed = !event.currentTarget.open
                setClosedGroups((previous) => previous.includes(group.storageKey) === closed ? previous
                  : closed ? [...previous, group.storageKey] : previous.filter((key) => key !== group.storageKey))
                try {
                  localStorage.setItem(group.storageKey, closed ? 'closed' : 'open')
                } catch { /* Keep toggling available when storage is blocked. */ }
              }}>
              <summary className="object-group-header">
                <ChevronRight size={18} aria-hidden="true" />
                <h2>{group.label}</h2>
                <strong>{group.items.length}</strong>
              </summary>
              {group.items.length === 0 ? (
                <p className="object-group-empty">{t('common.none')}</p>
              ) : (
                <div className="object-stream">
                  {group.items.map((object) => (
                    <ObjectCard key={object.id} object={object} />
                  ))}
                </div>
              )}
            </details>
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
