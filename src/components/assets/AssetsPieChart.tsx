import { useId, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  ASSET_KIND_ORDER,
  assetKindLabel,
  formatKrw,
  isLiabilityKind,
  type AssetKind,
  type ValuedAsset,
} from '../../domain/assets'
import { useT } from '../../state/LocaleContext'

type ChartMode = 'kind' | 'item'

interface Slice {
  key: string
  label: string
  value: number
  color: string
}

interface SliceWithPercent extends Slice {
  percent: number
}

const OTHER_KEY = '__other__'
const OTHER_COLOR = '#9AA4A8'
const MINOR_THRESHOLD = 1

const KIND_COLORS: Record<AssetKind, string> = {
  cash: '#D4A84B',
  stock: '#5BA88A',
  commodity: '#C97B5A',
  real_estate: '#6B9EC4',
  debt: '#A67C9A',
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

function buildKindSlices(items: ValuedAsset[]): Slice[] {
  return ASSET_KIND_ORDER.flatMap((kind) => {
    if (isLiabilityKind(kind)) return []
    const value = items
      .filter((item) => item.kind === kind && item.valueKrw !== null)
      .reduce((sum, item) => sum + (item.valueKrw ?? 0), 0)
    if (value <= 0) return []
    return [
      {
        key: kind,
        label: assetKindLabel(kind),
        value,
        color: KIND_COLORS[kind],
      },
    ]
  })
}

function buildItemSlices(items: ValuedAsset[]): Slice[] {
  return items
    .filter(
      (item) =>
        !isLiabilityKind(item.kind) && item.valueKrw !== null && item.valueKrw > 0,
    )
    .map((item, index) => ({
      key: item.object.id,
      label: item.object.title,
      value: item.valueKrw!,
      color: ITEM_PALETTE[index % ITEM_PALETTE.length],
    }))
}

function withPercents(slices: Slice[], total: number): SliceWithPercent[] {
  return slices.map((slice) => ({
    ...slice,
    percent: total > 0 ? (slice.value / total) * 100 : 0,
  }))
}

function groupMinorSlices(
  slices: SliceWithPercent[],
  total: number,
  otherLabel: string,
) {
  const major = slices.filter((slice) => slice.percent >= MINOR_THRESHOLD)
  const minor = slices.filter((slice) => slice.percent < MINOR_THRESHOLD)

  if (minor.length === 0 || major.length === 0) {
    return { chartSlices: slices, otherItems: [] as SliceWithPercent[] }
  }

  const otherValue = minor.reduce((sum, slice) => sum + slice.value, 0)
  const other: SliceWithPercent = {
    key: OTHER_KEY,
    label: otherLabel,
    value: otherValue,
    color: OTHER_COLOR,
    percent: total > 0 ? (otherValue / total) * 100 : 0,
  }

  return {
    chartSlices: [...major, other],
    otherItems: minor,
  }
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: SliceWithPercent }>
}) {
  if (!active || !payload?.[0]) return null
  const slice = payload[0].payload
  return (
    <div className="assets-chart-tooltip">
      <strong>{slice.label}</strong>
      <span>
        {formatKrw(slice.value)} · {slice.percent.toFixed(1)}%
      </span>
    </div>
  )
}

function LegendRow({ slice }: { slice: SliceWithPercent }) {
  return (
    <>
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
    </>
  )
}

export function AssetsPieChart({ items }: { items: ValuedAsset[] }) {
  const t = useT()
  const [mode, setMode] = useState<ChartMode>('kind')
  const [chartOpen, setChartOpen] = useState(true)
  const [otherOpen, setOtherOpen] = useState(false)
  const titleId = useId()
  const bodyId = useId()
  const otherPanelId = useId()

  const slices = useMemo(
    () => (mode === 'kind' ? buildKindSlices(items) : buildItemSlices(items)),
    [items, mode],
  )
  const total = useMemo(() => slices.reduce((sum, slice) => sum + slice.value, 0), [slices])
  const { chartSlices, otherItems } = useMemo(
    () => groupMinorSlices(withPercents(slices, total), total, t('assets.other')),
    [slices, total, t],
  )

  function setChartMode(next: ChartMode) {
    setMode(next)
    setOtherOpen(false)
  }

  return (
    <section
      className={`assets-chart${chartOpen ? '' : ' is-collapsed'}`}
      aria-labelledby={titleId}
    >
      <header className="assets-chart-header">
        <button
          type="button"
          className="assets-chart-collapse"
          aria-expanded={chartOpen}
          aria-controls={bodyId}
          onClick={() => setChartOpen((open) => !open)}
        >
          <h2 id={titleId}>{t('assets.chartTitle')}</h2>
          <span className="assets-chart-collapse-caret" aria-hidden="true">
            {chartOpen ? (
              <ChevronDown size={14} strokeWidth={2} />
            ) : (
              <ChevronRight size={14} strokeWidth={2} />
            )}
          </span>
        </button>
        {chartOpen ? (
          <div className="assets-chart-toggle" role="tablist" aria-label={t('assets.chartToggle')}>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'kind'}
              className={mode === 'kind' ? 'is-active' : undefined}
              onClick={() => setChartMode('kind')}
            >
              {t('assets.chartByKind')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'item'}
              className={mode === 'item' ? 'is-active' : undefined}
              onClick={() => setChartMode('item')}
            >
              {t('assets.chartByItem')}
            </button>
          </div>
        ) : null}
      </header>

      {chartOpen ? (
        <div id={bodyId}>
          {chartSlices.length === 0 ? (
            <p className="assets-chart-empty">{t('assets.chartEmpty')}</p>
          ) : (
            <div className="assets-chart-body">
              <div
                className="assets-chart-svg"
                role="img"
                aria-label={mode === 'kind' ? t('assets.chartKindAria') : t('assets.chartItemAria')}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartSlices}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius="92%"
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {chartSlices.map((slice) => (
                        <Cell key={slice.key} fill={slice.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <ul className="assets-chart-legend">
                {chartSlices.map((slice) => {
                  if (slice.key !== OTHER_KEY) {
                    return (
                      <li key={slice.key}>
                        <LegendRow slice={slice} />
                      </li>
                    )
                  }

                  return (
                    <li key={slice.key} className="assets-chart-other">
                      <button
                        type="button"
                        className="assets-chart-other-toggle"
                        aria-expanded={otherOpen}
                        aria-controls={otherPanelId}
                        onClick={() => setOtherOpen((open) => !open)}
                      >
                        <LegendRow slice={slice} />
                        <span className="assets-chart-other-caret" aria-hidden="true">
                          {otherOpen ? (
                            <ChevronDown size={12} strokeWidth={2} />
                          ) : (
                            <ChevronRight size={12} strokeWidth={2} />
                          )}
                        </span>
                      </button>
                      {otherOpen ? (
                        <ul id={otherPanelId} className="assets-chart-other-list">
                          {otherItems.map((item) => (
                            <li key={item.key}>
                              <LegendRow slice={item} />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
