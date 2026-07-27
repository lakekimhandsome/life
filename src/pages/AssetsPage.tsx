import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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

export function AssetsPage() {
  const { ready, objects, createObject, deleteObject } = useLife()
  const assets = useMemo(
    () => objects.filter((object) => object.type === 'asset'),
    [objects],
  )

  const [valued, setValued] = useState<ValuedAsset[]>([])
  const [pricing, setPricing] = useState(false)
  const [priceError, setPriceError] = useState<string | null>(null)

  const [composerOpen, setComposerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<AssetKind>('cash')
  const [symbol, setSymbol] = useState('KRW')
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

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
        setValued(next)
        const failed = next.filter((item) => item.error)
        if (failed.length > 0 && failed.length === next.length) {
          setPriceError(failed[0].error ?? '시세를 불러오지 못했습니다.')
        }
      } catch (error) {
        if (!active) return
        setPriceError(error instanceof Error ? error.message : '시세를 불러오지 못했습니다.')
        setValued(
          assets.map((object) => ({
            object,
            kind: (object.meta.kind as AssetKind) || 'cash',
            symbol: String(object.meta.symbol ?? ''),
            quantity: typeof object.meta.quantity === 'number' ? object.meta.quantity : 0,
            unitPriceKrw: null,
            valueKrw: null,
            error: '시세 조회 실패',
          })),
        )
      } finally {
        if (active) setPricing(false)
      }
    })()

    return () => {
      active = false
    }
  }, [ready, assets])

  const totalKrw = useMemo(
    () => valued.reduce((sum, item) => sum + (item.valueKrw ?? 0), 0),
    [valued],
  )

  const grouped = useMemo(() => {
    return ASSET_KIND_ORDER.map((groupKind) => {
      const items = valued.filter((item) => item.kind === groupKind)
      const subtotal = items.reduce((sum, item) => sum + (item.valueKrw ?? 0), 0)
      return { kind: groupKind, items, subtotal }
    }).filter((group) => group.items.length > 0)
  }, [valued])

  function resetComposer() {
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

  function closeComposer() {
    setComposerOpen(false)
    setFormError(null)
  }

  async function handleAdd(event: FormEvent) {
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
      await createObject({
        type: 'asset',
        title: nextTitle,
        meta: {
          kind,
          symbol: nextSymbol,
          quantity: nextQuantity,
        },
      })
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

      {composerOpen ? (
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
              <h2 id="assets-modal-title">자산 추가</h2>
              <button
                type="button"
                className="assets-composer-close"
                onClick={closeComposer}
                disabled={saving}
              >
                닫기
              </button>
            </header>
            <form onSubmit={handleAdd}>
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
        </div>
      ) : null}

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
              <ul className="assets-list">
                {group.items.map((item) => (
                  <li key={item.object.id} className="assets-row">
                    <div className="assets-row-main">
                      <Link to={`/object/${item.object.id}`} className="assets-row-title">
                        {item.object.title}
                      </Link>
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
                      <button
                        type="button"
                        className="assets-row-delete"
                        aria-label={`${item.object.title} 삭제`}
                        onClick={() => void deleteObject(item.object.id)}
                      >
                        삭제
                      </button>
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
