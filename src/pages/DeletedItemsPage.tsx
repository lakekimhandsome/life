import { useEffect, useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { BackLink } from '../components/ui/BackLink'
import { TypeBadge } from '../components/ui/TypeBadge'
import { listDeletedObjects, permanentlyDeleteObject, restoreDeletedObject } from '../core/repository'
import { formatDateTime } from '../lib/format'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'

type DeletedItem = Awaited<ReturnType<typeof listDeletedObjects>>[number]

export function DeletedItemsPage() {
  const t = useT()
  const { refresh } = useLife()
  const [items, setItems] = useState<DeletedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(false)
    listDeletedObjects().then((next) => {
      if (active) setItems(next)
    }).catch(() => {
      if (active) setLoadError(true)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [attempt])

  async function act(item: DeletedItem, restore: boolean) {
    if (!restore && !window.confirm(t('trash.confirm', { title: item.object.title }))) return
    setBusy(item.object.id)
    setActionError(false)
    setMessage('')
    try {
      if (restore) await restoreDeletedObject(item.object.id)
      else await permanentlyDeleteObject(item.object.id)
      setItems((current) => current.filter(({ object }) => object.id !== item.object.id))
      setMessage(t(restore ? 'trash.restored' : 'trash.removed'))
      if (restore) {
        try { await refresh() } catch { setMessage(t('trash.refreshFailed')) }
      }
    } catch {
      setActionError(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="module-page settings-page">
      <div className="module-header">
        <BackLink to="/settings" />
        <div className="module-heading"><h1>{t('trash.title')}</h1></div>
      </div>
      <p className="settings-lead">{t('trash.lead')}</p>
      {message && <p role="status">{message}</p>}
      {actionError && <p role="alert">{t('trash.failed')}</p>}
      {loading ? <p className="empty-state">{t('common.loading')}</p> : loadError ? (
        <div role="alert">
          <p>{t('trash.loadFailed')}</p>
          <button type="button" className="btn btn-ghost" onClick={() => setAttempt((value) => value + 1)}>
            {t('trash.retry')}
          </button>
        </div>
      ) : items.length === 0 ? <p className="empty-state">{t('trash.empty')}</p> : (
        <ul className="deleted-items-list">
          {items.map((item) => (
            <li key={item.object.id} className="deleted-item">
              <div className="deleted-item-copy">
                <TypeBadge type={item.object.type} />
                <strong>{item.object.title}</strong>
                <time dateTime={item.deletedAt}>{t('trash.deletedAt', { date: formatDateTime(item.deletedAt) })}</time>
              </div>
              <div className="deleted-item-actions object-header-actions">
                <button type="button" className="object-header-action" disabled={busy !== null}
                  aria-label={`${t('trash.restore')}: ${item.object.title}`}
                  onClick={() => void act(item, true)}>
                  <RotateCcw size={20} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="object-header-action deleted-item-permanent" disabled={busy !== null}
                  aria-label={`${t('trash.permanent')}: ${item.object.title}`}
                  onClick={() => void act(item, false)}>
                  <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
