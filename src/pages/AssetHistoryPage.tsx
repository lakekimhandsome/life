import { useEffect, useMemo, useState } from 'react'
import { AssetsHistoryChart } from '../components/assets/AssetsHistoryChart'
import { BackLink } from '../components/ui/BackLink'
import {
  ASSET_HISTORY_RANGES,
  assetHistoryRangeLabel,
  computeHistoryChange,
  formatSignedKrw,
  formatSignedPercent,
  type AssetHistoryRange,
} from '../domain/assetHistory'
import { formatKrw } from '../domain/assets'
import { t as translate } from '../i18n'
import { formatDate, fromDateInputValue } from '../lib/format'
import {
  deleteAssetHistory,
  listAssetHistory,
  type AssetHistoryPoint,
} from '../lib/assetHistory'
import { useT } from '../state/LocaleContext'

export function AssetHistoryPage() {
  const t = useT()
  const [range, setRange] = useState<AssetHistoryRange>('1m')
  const [points, setPoints] = useState<AssetHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let active = true

    ;(async () => {
      setLoading(true)
      setError(null)
      setSelectedId(null)
      try {
        const next = await listAssetHistory(range)
        if (!active) return
        setPoints(next)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : translate('assets.historyLoadFailed'))
        setPoints([])
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [range])

  const change = useMemo(() => computeHistoryChange(points), [points])
  const selected = useMemo(
    () => points.find((point) => point.id === selectedId) ?? null,
    [points, selectedId],
  )

  const changeTone =
    change.amount === null ? '' : change.amount > 0 ? ' is-up' : change.amount < 0 ? ' is-down' : ''

  async function handleDeleteSelected() {
    if (!selected) return
    const label = formatDate(fromDateInputValue(selected.recordedAt))
    const confirmed = window.confirm(t('assets.historyDeleteConfirm', { date: label }))
    if (!confirmed) return

    setDeleting(true)
    setError(null)
    try {
      await deleteAssetHistory(selected.id)
      setPoints((prev) => prev.filter((point) => point.id !== selected.id))
      setSelectedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('assets.historyDeleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="module-page assets-page assets-history-page">
      <div className="module-header">
        <BackLink to="/assets" />
        <div className="module-heading module-heading--assets">
          <h1>{t('assets.history')}</h1>
        </div>
      </div>

      <div className="assets-history-range" role="tablist" aria-label={t('assets.historyRange')}>
        {ASSET_HISTORY_RANGES.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={range === value}
            className={range === value ? 'is-active' : undefined}
            onClick={() => setRange(value)}
          >
            {assetHistoryRangeLabel(value)}
          </button>
        ))}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <p className="empty-state">{t('common.loading')}</p>
      ) : (
        <>
          <AssetsHistoryChart
            points={points}
            series="total"
            selectedId={selectedId}
            onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          />

          {selected ? (
            <section className="assets-history-selected" aria-label={t('assets.historySelected')}>
              <div className="assets-history-selected-main">
                <p className="assets-history-stat-label">
                  {formatDate(fromDateInputValue(selected.recordedAt))}
                </p>
                <strong className="assets-history-stat-value">
                  {formatKrw(selected.total)}
                </strong>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleting}
                onClick={() => void handleDeleteSelected()}
              >
                {deleting ? t('common.deleting') : t('common.delete')}
              </button>
            </section>
          ) : points.length > 0 ? (
            <p className="assets-history-hint">{t('assets.historyHint')}</p>
          ) : null}

          <section className="assets-history-stats" aria-label={t('assets.historySummary')}>
            <div className="assets-history-stat">
              <p className="assets-history-stat-label">{t('assets.historyCurrent')}</p>
              <strong className="assets-history-stat-value">
                {points.length > 0 ? formatKrw(change.current) : '—'}
              </strong>
            </div>
            <div className={`assets-history-stat${changeTone}`}>
              <p className="assets-history-stat-label">{t('assets.historyChange')}</p>
              <strong className="assets-history-stat-value">
                {change.amount === null ? '—' : formatSignedKrw(change.amount)}
              </strong>
            </div>
            <div className={`assets-history-stat${changeTone}`}>
              <p className="assets-history-stat-label">{t('assets.historyPercent')}</p>
              <strong className="assets-history-stat-value">
                {change.percent === null ? '—' : formatSignedPercent(change.percent)}
              </strong>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
