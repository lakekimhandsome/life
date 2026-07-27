import { Link, Navigate, useLocation } from 'react-router-dom'
import { ObjectCard } from '../components/object/ObjectCard'
import { LIFE_MODULES, type ModuleId } from '../domain/modules'
import { getSchema } from '../domain/schemas'
import { useLife } from '../state/LifeContext'

export function ModulePage() {
  const { pathname } = useLocation()
  const { ready, listByType } = useLife()

  const moduleId = pathname.replace(/^\//, '') as ModuleId
  const module = LIFE_MODULES.find((item) => item.id === moduleId)

  if (!module?.objectType) {
    return <Navigate to="/" replace />
  }

  const schema = getSchema(module.objectType)
  const items = listByType(module.objectType)

  return (
    <div className="module-page">
      <div className="module-header">
        <Link to="/" className="back-link">
          ← 홈
        </Link>
        <div className={`module-heading module-heading--${module.id}`}>
          <h1>{module.title}</h1>
        </div>
        <Link to={`/create/${module.objectType}`} className="btn btn-primary">
          {schema.labelKo} 추가
        </Link>
      </div>

      {!ready ? (
        <p className="empty-state">불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <h3>아직 기록이 없습니다</h3>
          <p>첫 {schema.labelKo}를 남겨 보세요.</p>
          <div className="form-actions">
            <Link to={`/create/${module.objectType}`} className="btn btn-primary">
              {schema.labelKo} 추가
            </Link>
          </div>
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
