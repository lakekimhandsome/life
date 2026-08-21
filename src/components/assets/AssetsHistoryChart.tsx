import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatKrw } from '../../domain/assets'
import type { AssetHistoryPoint } from '../../lib/assetHistory'

/** Which series to plot — total now; kind keys later (cash / stock / …). */
export type AssetHistorySeries = 'total' | 'cash' | 'stock' | 'material' | 'crypto'

const SERIES_LABEL: Record<AssetHistorySeries, string> = {
  total: '순자산',
  cash: '현금',
  stock: '주식',
  material: '물질',
  crypto: '암호화폐',
}

interface ChartRow {
  id: string
  date: string
  label: string
  value: number
}

function shortDateLabel(dayKey: string): string {
  const [, month, day] = dayKey.split('-')
  return `${Number(month)}/${Number(day)}`
}

function seriesValue(point: AssetHistoryPoint, series: AssetHistorySeries): number {
  if (series === 'total') return point.total
  if (series === 'cash') return point.cash
  if (series === 'stock') return point.stock
  if (series === 'material') return point.material
  return point.crypto
}

function formatAxisKrw(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`
  if (abs >= 10_000) return `${Math.round(value / 10_000)}만`
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value)
}

export function AssetsHistoryChart({
  points,
  series = 'total',
  selectedId = null,
  onSelect,
}: {
  points: AssetHistoryPoint[]
  series?: AssetHistorySeries
  selectedId?: string | null
  onSelect?: (id: string) => void
}) {
  const data = useMemo<ChartRow[]>(
    () =>
      points.map((point) => ({
        id: point.id,
        date: point.recordedAt,
        label: shortDateLabel(point.recordedAt),
        value: seriesValue(point, series),
      })),
    [points, series],
  )

  const yDomain = useMemo((): [number, number] => {
    if (data.length === 0) return [0, 1]
    const values = data.map((row) => row.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min
    const pad = span === 0 ? Math.max(Math.abs(max) * 0.05, 1) : span * 0.12
    return [min - pad, max + pad]
  }, [data])

  const showDots = data.length <= 14 || Boolean(selectedId)

  if (data.length === 0) {
    return (
      <div className="assets-history-chart assets-history-chart--empty">
        <p>선택한 기간의 기록이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="assets-history-chart" aria-label={`${SERIES_LABEL[series]} 추이`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 12, right: 8, left: 4, bottom: 4 }}
          onClick={(state) => {
            if (!onSelect) return
            const index =
              typeof state?.activeIndex === 'number'
                ? state.activeIndex
                : typeof state?.activeTooltipIndex === 'number'
                  ? state.activeTooltipIndex
                  : null
            if (index === null) return
            const row = data[index]
            if (!row?.id) return
            onSelect(row.id)
          }}
        >
          <CartesianGrid stroke="color-mix(in srgb, var(--line) 80%, transparent)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--line)' }}
            minTickGap={28}
          />
          <YAxis
            type="number"
            domain={yDomain}
            allowDataOverflow
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={formatAxisKrw}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0]?.payload as ChartRow | undefined
              if (!row) return null
              return (
                <div className="assets-chart-tooltip">
                  <span>{row.date}</span>
                  <strong>{formatKrw(row.value)}</strong>
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={SERIES_LABEL[series]}
            stroke="var(--accent-asset)"
            strokeWidth={2.25}
            activeDot={{ r: 6 }}
            dot={
              showDots
                ? (props) => {
                    const { cx, cy, payload } = props
                    if (typeof cx !== 'number' || typeof cy !== 'number') return null
                    const row = payload as ChartRow
                    const selected = row.id === selectedId
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={selected ? 6 : 3.5}
                        fill={selected ? 'var(--accent-asset)' : 'var(--bg)'}
                        stroke="var(--accent-asset)"
                        strokeWidth={selected ? 2.5 : 2}
                        style={{ cursor: onSelect ? 'pointer' : undefined }}
                      />
                    )
                  }
                : false
            }
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
