import { useEffect, useMemo, useState } from 'react'
import { AssetsHistoryChart } from '../components/assets/AssetsHistoryChart'
import { BackLink } from '../components/ui/BackLink'
import {
  ASSET_HISTORY_RANGE_OPTIONS,
  computeHistoryChange,
  formatSignedKrw,
  formatSignedPercent,
  type AssetHistoryRange,
} from '../domain/assetHistory'
import { formatKrw } from '../domain/assets'
import { formatDate, fromDateInputValue } from '../lib/format'
import {
  deleteAssetHistory,
  listAssetHistory,
  type AssetHistoryPoint,
} from '../lib/assetHistory'

export function AssetHistoryPage() {
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
        setError(err instanceof Error ? err.message : '추이를 불러오지 못했습니다.')
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
    const confirmed = window.confirm(`${label} 기록을 삭제할까요?`)
    if (!confirmed) return

    setDeleting(true)
    setError(null)
    try {
      await deleteAssetHistory(selected.id)
      setPoints((prev) => prev.filter((point) => point.id !== selected.id))
      setSelectedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '기록을 삭제하지 못했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="module-page assets-page assets-history-page">
      <div className="module-header">
        <BackLink to="/assets" />
        <div className="module-heading module-heading--assets">
          <h1>자산 추이</h1>
        </div>
      </div>

      <div className="assets-history-range" role="tablist" aria-label="기간">
        {ASSET_HISTORY_RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={range === option.value}
            className={range === option.value ? 'is-active' : undefined}
            onClick={() => setRange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <p className="empty-state">불러오는 중…</p>
      ) : (
        <>
          <AssetsHistoryChart
            points={points}
            series="total"
            selectedId={selectedId}
            onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          />

          {selected ? (
            <section className="assets-history-selected" aria-label="선택한 기록">
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
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            </section>
          ) : points.length > 0 ? (
            <p className="assets-history-hint">차트에서 기록을 선택하면 삭제할 수 있습니다.</p>
          ) : null}

          <section className="assets-history-stats" aria-label="기간 요약">
            <div className="assets-history-stat">
              <p className="assets-history-stat-label">현재 순자산</p>
              <strong className="assets-history-stat-value">
                {points.length > 0 ? formatKrw(change.current) : '—'}
              </strong>
            </div>
            <div className={`assets-history-stat${changeTone}`}>
              <p className="assets-history-stat-label">기간 증감</p>
              <strong className="assets-history-stat-value">
                {change.amount === null ? '—' : formatSignedKrw(change.amount)}
              </strong>
            </div>
            <div className={`assets-history-stat${changeTone}`}>
              <p className="assets-history-stat-label">증감율</p>
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
