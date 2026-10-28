import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Copy, Download, Ellipsis, Trash2, X } from 'lucide-react'
import { copyImageBlob } from '../../lib/clipboard'
import { useT } from '../../state/LocaleContext'
import { ImageRemovalContext } from './imageRemovalContext'
import { ZoomableImage } from './ZoomableImage'

type GalleryImage = { src: string; alt: string; remove?: () => void }

export function ImageGallery({ children }: { children: ReactNode }) {
  const t = useT()
  const root = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const menuId = useId()
  const menuToggle = useRef<HTMLButtonElement>(null)
  const [removals] = useState(() => new WeakMap<HTMLImageElement, () => void>())
  const [gallery, setGallery] = useState<{ images: GalleryImage[]; index: number } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  function move(delta: number) {
    setMenuOpen(false)
    setMessage('')
    setGallery((current) => current && ({ ...current, index: Math.max(0, Math.min(current.images.length - 1, current.index + delta)) }))
  }
  function open(image: HTMLImageElement) {
    const images = [...root.current!.querySelectorAll<HTMLImageElement>('img[src]')]
    setMenuOpen(false)
    setMessage('')
    setGallery({ images: images.map((item) => ({ src: item.currentSrc || item.src, alt: item.alt, remove: removals.get(item) })), index: images.indexOf(image) })
  }

  async function imageBlob(src: string) {
    const response = await fetch(src)
    if (!response.ok) throw new Error(t('clipboard.imageFetchFailed'))
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) throw new Error(t('clipboard.imageFetchFailed'))
    return blob
  }

  async function imageAction(action: 'save' | 'copy') {
    if (!gallery || busy) return
    const image = gallery.images[gallery.index]
    setMenuOpen(false)
    setMessage('')
    setBusy(true)
    try {
      if (action === 'copy') {
        if (!navigator.clipboard?.write) throw new Error(t('clipboard.copyUnsupported'))
        await copyImageBlob(imageBlob(image.src))
        setMessage(t('clipboard.copied'))
      } else {
        const blob = await imageBlob(image.src)
        const extension = blob.type.split('/')[1].split('+')[0].replace('jpeg', 'jpg')
        const file = new File([blob], `LIFE-image.${extension}`, { type: blob.type })
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file] })
            return
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return
            // Keep downloading available when native file sharing is refused.
          }
        }
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        link.hidden = true
        ;(dialog.current ?? document.body).append(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setMessage(error instanceof Error ? error.message : t('bodyImage.actionFailed'))
      }
    } finally {
      setBusy(false)
    }
  }

  function removeImage() {
    if (!gallery) return
    const image = gallery.images[gallery.index]
    if (!image.remove || !window.confirm(t('bodyImage.deleteConfirm'))) return
    image.remove()
    setMenuOpen(false)
    setMessage('')
    const images = gallery.images.filter((_, index) => index !== gallery.index)
    setGallery(images.length ? { images, index: Math.min(gallery.index, images.length - 1) } : null)
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

  return <ImageRemovalContext.Provider value={removals}>
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
      onCancel={(event) => {
        if (menuOpen) { event.preventDefault(); setMenuOpen(false); menuToggle.current?.focus() }
        else setGallery(null)
      }} onClose={() => setGallery(null)}
      onClick={(event) => {
        const target = event.target
        if (menuOpen && target instanceof Element && !target.closest('.gallery-menu, .gallery-menu-toggle')) setMenuOpen(false)
        if (!menuOpen && (target === event.currentTarget || (target instanceof Element && target.classList.contains('gallery-image-stage')))) setGallery(null)
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          move(event.key === 'ArrowLeft' ? -1 : 1)
        }
      }}
      >
      <button type="button" className="gallery-close" aria-label={t('common.close')} onClick={() => setGallery(null)}><X /></button>
      <button type="button" className="gallery-menu-toggle" ref={menuToggle} aria-label={t('bodyImage.menu')} aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined} onClick={() => setMenuOpen(!menuOpen)}><Ellipsis /></button>
      {menuOpen && <div id={menuId} className="gallery-menu" role="group" aria-label={t('bodyImage.menu')}>
        <button type="button" disabled={busy} onClick={() => void imageAction('save')}><Download size={18} aria-hidden="true" />{t('bodyImage.save')}</button>
        <button type="button" disabled={busy} onClick={() => void imageAction('copy')}><Copy size={18} aria-hidden="true" />{t('clipboard.copyImage')}</button>
        {gallery.images[gallery.index].remove && <button type="button" className="gallery-menu-delete" disabled={busy} onClick={removeImage}><Trash2 size={18} aria-hidden="true" />{t('clipboard.deleteImage')}</button>}
      </div>}
      <button type="button" className="gallery-previous" disabled={gallery.index === 0} aria-label={t('bodyImage.previous')} onClick={() => move(-1)}><ChevronLeft /></button>
      <ZoomableImage key={`${gallery.index}:${gallery.images[gallery.index].src}`} src={gallery.images[gallery.index].src} alt={gallery.images[gallery.index].alt} onSwipe={move} />
      <button type="button" className="gallery-next" disabled={gallery.index === gallery.images.length - 1} aria-label={t('bodyImage.next')} onClick={() => move(1)}><ChevronRight /></button>
      <span className="gallery-message" role="status">{busy ? t('common.loading') : message}</span>
      <span className="gallery-count" aria-live="polite">{gallery.index + 1} / {gallery.images.length}</span>
    </dialog>, document.body)}
  </ImageRemovalContext.Provider>
}
