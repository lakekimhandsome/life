import { Link } from 'react-router-dom'
import { LIFE_MODULES, getModuleStatus } from '../domain/modules'
import { useLife } from '../state/LifeContext'

export function HomePage() {
  const { ready, objects } = useLife()

  return (
    <div className="hub">
      <div className="hub-grid">
        {LIFE_MODULES.map((module) => (
          <Link key={module.id} to={module.path} className="hub-card">
            <span className="hub-card-icon" aria-hidden="true">
              {module.icon}
            </span>
            <div className="hub-card-copy">
              <h2>{module.title}</h2>
              <p>{ready ? getModuleStatus(module.id, objects) : '…'}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
