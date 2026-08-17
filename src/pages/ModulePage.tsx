import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ObjectCard } from '../components/object/ObjectCard'
import { BackLink } from '../components/ui/BackLink'
import type { LifeObject } from '../core/types'
import { LIFE_MODULES, type ModuleId } from '../domain/modules'
import { getSchema } from '../domain/schemas'
import { useLife } from '../state/LifeContext'

const PROJECT_STATUS_GROUPS = [
  { value: 'active', label: '진행 중' },
  { value: 'idea', label: '아이디어' },
  { value: 'paused', label: '보류' },
  { value: 'done', label: '완료' },
] as const

function projectStatus(object: LifeObject): (typeof PROJECT_STATUS_GROUPS)[number]['value'] {
  const status = object.meta.status
  if (status === 'idea' || status === 'paused' || status === 'done' || status === 'active') {
    return status
  }
  return 'active'
}

export function ModulePage() {
  const { pathname } = useLocation()
  const { ready, listByType } = useLife()

  const moduleId = pathname.replace(/^\//, '') as ModuleId
  const module = LIFE_MODULES.find((item) => item.id === moduleId)
  const objectType = module?.objectType
  const items = objectType ? listByType(objectType) : []
  const isProject = objectType === 'project'

  const projectGroups = useMemo(() => {
    if (!isProject) return []
    return PROJECT_STATUS_GROUPS.map((group) => ({
      ...group,
      items: items.filter((object) => projectStatus(object) === group.value),
    }))
  }, [isProject, items])

  if (!module || !objectType) {
    return <Navigate to="/" replace />
  }

  const schema = getSchema(objectType)

  return (
    <div className="module-page">
      <div className={`module-header module-heading--${module.id}`}>
        <BackLink to="/" />
        <div className={`module-heading module-heading--${module.id}`}>
          <h1>{module.title}</h1>
        </div>
        <div className="module-header-actions">
          <Link
            to={`/create/${module.objectType}`}
            className="module-header-btn"
            aria-label={`${schema.labelKo} 추가`}
          >
            <Plus size={22} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {!ready ? (
        <p className="empty-state">불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <h3>아직 기록이 없습니다</h3>
          <p>첫 {schema.labelKo}를 남겨 보세요.</p>
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
                <p className="object-group-empty">없음</p>
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
