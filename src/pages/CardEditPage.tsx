import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { GripVertical } from 'lucide-react'
import { ModuleIcon } from '../components/ui/ModuleIcon'
import { BackLink } from '../components/ui/BackLink'
import {
  addHubModule,
  removeHubModule,
  reorderHubModules,
  resolveExcludedModules,
  resolveHubModules,
} from '../domain/hubLayout'
import { moduleTitle, type ModuleId } from '../domain/modules'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'
import { usePrefs } from '../state/PrefsContext'

export function CardEditPage() {
  const t = useT()
  const { ready, hubLayout, setHubLayout } = usePrefs()
  const { counts } = useLife()
  const [order, setOrder] = useState<ModuleId[]>(hubLayout.order)
  const [excluded, setExcluded] = useState<ModuleId[]>(hubLayout.excluded)
  const [dragId, setDragId] = useState<ModuleId | null>(null)

  const orderRef = useRef(order)
  const dragIdRef = useRef<ModuleId | null>(null)
  const dragOrigin = useRef<ModuleId[] | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  useEffect(() => {
    if (dragId) return
    setOrder(hubLayout.order)
    setExcluded(hubLayout.excluded)
  }, [hubLayout, dragId])

  useEffect(() => {
    orderRef.current = order
  }, [order])

  const visibleModules = resolveHubModules({ order, excluded })
  const excludedModules = resolveExcludedModules({ order, excluded })

  function contentCount(module: (typeof visibleModules)[number]): number {
    return module.objectType ? counts[module.objectType] : 0
  }
  function moveDraggedToIndex(nextIndex: number) {
    const id = dragIdRef.current
    if (!id) return
    setOrder((current) => {
      const fromIndex = current.findIndex((item) => item === id)
      if (fromIndex < 0 || fromIndex === nextIndex) return current
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(nextIndex, 0, moved)
      return next
    })
  }

  function onReorderStart(
    moduleId: ModuleId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) return
    event.preventDefault()

    dragOrigin.current = orderRef.current
    dragIdRef.current = moduleId
    setDragId(moduleId)

    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)

    const onMove = (moveEvent: PointerEvent) => {
      const list = listRef.current
      if (!list) return
      const rows = [...list.querySelectorAll<HTMLElement>('[data-card-id]')]
      const y = moveEvent.clientY
      let targetIndex = rows.length - 1
      for (let index = 0; index < rows.length; index += 1) {
        const rect = rows[index].getBoundingClientRect()
        if (y < rect.top + rect.height / 2) {
          targetIndex = index
          break
        }
      }
      moveDraggedToIndex(targetIndex)
    }

    const finish = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', finish)
      handle.removeEventListener('pointercancel', finish)

      const current = orderRef.current
      const origin = dragOrigin.current
      dragOrigin.current = null
      dragIdRef.current = null
      setDragId(null)

      const changed =
        !origin ||
        origin.length !== current.length ||
        origin.some((id, index) => id !== current[index])

      if (changed) {
        void setHubLayout(reorderHubModules({ order: current, excluded }, current))
      }
    }

    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', finish)
    handle.addEventListener('pointercancel', finish)
  }

  async function handleRemove(id: ModuleId) {
    const next = removeHubModule({ order, excluded }, id)
    setOrder(next.order)
    setExcluded(next.excluded)
    await setHubLayout(next)
  }

  async function handleAdd(id: ModuleId) {
    const next = addHubModule({ order, excluded }, id)
    setOrder(next.order)
    setExcluded(next.excluded)
    await setHubLayout(next)
  }

  return (
    <div className="module-page settings-page">
      <div className="module-header">
        <BackLink to="/settings" />
        <div className="module-heading">
          <h1>{t('cards.title')}</h1>
        </div>
      </div>

      <p className="settings-lead">
        {t('cards.lead')}
      </p>

      {!ready ? (
        <p className="empty-state">{t('common.loading')}</p>
      ) : (
        <>
          <section className="card-edit-section" aria-label={t('cards.includedAria')}>
            <header className="card-edit-section-header">
              <h2>{t('cards.included')}</h2>
              <p>{t('cards.count', { count: visibleModules.length })}</p>
            </header>
            {visibleModules.length === 0 ? (
              <p className="card-edit-empty">{t('cards.emptyIncluded')}</p>
            ) : (
              <ul className="card-edit-list" ref={listRef}>
                {visibleModules.map((module) => (
                  <li
                    key={module.id}
                    data-card-id={module.id}
                    className={`card-edit-row${dragId === module.id ? ' is-dragging' : ''}`}
                  >
                    <button
                      type="button"
                      className="todo-handle"
                      aria-label={t('cards.reorder', { title: moduleTitle(module.id) })}
                      onPointerDown={(event) => onReorderStart(module.id, event)}
                    >
                      <GripVertical size={16} strokeWidth={2} aria-hidden="true" />
                    </button>
                    <span
                      className={`card-edit-icon hub-card--${module.id}`}
                      aria-hidden="true"
                    >
                      <ModuleIcon id={module.id} />
                    </span>
                    <span className="card-edit-copy">
                      <span className="card-edit-title">{moduleTitle(module.id)}</span>
                      {module.objectType ? (
                        <span className="card-edit-count">
                          {t('cards.count', { count: contentCount(module) })}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost card-edit-action"
                      onClick={() => void handleRemove(module.id)}
                      disabled={visibleModules.length <= 1}
                    >
                      {t('cards.remove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-edit-section" aria-label={t('cards.excludedAria')}>
            <header className="card-edit-section-header">
              <h2>{t('cards.excluded')}</h2>
              <p>{t('cards.count', { count: excludedModules.length })}</p>
            </header>
            {excludedModules.length === 0 ? (
              <p className="card-edit-empty">{t('cards.emptyExcluded')}</p>
            ) : (
              <ul className="card-edit-list">
                {excludedModules.map((module) => (
                  <li key={module.id} className="card-edit-row is-excluded">
                    <span className="card-edit-handle-spacer" aria-hidden="true" />
                    <span
                      className={`card-edit-icon hub-card--${module.id}`}
                      aria-hidden="true"
                    >
                      <ModuleIcon id={module.id} />
                    </span>
                    <span className="card-edit-copy">
                      <span className="card-edit-title">{moduleTitle(module.id)}</span>
                      {module.objectType ? (
                        <span className="card-edit-count">
                          {t('cards.count', { count: contentCount(module) })}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary card-edit-action"
                      onClick={() => void handleAdd(module.id)}
                    >
                      {t('common.add')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
