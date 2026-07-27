import { useId, useMemo, useState } from 'react'
import {
  ASSET_KIND_LABEL,
  ASSET_KIND_ORDER,
  formatKrw,
  type AssetKind,
  type ValuedAsset,
} from '../../domain/assets'

type ChartMode = 'kind' | 'item'

interface Slice {
  key: string
  label: string
  value: number
  color: string
}

const KIND_COLORS: Record<AssetKind, string> = {
  cash: '#D4A84B',
  stock: '#5BA88A',
  commodity: '#C97B5A',
}

/** 비슷한 명도·채도로 맞춘 구분 팔레트 (인접 슬라이스가 잘 갈라지도록 배치) */
const ITEM_PALETTE = [
  '#D4A84B',
  '#5BA88A',
  '#6B9EC4',
  '#C97B5A',
  '#9B8BC4',
  '#7AABA0',
  '#D4926A',
  '#8AA06B',
  '#5F8FA8',
  '#B88A5A',
  '#A67C9A',
  '#6FA88E',
]

function polar(cx: number, cy: number, radius: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, radius, startAngle)
  const end = polar(cx, cy, radius, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

function buildKindSlices(items: ValuedAsset[]): Slice[] {
  return ASSET_KIND_ORDER.flatMap((kind) => {
    const value = items
      .filter((item) => item.kind === kind && item.valueKrw !== null)
      .reduce((sum, item) => sum + (item.valueKrw ?? 0), 0)
    if (value <= 0) return []
    return [
      {
        key: kind,
        label: ASSET_KIND_LABEL[kind],
        value,
        color: KIND_COLORS[kind],
      },
    ]
  })
}

function buildItemSlices(items: ValuedAsset[]): Slice[] {
  return items
    .filter((item) => item.valueKrw !== null && item.valueKrw > 0)
    .map((item, index) => ({
      key: item.object.id,
      label: item.object.title,
      value: item.valueKrw!,
      color: ITEM_PALETTE[index % ITEM_PALETTE.length],
    }))
}

export function AssetsPieChart({ items }: { items: ValuedAsset[] }) {
  const [mode, setMode] = useState<ChartMode>('kind')
  const titleId = useId()
  const slices = useMemo(
    () => (mode === 'kind' ? buildKindSlices(items) : buildItemSlices(items)),
    [items, mode],
  )
  const total = useMemo(() => slices.reduce((sum, slice) => sum + slice.value, 0), [slices])

  const size = 220
  const cx = size / 2
  const cy = size / 2
  const radius = 96

  let angle = 0
  const paths = slices.map((slice) => {
    const sweep = total > 0 ? (slice.value / total) * 360 : 0
    const startAngle = angle
    const endAngle = angle + sweep
    angle = endAngle
    const fullCircle = slices.length === 1
    return {
      ...slice,
      startAngle,
      endAngle,
      fullCircle,
      percent: total > 0 ? (slice.value / total) * 100 : 0,
    }
  })

  return (
    <section className="assets-chart" aria-labelledby={titleId}>
      <header className="assets-chart-header">
        <h2 id={titleId}>구성</h2>
        <div className="assets-chart-toggle" role="tablist" aria-label="차트 구분">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'kind'}
            className={mode === 'kind' ? 'is-active' : undefined}
            onClick={() => setMode('kind')}
          >
            종류별
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'item'}
            className={mode === 'item' ? 'is-active' : undefined}
            onClick={() => setMode('item')}
          >
            항목별
          </button>
        </div>
      </header>

      {slices.length === 0 ? (
        <p className="assets-chart-empty">평가금이 잡히면 구성이 표시됩니다.</p>
      ) : (
        <div className="assets-chart-body">
          <svg
            className="assets-chart-svg"
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            role="img"
            aria-label={mode === 'kind' ? '종류별 자산 구성' : '항목별 자산 구성'}
          >
            {paths.map((slice) =>
              slice.fullCircle ? (
                <circle
                  key={slice.key}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={slice.color}
                />
              ) : (
                <path
                  key={slice.key}
                  d={arcPath(cx, cy, radius, slice.startAngle, slice.endAngle)}
                  fill={slice.color}
                  stroke="rgba(255, 255, 255, 0.92)"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                />
              ),
            )}
          </svg>

          <ul className="assets-chart-legend">
            {paths.map((slice) => (
              <li key={slice.key}>
                <span
                  className="assets-chart-swatch"
                  style={{ background: slice.color }}
                  aria-hidden="true"
                />
                <span className="assets-chart-legend-label">{slice.label}</span>
                <span className="assets-chart-legend-meta">
                  {formatKrw(slice.value)}
                  <em>{slice.percent.toFixed(1)}%</em>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
