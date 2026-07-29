import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ChartNoAxesCombined, GripVertical, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AssetsPieChart } from '../components/assets/AssetsPieChart'
import { BackLink } from '../components/ui/BackLink'
import * as repository from '../core/repository'
import type { LifeObject } from '../core/types'
import {
  ASSET_KIND_LABEL,
  ASSET_KIND_ORDER,
  assetsSnapshot,
  formatKrw,
  formatQuantity,
  isDirectPriceKind,
  summarizePortfolio,
  valueAssets,
  valueAssetsFromLatestCache,
  type AssetKind,
  type ValuedAsset,
} from '../domain/assets'
import { ensureDailyAssetSnapshot } from '../lib/assetHistory'
import { useLife } from '../state/LifeContext'

const COMMODITY_OPTIONS = [
  { value: 'GOLD', label: '금 (GOLD)' },
  { value: 'SILVER', label: '은 (SILVER)' },
] as const

const COMMODITY_TITLE: Record<string, string> = {
  GOLD: '금',
  SILVER: '은',
}

function kindHint(kind: AssetKind): string {
  if (isDirectPriceKind(kind)) return '통화 코드 (예: KRW, USD, EUR)'
  if (kind === 'stock') return '티커 (예: AAPL, TSLA, 005930.KS)'
  return '금/은 중 선택'
}

function titlePlaceholder(kind: AssetKind): string {
  if (kind === 'cash') return '예: 비상금'
  if (kind === 'real_estate') return '예: 집'
  if (kind === 'debt') return '예: 학자금 대출'
  return '티커/물질과 동일'
}

function titleFromSymbol(kind: AssetKind, nextSymbol: string): string {
  const normalized = nextSymbol.trim().toUpperCase()
  if (kind === 'commodity') return COMMODITY_TITLE[normalized] ?? normalized
  return normalized
}

function orderValue(object: LifeObject): number {
  return typeof object.meta.order === 'number' ? object.meta.order : Number.MAX_SAFE_INTEGER
}

function sortAssets(items: LifeObject[]): LifeObject[] {
  return [...items].sort((a, b) => {
    const orderDelta = orderValue(a) - orderValue(b)
    if (orderDelta !== 0) return orderDelta
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

function sortValued(items: ValuedAsset[]): ValuedAsset[] {
  return [...items].sort((a, b) => {
    const orderDelta = orderValue(a.object) - orderValue(b.object)
    if (orderDelta !== 0) return orderDelta
    return new Date(a.object.createdAt).getTime() - new Date(b.object.createdAt).getTime()
  })
}

const SWIPE_DELETE_THRESHOLD = 88

function AssetRow({
  item,
  editing,
  dragging,
  reorderDisabled,
  onEdit,
  onDelete,
  onReorderStart,
}: {
  item: ValuedAsset
  editing: boolean
  dragging: boolean
  reorderDisabled: boolean
  onEdit: () => void
  onDelete: () => void
  onReorderStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  const startX = useRef(0)
  const startY = useRef(0)
  const axis = useRef<'none' | 'x' | 'y'>('none')
  const swiping = useRef(false)
  const swiped = useRef(false)
  const [offset, setOffset] = useState(0)
  const [animating, setAnimating] = useState(false)

  function onSwipePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!editing || event.button !== 0 || dragging) return
    swiping.current = true
    swiped.current = false
    axis.current = 'none'
    setAnimating(false)
    startX.current = event.clientX
    startY.current = event.clientY
  }

  function onSwipePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!swiping.current) return

    const deltaX = event.clientX - startX.current
    const deltaY = event.clientY - startY.current

    if (axis.current === 'none') {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return
      axis.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
      if (axis.current === 'y') {
        swiping.current = false
        return
      }
      swiped.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    if (axis.current !== 'x') return
    setOffset(Math.max(-140, Math.min(0, deltaX)))
  }

  function finishSwipe(nextOffset: number) {
    if (!swiping.current && axis.current !== 'x') {
      swiping.current = false
      return
    }
    swiping.current = false
    setAnimating(true)

    if (axis.current === 'x' && nextOffset <= -SWIPE_DELETE_THRESHOLD) {
      setOffset(-140)
      window.setTimeout(() => {
        const confirmed = window.confirm(`「${item.object.title}」 자산을 삭제할까요?`)
        if (!confirmed) {
          setAnimating(true)
          setOffset(0)
          return
        }
        onDelete()
      }, 140)
      return
    }

    setOffset(0)
  }

  function onSwipePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (axis.current === 'x') {
      finishSwipe(event.clientX - startX.current)
      return
    }
    swiping.current = false
  }

  function onSwipePointerCancel() {
    if (axis.current === 'x') {
      finishSwipe(0)
      return
    }
    swiping.current = false
  }

  return (
    <li
      className={`assets-row${dragging ? ' is-dragging' : ''}`}
      data-asset-id={item.object.id}
    >
      <div
        className={`assets-swipe-track${animating ? ' is-animating' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onSwipePointerDown}
        onPointerMove={onSwipePointerMove}
        onPointerUp={onSwipePointerUp}
        onPointerCancel={onSwipePointerCancel}
      >
        <div className="assets-row-inner">
          <div className="assets-row-main">
            <div className="assets-row-heading">
              {editing ? (
                <button
                  type="button"
                  className="assets-row-title"
                  onClick={() => {
                    if (swiped.current) return
                    onEdit()
                  }}
                >
                  {item.object.title}
                </button>
              ) : (
                <span className="assets-row-title">{item.object.title}</span>
              )}
              {!isDirectPriceKind(item.kind) ? (
                <span className="assets-row-qty">
                  {formatQuantity(item.kind, item.quantity, item.symbol)}
                </span>
              ) : null}
            </div>
            {item.error ? <p className="assets-row-error">{item.error}</p> : null}
          </div>
          <div className="assets-row-side">
            <strong>{item.valueKrw !== null ? formatKrw(item.valueKrw) : '—'}</strong>
            {editing ? (
              <div className="assets-row-actions">
                <button
                  type="button"
                  className="assets-row-edit"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    onEdit()
                  }}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="assets-handle"
                  aria-label={`${item.object.title} 순서 변경`}
                  disabled={reorderDisabled}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    onReorderStart(event)
                  }}
                >
                  <GripVertical size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="assets-swipe-action" aria-hidden="true">
          삭제
        </div>
      </div>
    </li>
  )
}

export function AssetsPage() {
  const { ready, objects, createObject, updateObject, deleteObject, refresh } = useLife()
  const assets = useMemo(
    () => sortAssets(objects.filter((object) => object.type === 'asset')),
    [objects],
  )

  const [valued, setValued] = useState<ValuedAsset[]>([])
  const [items, setItems] = useState<ValuedAsset[]>([])
  const [pricing, setPricing] = useState(false)
  const [priceError, setPriceError] = useState<string | null>(null)

  const [composerOpen, setComposerOpen] = useState(false)
  const [editingMode, setEditingMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<AssetKind>('cash')
  const [symbol, setSymbol] = useState('KRW')
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const symbolInputRef = useRef<HTMLInputElement>(null)
  const symbolSelectRef = useRef<HTMLSelectElement>(null)

  const [dragId, setDragId] = useState<string | null>(null)
  const [dragKind, setDragKind] = useState<AssetKind | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const dragKindRef = useRef<AssetKind | null>(null)
  const itemsRef = useRef<ValuedAsset[]>([])
  const dragOrigin = useRef<ValuedAsset[] | null>(null)
  const listRefs = useRef<Partial<Record<AssetKind, HTMLUListElement | null>>>({})

  useEffect(() => {
    if (isDirectPriceKind(kind)) {
      setSymbol((prev) => (prev === 'GOLD' || prev === 'SILVER' ? 'KRW' : prev || 'KRW'))
    }
    if (kind === 'stock') setSymbol((prev) => (prev === 'KRW' || prev === 'GOLD' || prev === 'SILVER' ? '' : prev))
    if (kind === 'commodity') setSymbol((prev) => (prev === 'SILVER' ? 'SILVER' : 'GOLD'))
  }, [kind])

  useEffect(() => {
    if (isDirectPriceKind(kind)) return
    setTitle(titleFromSymbol(kind, symbol))
  }, [kind, symbol])

  useEffect(() => {
    if (!composerOpen) return
    if (isDirectPriceKind(kind)) titleInputRef.current?.focus()
    else if (kind === 'commodity') symbolSelectRef.current?.focus()
    else symbolInputRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) closeComposer()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [composerOpen, saving, kind])

  useEffect(() => {
    if (!ready) return
    let active = true

    ;(async () => {
      if (assets.length === 0) {
        if (active) {
          setValued([])
          setPriceError(null)
          setPricing(false)
        }
        return
      }

      setPriceError(null)
      // 보유 목록은 바로 두고, DB에 있는 최신 시세(전일 포함)로 먼저 평가금을 채움.
      setValued(sortValued(assetsSnapshot(assets)))
      setPricing(false)

      const cached = await valueAssetsFromLatestCache(assets)
      if (!active) return

      if (cached) {
        const sorted = sortValued(cached.valued)
        setValued(sorted)
        if (cached.fresh) {
          setPricing(false)
          void ensureDailyAssetSnapshot(sorted)
          return
        }
      }

      // 당일 미조회 시세가 있으면 전일 값을 보여 둔 채 새로고침.
      setPricing(true)

      try {
        const next = await valueAssets(assets)
        if (!active) return
        const sorted = sortValued(next)
        setValued(sorted)
        const failed = next.filter((item) => item.error)
        if (failed.length > 0 && failed.length === next.length) {
          setPriceError(failed[0].error ?? '시세를 불러오지 못했습니다.')
        } else {
          void ensureDailyAssetSnapshot(sorted)
        }
      } catch (error) {
        if (!active) return
        setPriceError(error instanceof Error ? error.message : '시세를 불러오지 못했습니다.')
        // 전일 캐시가 있으면 그대로 두고, 없을 때만 스냅샷으로 되돌림.
        if (!cached) {
          setValued(sortValued(assetsSnapshot(assets)))
        }
      } finally {
        if (active) setPricing(false)
      }
    })()

    return () => {
      active = false
    }
  }, [ready, assets])

  useEffect(() => {
    if (dragId) return
    setItems(valued)
  }, [valued, dragId])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const portfolio = useMemo(() => summarizePortfolio(items), [items])

  const grouped = useMemo(() => {
    return ASSET_KIND_ORDER.map((groupKind) => {
      const groupItems = items.filter((item) => item.kind === groupKind)
      const pending = groupItems.some((item) => item.valueKrw === null)
      const subtotal = groupItems.reduce((sum, item) => sum + (item.valueKrw ?? 0), 0)
      return { kind: groupKind, items: groupItems, subtotal, pending }
    }).filter((group) => group.items.length > 0)
  }, [items])

  function resetComposer() {
    setEditingId(null)
    setTitle('')
    setQuantity('')
    setKind('cash')
    setSymbol('KRW')
    setFormError(null)
  }

  function openComposer() {
    resetComposer()
    setComposerOpen(true)
  }

  function openEditor(item: ValuedAsset) {
    setEditingId(item.object.id)
    setTitle(item.object.title)
    setKind(item.kind)
    setSymbol(item.symbol)
    setQuantity(String(item.quantity))
    setFormError(null)
    setComposerOpen(true)
  }

  function closeComposer() {
    setComposerOpen(false)
    setEditingId(null)
    setFormError(null)
  }

  async function persistOrder(next: ValuedAsset[]) {
    await Promise.all(
      next.map((item, index) =>
        repository.updateObject(item.object.id, {
          meta: { ...item.object.meta, order: index },
        }),
      ),
    )
    await refresh()
  }

  function moveDraggedToIndex(nextIndex: number) {
    const id = dragIdRef.current
    const groupKind = dragKindRef.current
    if (!id || !groupKind) return

    setItems((current) => {
      const groupItems = current.filter((item) => item.kind === groupKind)
      const fromIndex = groupItems.findIndex((item) => item.object.id === id)
      if (fromIndex < 0 || fromIndex === nextIndex) return current

      const nextGroup = [...groupItems]
      const [moved] = nextGroup.splice(fromIndex, 1)
      nextGroup.splice(nextIndex, 0, moved)

      let cursor = 0
      return current.map((item) => {
        if (item.kind !== groupKind) return item
        const replacement = nextGroup[cursor]
        cursor += 1
        return replacement
      })
    })
  }

  function onReorderStart(
    groupKind: AssetKind,
    assetId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) return
    event.preventDefault()

    dragOrigin.current = itemsRef.current
    dragIdRef.current = assetId
    dragKindRef.current = groupKind
    setDragId(assetId)
    setDragKind(groupKind)

    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)

    const onMove = (moveEvent: PointerEvent) => {
      const list = listRefs.current[groupKind]
      if (!list) return
      const rows = [...list.querySelectorAll<HTMLElement>('[data-asset-id]')]
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

      const current = itemsRef.current
      const origin = dragOrigin.current
      const activeKind = dragKindRef.current
      dragOrigin.current = null
      dragIdRef.current = null
      dragKindRef.current = null
      setDragId(null)
      setDragKind(null)

      if (!activeKind) return

      const originGroup = origin?.filter((item) => item.kind === activeKind) ?? []
      const currentGroup = current.filter((item) => item.kind === activeKind)
      const changed =
        originGroup.length !== currentGroup.length ||
        originGroup.some((item, index) => item.object.id !== currentGroup[index]?.object.id)

      if (changed) void persistOrder(currentGroup)
    }

    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', finish)
    handle.addEventListener('pointercancel', finish)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    const nextSymbol = symbol.trim().toUpperCase()
    const nextTitle = isDirectPriceKind(kind) ? title.trim() : titleFromSymbol(kind, nextSymbol)
    const nextQuantity = Number(quantity)

    if (isDirectPriceKind(kind) && !nextTitle) {
      setFormError('이름을 입력해 주세요.')
      return
    }
    if (!nextSymbol) {
      setFormError(kindHint(kind))
      return
    }
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
      setFormError(isDirectPriceKind(kind) ? '금액을 확인해 주세요.' : '수량을 확인해 주세요.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      if (editingId) {
        const existing = assets.find((asset) => asset.id === editingId)
        await updateObject(editingId, {
          title: nextTitle,
          meta: {
            ...(existing?.meta ?? {}),
            kind,
            symbol: nextSymbol,
            quantity: nextQuantity,
            order:
              typeof existing?.meta.order === 'number'
                ? existing.meta.order
                : assets.reduce((max, asset) => {
                    const value = typeof asset.meta.order === 'number' ? asset.meta.order : -1
                    return Math.max(max, value)
                  }, -1) + 1,
          },
        })
      } else {
        const nextOrder =
          assets.reduce((max, asset) => {
            const value = typeof asset.meta.order === 'number' ? asset.meta.order : -1
            return Math.max(max, value)
          }, -1) + 1

        await createObject({
          type: 'asset',
          title: nextTitle,
          meta: {
            kind,
            symbol: nextSymbol,
            quantity: nextQuantity,
            order: nextOrder,
          },
        })
      }
      resetComposer()
      setComposerOpen(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="module-page assets-page">
      <div className="module-header">
        <BackLink to="/" />
        <div className="module-heading module-heading--assets">
          <h1>자산</h1>
          <Link
            to="/assets/history"
            className="assets-history-link"
            aria-label="자산 추이"
          >
            <ChartNoAxesCombined size={20} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {composerOpen
        ? createPortal(
            <div className="assets-modal-root">
              <button
                type="button"
                className="assets-modal-backdrop"
                aria-label="닫기"
                onClick={closeComposer}
                disabled={saving}
              />
              <div
                className="assets-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="assets-modal-title"
              >
                <header className="assets-composer-header">
                  <h2 id="assets-modal-title">{editingId ? '자산 수정' : '자산 추가'}</h2>
                  <button
                    type="button"
                    className="assets-composer-close"
                    onClick={closeComposer}
                    disabled={saving}
                    aria-label="닫기"
                  >
                    <X size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                </header>
                <form onSubmit={handleSave}>
                  <div className="assets-composer-grid">
                    <div className="field">
                      <label htmlFor="asset-title">이름</label>
                      <input
                        ref={titleInputRef}
                        id="asset-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder={titlePlaceholder(kind)}
                        disabled={!ready || saving || !isDirectPriceKind(kind)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="asset-kind">종류</label>
                      <select
                        id="asset-kind"
                        value={kind}
                        onChange={(event) => setKind(event.target.value as AssetKind)}
                        disabled={!ready || saving}
                      >
                        {ASSET_KIND_ORDER.map((item) => (
                          <option key={item} value={item}>
                            {ASSET_KIND_LABEL[item]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="asset-symbol">
                        {isDirectPriceKind(kind)
                          ? '통화'
                          : kind === 'stock'
                            ? '티커'
                            : '물질'}
                      </label>
                      {kind === 'commodity' ? (
                        <select
                          ref={symbolSelectRef}
                          id="asset-symbol"
                          value={symbol}
                          onChange={(event) => setSymbol(event.target.value)}
                          disabled={!ready || saving}
                        >
                          {COMMODITY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          ref={symbolInputRef}
                          id="asset-symbol"
                          value={symbol}
                          onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                          placeholder={kindHint(kind)}
                          disabled={!ready || saving}
                          autoComplete="off"
                        />
                      )}
                    </div>
                    <div className="field">
                      <label htmlFor="asset-quantity">
                        {isDirectPriceKind(kind)
                          ? '금액'
                          : kind === 'commodity'
                            ? '수량 (g)'
                            : '수량 (주)'}
                      </label>
                      <input
                        id="asset-quantity"
                        type="number"
                        min={0}
                        step="any"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        placeholder="0"
                        disabled={!ready || saving}
                      />
                    </div>
                  </div>
                  {formError ? <p className="form-error">{formError}</p> : null}
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={closeComposer}
                      disabled={saving}
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!ready || saving}
                    >
                      {saving ? '저장 중…' : '저장'}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      <div
        className={`assets-summary${ready && assets.length > 0 ? ' has-chart' : ''}`}
      >
        <section className="assets-total" aria-label="순자산">
          <p className="assets-total-label">순자산</p>
          <strong className="assets-total-value">
            {!ready
              ? '계산 중…'
              : portfolio.pending
                ? pricing
                  ? '계산 중…'
                  : '—'
                : formatKrw(portfolio.netAssetsKrw)}
          </strong>
          {ready && !portfolio.pending ? (
            <dl className="assets-total-breakdown">
              <div>
                <dt>총자산</dt>
                <dd>{formatKrw(portfolio.grossAssetsKrw)}</dd>
              </div>
              <div>
                <dt>부채</dt>
                <dd>{formatKrw(portfolio.debtKrw)}</dd>
              </div>
            </dl>
          ) : null}
          {priceError ? <p className="assets-total-note">{priceError}</p> : null}
          {!priceError && pricing ? (
            <p className="assets-total-note">새로고침 중…</p>
          ) : null}
        </section>
        {ready && assets.length > 0 ? <AssetsPieChart items={items} /> : null}
      </div>

      {!ready ? (
        <p className="empty-state">불러오는 중…</p>
      ) : assets.length === 0 ? (
        <div className="empty-panel">
          <h3>자산 현황</h3>
          <p>현금, 주식, 금/은, 부동산, 부채를 추가하면 순자산이 여기에 모입니다.</p>
        </div>
      ) : (
        <div className="assets-groups">
          {grouped.map((group) => (
            <section key={group.kind} className="assets-group">
              <header className="assets-group-header">
                <h2>{ASSET_KIND_LABEL[group.kind]}</h2>
                <strong>{group.pending ? '—' : formatKrw(group.subtotal)}</strong>
              </header>
              <ul
                className="assets-list"
                ref={(node) => {
                  listRefs.current[group.kind] = node
                }}
              >
                {group.items.map((item) => (
                  <AssetRow
                    key={item.object.id}
                    item={item}
                    editing={editingMode}
                    dragging={dragId === item.object.id}
                    reorderDisabled={dragKind !== null && dragKind !== group.kind}
                    onEdit={() => openEditor(item)}
                    onDelete={() => void deleteObject(item.object.id)}
                    onReorderStart={(event) =>
                      onReorderStart(group.kind, item.object.id, event)
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="assets-footer-bar">
        {editingMode ? (
          <button
            type="button"
            className="btn btn-primary assets-add-btn"
            onClick={openComposer}
            disabled={!ready}
          >
            자산 추가
          </button>
        ) : null}
        <button
          type="button"
          className={`btn ${editingMode ? 'btn-ghost' : 'btn-primary'} assets-edit-mode-btn`}
          onClick={() => setEditingMode((value) => !value)}
          disabled={!ready}
          aria-pressed={editingMode}
        >
          {editingMode ? '편집 완료' : '자산 편집'}
        </button>
      </div>
    </div>
  )
}
