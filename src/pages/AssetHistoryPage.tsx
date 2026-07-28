import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AssetsHistoryChart } from '../components/assets/AssetsHistoryChart'
import {
  ASSET_HISTORY_RANGE_OPTIONS,
  computeHistoryChange,
  formatSignedKrw,
  formatSignedPercent,
  type AssetHistoryRange,
} from '../domain/assetHistory'
import { formatKrw } from '../domain/assets'
import { listAssetHistory, type AssetHistoryPoint } from '../lib/assetHistory'

export function AssetHistoryPage() {
  const [range, setRange] = useState<AssetHistoryRange>('1m')
  const [points, setPoints] = useState<AssetHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    ;(async () => {
      setLoading(true)
      setError(null)
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

  const changeTone =
    change.amount === null ? '' : change.amount > 0 ? ' is-up' : change.amount < 0 ? ' is-down' : ''

  return (
    <div className="module-page assets-page assets-history-page">
      <div className="module-header">
        <Link to="/assets" className="back-link">
          ← 자산
        </Link>
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
          <AssetsHistoryChart points={points} series="total" />

          <section className="assets-history-stats" aria-label="기간 요약">
            <div className="assets-history-stat">
              <p className="assets-history-stat-label">현재 총자산</p>
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
