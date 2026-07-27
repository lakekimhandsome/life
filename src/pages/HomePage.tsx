import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LIFE_MODULES, getModuleStatus } from '../domain/modules'
import { daysUntilLocalDay, formatDday } from '../lib/format'
import { useLife } from '../state/LifeContext'

export function HomePage() {
  const { ready, objects } = useLife()

  const ddayGoals = useMemo(() => {
    return objects
      .filter((object) => {
        if (object.type !== 'goal') return false
        if (object.meta.status === 'achieved') return false
        const target = object.meta.targetDate
        return typeof target === 'string' && target.length > 0
      })
      .map((object) => ({
        object,
        days: daysUntilLocalDay(String(object.meta.targetDate)),
      }))
      .sort((a, b) => a.days - b.days)
  }, [objects])

  return (
    <div className="hub">
      {ready && ddayGoals.length > 0 ? (
        <section className="hub-dday" aria-label="디데이">
          {ddayGoals.map(({ object, days }) => (
            <Link
              key={object.id}
              to={`/object/${object.id}`}
              className={`hub-dday-item${days < 0 ? ' is-past' : days === 0 ? ' is-today' : ''}`}
            >
              <span className="hub-dday-badge">{formatDday(days)}</span>
              <span className="hub-dday-title">{object.title}</span>
            </Link>
          ))}
        </section>
      ) : null}

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
