import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useT } from '../../state/LocaleContext'

export function ImageGallery({ children }: { children: ReactNode }) {
  const t = useT()
  const root = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [gallery, setGallery] = useState<{ images: { src: string; alt: string }[]; index: number } | null>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  function move(delta: number) {
    setGallery((current) => current && ({ ...current, index: Math.max(0, Math.min(current.images.length - 1, current.index + delta)) }))
  }
  function open(image: HTMLImageElement) {
    const images = [...root.current!.querySelectorAll<HTMLImageElement>('img[src]')]
    setGallery({ images: images.map((item) => ({ src: item.currentSrc || item.src, alt: item.alt })), index: images.indexOf(image) })
  }
  useEffect(() => {
    const element = root.current!
    function accessibleImages() {
      element.querySelectorAll<HTMLImageElement>('img[src]').forEach((image) => {
        image.tabIndex = 0
        image.setAttribute('role', 'button')
        image.setAttribute('aria-label', t('bodyImage.enlarge'))
      })
    }
    accessibleImages()
    const observer = new MutationObserver(accessibleImages)
    observer.observe(element, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [t])
  const isOpen = gallery !== null
  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    dialog.current?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [isOpen])

  return <>
    <div ref={root} onClickCapture={(event) => {
      const target = event.target
      if (!(target instanceof Element) || target.closest('button')) return
      const image = target instanceof HTMLImageElement ? target : target.closest('[data-lexical-decorator]')?.querySelector('img')
      if (!image?.getAttribute('src')) return
      event.preventDefault()
      event.stopPropagation()
      open(image)
    }} onKeyDownCapture={(event) => {
      if (!(event.target instanceof HTMLImageElement) || !event.target.getAttribute('src') || !['Enter', ' '].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      open(event.target)
    }}>{children}</div>
    {gallery && createPortal(<dialog ref={dialog} className="image-gallery" aria-label={t('bodyImage.enlarge')}
      onCancel={() => setGallery(null)} onClose={() => setGallery(null)}
      onClick={(event) => { if (event.target === event.currentTarget) setGallery(null) }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          move(event.key === 'ArrowLeft' ? -1 : 1)
        }
      }}
      onTouchStart={(event) => { const point = event.touches[0]; touch.current = { x: point.clientX, y: point.clientY } }}
      onTouchEnd={(event) => {
        const start = touch.current
        touch.current = null
        if (!start) return
        const point = event.changedTouches[0]
        const dx = point.clientX - start.x
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(point.clientY - start.y) * 1.25) move(dx < 0 ? 1 : -1)
      }}>
      <button type="button" className="gallery-close" aria-label={t('common.close')} onClick={() => setGallery(null)}><X /></button>
      <button type="button" className="gallery-previous" disabled={gallery.index === 0} aria-label={t('bodyImage.previous')} onClick={() => move(-1)}><ChevronLeft /></button>
      <img src={gallery.images[gallery.index].src} alt={gallery.images[gallery.index].alt} />
      <button type="button" className="gallery-next" disabled={gallery.index === gallery.images.length - 1} aria-label={t('bodyImage.next')} onClick={() => move(1)}><ChevronRight /></button>
      <span className="gallery-count" aria-live="polite">{gallery.index + 1} / {gallery.images.length}</span>
    </dialog>, document.body)}
  </>
}
