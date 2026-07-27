import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import * as repository from '../core/repository'
import type { LifeObject } from '../core/types'
import {
  ASSET_KIND_LABEL,
  ASSET_KIND_ORDER,
  formatKrw,
  formatQuantity,
  valueAssets,
  type AssetKind,
  type ValuedAsset,
} from '../domain/assets'
import { useLife } from '../state/LifeContext'

const COMMODITY_OPTIONS = [
  { value: 'GOLD', label: '금 (GOLD)' },
  { value: 'SILVER', label: '은 (SILVER)' },
] as const

function kindHint(kind: AssetKind): string {
  if (kind === 'cash') return '통화 코드 (예: KRW, USD, EUR)'
  if (kind === 'stock') return '티커 (예: AAPL, TSLA, 005930.KS)'
  return '금/은 중 선택'
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<AssetKind>('cash')
  const [symbol, setSymbol] = useState('KRW')
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const [dragId, setDragId] = useState<string | null>(null)
  const [dragKind, setDragKind] = useState<AssetKind | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const dragKindRef = useRef<AssetKind | null>(null)
  const itemsRef = useRef<ValuedAsset[]>([])
  const dragOrigin = useRef<ValuedAsset[] | null>(null)
  const listRefs = useRef<Partial<Record<AssetKind, HTMLUListElement | null>>>({})

  useEffect(() => {
    if (kind === 'cash') setSymbol((prev) => (prev === 'GOLD' || prev === 'SILVER' ? 'KRW' : prev || 'KRW'))
    if (kind === 'stock') setSymbol((prev) => (prev === 'KRW' || prev === 'GOLD' || prev === 'SILVER' ? '' : prev))
    if (kind === 'commodity') setSymbol((prev) => (prev === 'SILVER' ? 'SILVER' : 'GOLD'))
  }, [kind])

  useEffect(() => {
    if (!composerOpen) return
    titleInputRef.current?.focus()

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
  }, [composerOpen, saving])

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

      setPricing(true)
      setPriceError(null)
      try {
        const next = await valueAssets(assets)
        if (!active) return
        setValued(sortValued(next))
        const failed = next.filter((item) => item.error)
        if (failed.length > 0 && failed.length === next.length) {
          setPriceError(failed[0].error ?? '시세를 불러오지 못했습니다.')
        }
      } catch (error) {
        if (!active) return
        setPriceError(error instanceof Error ? error.message : '시세를 불러오지 못했습니다.')
        setValued(
          sortValued(
            assets.map((object) => ({
              object,
              kind: (object.meta.kind as AssetKind) || 'cash',
              symbol: String(object.meta.symbol ?? ''),
              quantity: typeof object.meta.quantity === 'number' ? object.meta.quantity : 0,
              unitPriceKrw: null,
              valueKrw: null,
              error: '시세 조회 실패',
            })),
          ),
        )
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

  const totalKrw = useMemo(
    () => items.reduce((sum, item) => sum + (item.valueKrw ?? 0), 0),
    [items],
  )

  const grouped = useMemo(() => {
    return ASSET_KIND_ORDER.map((groupKind) => {
      const groupItems = items.filter((item) => item.kind === groupKind)
      const subtotal = groupItems.reduce((sum, item) => sum + (item.valueKrw ?? 0), 0)
      return { kind: groupKind, items: groupItems, subtotal }
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
    const nextTitle = title.trim()
    const nextSymbol = symbol.trim().toUpperCase()
    const nextQuantity = Number(quantity)

    if (!nextTitle) {
      setFormError('이름을 입력해 주세요.')
      return
    }
    if (!nextSymbol) {
      setFormError(kindHint(kind))
      return
    }
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
      setFormError('수량을 확인해 주세요.')
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
        <Link to="/" className="back-link">
          ← 홈
        </Link>
        <div className="module-heading">
          <span className="module-icon" aria-hidden="true">
            💰
          </span>
          <h1>자산</h1>
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
                  >
                    닫기
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
                        placeholder="예: 비상금, 애플, 금"
                        disabled={!ready || saving}
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
                        {kind === 'cash' ? '통화' : kind === 'stock' ? '티커' : '물질'}
                      </label>
                      {kind === 'commodity' ? (
                        <select
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
                        {kind === 'cash' ? '금액' : kind === 'commodity' ? '수량 (oz)' : '수량 (주)'}
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

      <section className="assets-total" aria-label="총자산">
        <p className="assets-total-label">총자산</p>
        <strong className="assets-total-value">
          {!ready || pricing ? '계산 중…' : formatKrw(totalKrw)}
        </strong>
        {priceError ? <p className="assets-total-note">{priceError}</p> : null}
        {!priceError && pricing ? (
          <p className="assets-total-note">시세를 불러오는 중…</p>
        ) : null}
      </section>

      {!ready ? (
        <p className="empty-state">불러오는 중…</p>
      ) : assets.length === 0 ? (
        <div className="empty-panel">
          <h3>자산 현황</h3>
          <p>현금, 주식, 금/은을 추가하면 총자산이 여기에 모입니다.</p>
        </div>
      ) : (
        <div className="assets-groups">
          {grouped.map((group) => (
            <section key={group.kind} className="assets-group">
              <header className="assets-group-header">
                <h2>{ASSET_KIND_LABEL[group.kind]}</h2>
                <strong>{formatKrw(group.subtotal)}</strong>
              </header>
              <ul
                className="assets-list"
                ref={(node) => {
                  listRefs.current[group.kind] = node
                }}
              >
                {group.items.map((item) => (
                  <li
                    key={item.object.id}
                    className={`assets-row${dragId === item.object.id ? ' is-dragging' : ''}`}
                    data-asset-id={item.object.id}
                  >
                    <div className="assets-row-main">
                      <button
                        type="button"
                        className="assets-row-title"
                        onClick={() => openEditor(item)}
                      >
                        {item.object.title}
                      </button>
                      <p className="assets-row-meta">
                        {item.symbol} · {formatQuantity(item.kind, item.quantity, item.symbol)}
                        {item.unitPriceKrw !== null
                          ? ` · 단가 ${formatKrw(item.unitPriceKrw)}`
                          : ''}
                      </p>
                      {item.error ? <p className="assets-row-error">{item.error}</p> : null}
                    </div>
                    <div className="assets-row-side">
                      <strong>
                        {item.valueKrw !== null ? formatKrw(item.valueKrw) : '—'}
                      </strong>
                      <div className="assets-row-actions">
                        <button
                          type="button"
                          className="assets-row-edit"
                          onClick={() => openEditor(item)}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="assets-row-delete"
                          aria-label={`${item.object.title} 삭제`}
                          onClick={() => void deleteObject(item.object.id)}
                        >
                          삭제
                        </button>
                        <button
                          type="button"
                          className="assets-handle"
                          aria-label={`${item.object.title} 순서 변경`}
                          disabled={dragKind !== null && dragKind !== group.kind}
                          onPointerDown={(event) =>
                            onReorderStart(group.kind, item.object.id, event)
                          }
                        >
                          <span aria-hidden="true" />
                          <span aria-hidden="true" />
                          <span aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="assets-add-bar">
        <button
          type="button"
          className="btn btn-primary assets-add-btn"
          onClick={openComposer}
          disabled={!ready}
        >
          자산 추가
        </button>
      </div>
    </div>
  )
}
