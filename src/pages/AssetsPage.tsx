import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ChartNoAxesCombined, Check, GripVertical, Pencil, Plus, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AssetsPieChart } from '../components/assets/AssetsPieChart'
import { BackLink } from '../components/ui/BackLink'
import * as repository from '../core/repository'
import type { LifeObject } from '../core/types'
import {
  ASSET_KIND_ORDER,
  assetKindLabel,
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
import { t as translate } from '../i18n'
import { ensureDailyAssetSnapshot } from '../lib/assetHistory'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'

const COMMODITY_OPTIONS = [
  { value: 'GOLD', labelKey: 'assets.goldOption' },
  { value: 'SILVER', labelKey: 'assets.silverOption' },
] as const

function commodityTitle(symbol: string): string {
  if (symbol === 'GOLD') return translate('assets.gold')
  if (symbol === 'SILVER') return translate('assets.silver')
  return symbol
}

function kindHint(kind: AssetKind): string {
  if (isDirectPriceKind(kind)) return translate('assets.hint.currency')
  if (kind === 'stock') return translate('assets.hint.ticker')
  return translate('assets.hint.commodity')
}

function titlePlaceholder(kind: AssetKind): string {
  if (kind === 'cash') return translate('assets.placeholder.cash')
  if (kind === 'real_estate') return translate('assets.placeholder.realEstate')
  if (kind === 'debt') return translate('assets.placeholder.debt')
  return translate('assets.placeholder.other')
}

function titleFromSymbol(kind: AssetKind, nextSymbol: string): string {
  const normalized = nextSymbol.trim().toUpperCase()
  if (kind === 'commodity') return commodityTitle(normalized)
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

function formatAssetValue(kind: AssetKind, value: number): string {
  return formatKrw(kind === 'debt' ? -value : value)
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
  const t = useT()
  const startX = useRef(0)
  const startY = useRef(0)
  const axis = useRef<'none' | 'x' | 'y'>('none')
  const swiping = useRef(false)
  const swiped = useRef(false)
  const offsetRef = useRef(0)
  const [offset, setOffset] = useState(0)
  const [animating, setAnimating] = useState(false)

  function updateOffset(nextOffset: number) {
    offsetRef.current = nextOffset
    setOffset(nextOffset)
  }

  function requestDelete() {
    const confirmed = window.confirm(t('assets.deleteConfirm', { title: item.object.title }))
    if (!confirmed) {
      setAnimating(true)
      updateOffset(0)
      return
    }
    onDelete()
  }

  function onSwipePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!editing || event.button !== 0 || dragging) return
    swiping.current = true
    swiped.current = false
    axis.current = 'none'
    offsetRef.current = 0
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
    event.preventDefault()
    updateOffset(Math.max(-140, Math.min(0, deltaX)))
  }

  function finishSwipe(nextOffset: number) {
    if (!swiping.current && axis.current !== 'x') {
      swiping.current = false
      return
    }
    swiping.current = false
    setAnimating(true)

    if (axis.current === 'x' && nextOffset <= -SWIPE_DELETE_THRESHOLD) {
      updateOffset(-140)
      requestDelete()
      return
    }

    updateOffset(0)
  }

  function onSwipePointerUp() {
    if (axis.current === 'x') {
      finishSwipe(offsetRef.current)
      return
    }
    swiping.current = false
  }

  function onSwipePointerCancel() {
    swiping.current = false
    setAnimating(true)
    updateOffset(0)
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
            <strong>
              {item.valueKrw !== null ? formatAssetValue(item.kind, item.valueKrw) : '—'}
            </strong>
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
                  {t('common.edit')}
                </button>
                <button
                  type="button"
                  className="assets-row-delete"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    requestDelete()
                  }}
                >
                  {t('common.delete')}
                </button>
                <button
                  type="button"
                  className="assets-handle"
                  aria-label={t('assets.reorder', { title: item.object.title })}
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
          {t('common.delete')}
        </div>
      </div>
    </li>
  )
}

export function AssetsPage() {
  const t = useT()
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
          setPriceError(failed[0].error ?? translate('assets.priceFailed'))
        } else {
          void ensureDailyAssetSnapshot(sorted)
        }
      } catch (error) {
        if (!active) return
        setPriceError(error instanceof Error ? error.message : translate('assets.priceFailed'))
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
      setFormError(t('assets.needName'))
      return
    }
    if (!nextSymbol) {
      setFormError(kindHint(kind))
      return
    }
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
      setFormError(isDirectPriceKind(kind) ? t('assets.needAmount') : t('assets.needQuantity'))
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
      setFormError(error instanceof Error ? error.message : t('form.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="module-page assets-page">
      <div className="module-header module-heading--assets">
        <BackLink to="/" />
        <div className="module-heading module-heading--assets">
          <h1>{t('modules.assets')}</h1>
        </div>
        <div className="module-header-actions">
          <Link
            to="/assets/history"
            className="module-header-btn"
            aria-label={t('assets.history')}
          >
            <ChartNoAxesCombined size={22} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="module-header-btn"
            onClick={openComposer}
            disabled={!ready}
            aria-label={t('assets.add')}
          >
            <Plus size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="module-header-btn"
            onClick={() => setEditingMode((value) => !value)}
            disabled={!ready}
            aria-label={editingMode ? t('assets.editDone') : t('assets.edit')}
            aria-pressed={editingMode}
          >
            {editingMode ? (
              <Check size={22} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Pencil size={22} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {composerOpen
        ? createPortal(
            <div className="assets-modal-root">
              <button
                type="button"
                className="assets-modal-backdrop"
                aria-label={t('common.close')}
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
                  <h2 id="assets-modal-title">{editingId ? t('assets.editItem') : t('assets.add')}</h2>
                  <button
                    type="button"
                    className="assets-composer-close"
                    onClick={closeComposer}
                    disabled={saving}
                    aria-label={t('common.close')}
                  >
                    <X size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                </header>
                <form onSubmit={handleSave}>
                  <div className="assets-composer-grid">
                    <div className="field">
                      <label htmlFor="asset-title">{t('assets.name')}</label>
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
                      <label htmlFor="asset-kind">{t('assets.kind')}</label>
                      <select
                        id="asset-kind"
                        value={kind}
                        onChange={(event) => setKind(event.target.value as AssetKind)}
                        disabled={!ready || saving}
                      >
                        {ASSET_KIND_ORDER.map((item) => (
                          <option key={item} value={item}>
                            {assetKindLabel(item)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="asset-symbol">
                        {isDirectPriceKind(kind)
                          ? t('assets.currency')
                          : kind === 'stock'
                            ? t('assets.ticker')
                            : t('assets.commodity')}
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
                              {t(option.labelKey)}
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
                          ? t('assets.amount')
                          : kind === 'commodity'
                            ? t('assets.qtyGrams')
                            : t('assets.qtyShares')}
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
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!ready || saving}
                    >
                      {saving ? t('common.saving') : t('common.save')}
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
        <section className="assets-total" aria-label={t('assets.netWorth')}>
          <p className="assets-total-label">{t('assets.netWorth')}</p>
          <strong className="assets-total-value">
            {!ready
              ? t('assets.calculating')
              : portfolio.pending
                ? pricing
                  ? t('assets.calculating')
                  : '—'
                : formatKrw(portfolio.netAssetsKrw)}
          </strong>
          {ready && !portfolio.pending ? (
            <dl className="assets-total-breakdown">
              <div>
                <dt>{t('assets.gross')}</dt>
                <dd>{formatKrw(portfolio.grossAssetsKrw)}</dd>
              </div>
              <div>
                <dt>{t('assets.kind.debt')}</dt>
                <dd>{formatKrw(portfolio.debtKrw)}</dd>
              </div>
            </dl>
          ) : null}
          {priceError ? <p className="assets-total-note">{priceError}</p> : null}
          {!priceError && pricing ? (
            <p className="assets-total-note">{t('assets.refreshing')}</p>
          ) : null}
        </section>
        {ready && assets.length > 0 ? <AssetsPieChart items={items} /> : null}
      </div>

      {!ready ? (
        <p className="empty-state">{t('common.loading')}</p>
      ) : assets.length === 0 ? (
        <div className="empty-panel">
          <h3>{t('assets.emptyTitle')}</h3>
          <p>{t('assets.emptyBody')}</p>
        </div>
      ) : (
        <div className="assets-groups">
          {grouped.map((group) => (
            <section key={group.kind} className="assets-group">
              <header className="assets-group-header">
                <h2>{assetKindLabel(group.kind)}</h2>
                <strong>
                  {group.pending ? '—' : formatAssetValue(group.kind, group.subtotal)}
                </strong>
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

    </div>
  )
}
