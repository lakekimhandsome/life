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
}: {
  points: AssetHistoryPoint[]
  series?: AssetHistorySeries
}) {
  const data = useMemo<ChartRow[]>(
    () =>
      points.map((point) => ({
        date: point.recordedAt,
        label: shortDateLabel(point.recordedAt),
        value: seriesValue(point, series),
      })),
    [points, series],
  )

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
        <LineChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="color-mix(in srgb, var(--line) 80%, transparent)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--line)' }}
            minTickGap={28}
          />
          <YAxis
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
            dot={data.length <= 14}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
