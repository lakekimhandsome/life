import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ModuleIcon } from '../components/ui/ModuleIcon'
import {
  assetsSnapshot,
  valueAssetsFromLatestCache,
} from '../domain/assets'
import { resolveHubModules } from '../domain/hubLayout'
import { getModuleStatus } from '../domain/modules'
import { daysUntilLocalDay, formatDday } from '../lib/format'
import { useLife } from '../state/LifeContext'
import { usePrefs } from '../state/PrefsContext'

export function HomePage() {
  const { ready, objects } = useLife()
  const { hubLayout } = usePrefs()
  const [assetsTotalKrw, setAssetsTotalKrw] = useState<number | null>(null)

  const modules = useMemo(() => resolveHubModules(hubLayout), [hubLayout])

  const assets = useMemo(
    () => objects.filter((object) => object.type === 'asset'),
    [objects],
  )

  useEffect(() => {
    if (!ready) return

    if (assets.length === 0) {
      setAssetsTotalKrw(null)
      return
    }

    let active = true

    ;(async () => {
      const cached = await valueAssetsFromLatestCache(assets)
      if (!active) return

      const items = cached?.valued ?? assetsSnapshot(assets)
      const total = items.reduce((sum, item) => sum + (item.valueKrw ?? 0), 0)
      setAssetsTotalKrw(total)
    })()

    return () => {
      active = false
    }
  }, [ready, assets])

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
        {modules.map((module) => (
          <Link
            key={module.id}
            to={module.path}
            className={`hub-card hub-card--${module.id}`}
          >
            <span className="hub-card-icon" aria-hidden="true">
              <ModuleIcon id={module.id} />
            </span>
            <div className="hub-card-copy">
              <h2>{module.title}</h2>
              <p>
                {ready
                  ? getModuleStatus(module.id, objects, { assetsTotalKrw })
                  : '…'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
