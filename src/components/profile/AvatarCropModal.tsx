import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const OUTPUT = 512
const ZOOM_MIN = 1
const ZOOM_MAX = 3

function cropViewportSize() {
  return Math.max(220, Math.min(280, window.innerWidth - 88))
}

type AvatarCropModalProps = {
  file: File
  busy?: boolean
  onCancel: () => void
  onConfirm: (blob: Blob) => Promise<void>
}

function minScaleFor(image: HTMLImageElement, viewport: number) {
  return Math.max(viewport / image.naturalWidth, viewport / image.naturalHeight)
}

function clampOffset(
  offsetX: number,
  offsetY: number,
  image: HTMLImageElement,
  scale: number,
  viewport: number,
) {
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  return {
    x: Math.min(0, Math.max(viewport - width, offsetX)),
    y: Math.min(0, Math.max(viewport - height, offsetY)),
  }
}

function exportCrop(
  image: HTMLImageElement,
  offsetX: number,
  offsetY: number,
  scale: number,
  viewport: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT
  canvas.height = OUTPUT
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return Promise.reject(new Error('이미지를 처리하지 못했습니다.'))
  }

  const ratio = OUTPUT / viewport
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, OUTPUT, OUTPUT)
  ctx.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    offsetX * ratio,
    offsetY * ratio,
    image.naturalWidth * scale * ratio,
    image.naturalHeight * scale * ratio,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지를 처리하지 못했습니다.'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      0.9,
    )
  })
}

export function AvatarCropModal({
  file,
  busy = false,
  onCancel,
  onConfirm,
}: AvatarCropModalProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  const [viewport] = useState(cropViewportSize)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [crop, setCrop] = useState({ zoom: 1, x: 0, y: 0 })
  const [exporting, setExporting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    const next = new Image()
    next.decoding = 'async'
    next.onload = () => {
      const nextScale = minScaleFor(next, viewport)
      setImage(next)
      setCrop({
        zoom: 1,
        x: (viewport - next.naturalWidth * nextScale) / 2,
        y: (viewport - next.naturalHeight * nextScale) / 2,
      })
      setLoadError(null)
    }
    next.onerror = () => {
      setLoadError('이 이미지 형식은 지원하지 않습니다. JPG 또는 PNG를 선택해 주세요.')
    }
    next.src = objectUrl

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [file, viewport])

  useEffect(() => {
    const node = viewportRef.current
    if (!node || !image) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const delta = event.deltaY > 0 ? -0.12 : 0.12
      setCrop((current) => {
        const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current.zoom + delta))
        const prevScale = minScaleFor(image, viewport) * current.zoom
        const nextScale = minScaleFor(image, viewport) * nextZoom
        const focusX = (viewport / 2 - current.x) / prevScale
        const focusY = (viewport / 2 - current.y) / prevScale
        const nextOffset = clampOffset(
          viewport / 2 - focusX * nextScale,
          viewport / 2 - focusY * nextScale,
          image,
          nextScale,
          viewport,
        )
        return { zoom: nextZoom, x: nextOffset.x, y: nextOffset.y }
      })
    }

    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [image, viewport])

  const scale = image ? minScaleFor(image, viewport) * crop.zoom : 1
  const saving = busy || exporting

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!image || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: crop.x,
      originY: crop.y,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || !image || drag.pointerId !== event.pointerId) return
    const nextOffset = clampOffset(
      drag.originX + (event.clientX - drag.startX),
      drag.originY + (event.clientY - drag.startY),
      image,
      scale,
      viewport,
    )
    setCrop((current) => ({ ...current, x: nextOffset.x, y: nextOffset.y }))
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  function handleZoomChange(nextZoom: number) {
    if (!image) return
    const prevScale = minScaleFor(image, viewport) * crop.zoom
    const nextScale = minScaleFor(image, viewport) * nextZoom
    const focusX = (viewport / 2 - crop.x) / prevScale
    const focusY = (viewport / 2 - crop.y) / prevScale
    const nextOffset = clampOffset(
      viewport / 2 - focusX * nextScale,
      viewport / 2 - focusY * nextScale,
      image,
      nextScale,
      viewport,
    )
    setCrop({ zoom: nextZoom, x: nextOffset.x, y: nextOffset.y })
  }

  async function handleConfirm() {
    if (!image) return
    setActionError(null)
    setExporting(true)
    try {
      const blob = await exportCrop(image, crop.x, crop.y, scale, viewport)
      await onConfirm(blob)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '사진을 저장하지 못했습니다.')
    } finally {
      setExporting(false)
    }
  }

  return createPortal(
    <div className="avatar-crop-root">
      <button
        type="button"
        className="avatar-crop-backdrop"
        aria-label="닫기"
        disabled={saving}
        onClick={onCancel}
      />
      <div
        className="avatar-crop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
      >
        <header className="avatar-crop-header">
          <h2 id="avatar-crop-title">사진 조정</h2>
          <button
            type="button"
            className="assets-composer-close"
            onClick={onCancel}
            disabled={saving}
            aria-label="닫기"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <p className="avatar-crop-copy">드래그해서 위치를 맞추고, 확대·축소할 수 있습니다.</p>

        {loadError ? (
          <p className="avatar-crop-error">{loadError}</p>
        ) : (
          <>
            <div
              ref={viewportRef}
              className="avatar-crop-viewport"
              style={{ width: viewport, height: viewport }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {image ? (
                <img
                  src={image.src}
                  alt=""
                  draggable={false}
                  className="avatar-crop-image"
                  style={{
                    width: image.naturalWidth * scale,
                    height: image.naturalHeight * scale,
                    transform: `translate(${crop.x}px, ${crop.y}px)`,
                  }}
                />
              ) : (
                <span className="avatar-crop-loading">불러오는 중…</span>
              )}
              <span className="avatar-crop-mask" aria-hidden="true" />
            </div>

            <label className="avatar-crop-zoom">
              <span>확대</span>
              <input
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={0.01}
                value={crop.zoom}
                disabled={!image || saving}
                onChange={(event) => handleZoomChange(Number(event.target.value))}
              />
            </label>
          </>
        )}

        {actionError ? <p className="avatar-crop-error">{actionError}</p> : null}

        <div className="avatar-crop-actions">
          <button type="button" className="btn btn-ghost" disabled={saving} onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !image || Boolean(loadError)}
            onClick={() => void handleConfirm()}
          >
            {busy || exporting ? '저장 중…' : '적용'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
