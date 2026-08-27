import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from 'react'
import { X } from 'lucide-react'
import { BackLink } from '../components/ui/BackLink'
import { createId } from '../core/id'
import type { ClipboardImage } from '../lib/database'
import {
  assertClipboardImageFile,
  copyImageBlob,
  downloadClipboardImage,
  getClipboard,
  imageFilesFromDataTransfer,
  removeClipboardImage,
  saveClipboard,
  signClipboardImages,
  subscribeClipboard,
  uploadClipboardImage,
} from '../lib/clipboard'
import { t as translate } from '../i18n'
import { useAuth } from '../state/AuthContext'
import { useT } from '../state/LocaleContext'

const SAVE_DEBOUNCE_MS = 500

type DisplayImage = ClipboardImage & {
  url: string
  uploading?: boolean
}

type SaveState = 'saved' | 'saving' | 'error'

function persistedImages(images: DisplayImage[]): ClipboardImage[] {
  return images
    .filter((image) => !image.uploading && image.path)
    .map(({ id, path, mime }) => ({ id, path, mime }))
}

export function ClipboardPage() {
  const t = useT()
  const { user } = useAuth()
  const bodyRef = useRef('')
  const imagesRef = useRef<DisplayImage[]>([])
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const updatedAtRef = useRef('')
  const saveTimerRef = useRef<number | null>(null)
  const loadedRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [body, setBody] = useState('')
  const [images, setImages] = useState<DisplayImage[]>([])
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const setImageList = useCallback((next: DisplayImage[]) => {
    imagesRef.current = next
    setImages(next)
  }, [])

  const persistNow = useCallback(async () => {
    if (!loadedRef.current) return
    if (savingRef.current) {
      pendingSaveRef.current = true
      return
    }

    savingRef.current = true
    pendingSaveRef.current = false
    const bodyToSave = bodyRef.current
    const imagesToSave = persistedImages(imagesRef.current)
    dirtyRef.current = false
    setSaveState('saving')

    let failed = false
    try {
      const saved = await saveClipboard({
        body: bodyToSave,
        images: imagesToSave,
      })
      updatedAtRef.current = saved.updatedAt
      setSaveState('saved')
      setError(null)
    } catch (nextError) {
      failed = true
      dirtyRef.current = true
      setSaveState('error')
      setError(nextError instanceof Error ? nextError.message : translate('clipboard.saveFailed'))
    } finally {
      savingRef.current = false
      if (!failed && (pendingSaveRef.current || dirtyRef.current)) {
        pendingSaveRef.current = false
        void persistNow()
      }
    }
  }, [])

  const queueTextSave = useCallback(() => {
    dirtyRef.current = true
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void persistNow()
    }, SAVE_DEBOUNCE_MS)
  }, [persistNow])

  const flushSave = useCallback(() => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (dirtyRef.current || pendingSaveRef.current) void persistNow()
  }, [persistNow])

  useEffect(() => {
    bodyRef.current = body
  }, [body])

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const record = await getClipboard()
        if (!active || dirtyRef.current) return
        bodyRef.current = record.body
        updatedAtRef.current = record.updatedAt
        setBody(record.body)
        const urls = await signClipboardImages(record.images)
        if (!active || dirtyRef.current) return
        setImageList(
          record.images.map((image) => ({
            ...image,
            url: urls[image.id] ?? '',
          })),
        )
        loadedRef.current = true
        setSaveState('saved')
      } catch (nextError) {
        if (!active) return
        setError(nextError instanceof Error ? nextError.message : translate('clipboard.loadFailed'))
      } finally {
        if (active) setReady(true)
      }
    })()

    return () => {
      active = false
    }
  }, [setImageList])

  useEffect(() => {
    if (!user?.id) return
    return subscribeClipboard(user.id, (record) => {
      if (dirtyRef.current || savingRef.current) return
      if (record.updatedAt === updatedAtRef.current) return
      updatedAtRef.current = record.updatedAt
      bodyRef.current = record.body
      setBody(record.body)
      void signClipboardImages(record.images).then((urls) => {
        if (dirtyRef.current || savingRef.current) return
        const uploading = imagesRef.current.filter((image) => image.uploading)
        setImageList([
          ...record.images.map((image) => ({
            ...image,
            url: urls[image.id] ?? '',
          })),
          ...uploading,
        ])
      })
    })
  }, [setImageList, user?.id])

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === 'hidden') flushSave()
    }
    window.addEventListener('pagehide', flushSave)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flushSave)
      document.removeEventListener('visibilitychange', onHide)
      flushSave()
    }
  }, [flushSave])

  const addImages = useCallback(
    async (files: File[]) => {
      if (!loadedRef.current || files.length === 0) return
      setError(null)

      const jobs: { file: File; temp: DisplayImage }[] = []
      for (const file of files) {
        try {
          assertClipboardImageFile(file)
        } catch (nextError) {
          setError(
            nextError instanceof Error ? nextError.message : translate('clipboard.inspectFailed'),
          )
          continue
        }
        jobs.push({
          file,
          temp: {
            id: createId(),
            path: '',
            mime: file.type || 'image/png',
            url: URL.createObjectURL(file),
            uploading: true,
          },
        })
      }
      if (jobs.length === 0) return

      setImageList([...imagesRef.current, ...jobs.map((job) => job.temp)])

      for (const { file, temp } of jobs) {
        try {
          const uploaded = await uploadClipboardImage(file)
          const urls = await signClipboardImages([uploaded])
          URL.revokeObjectURL(temp.url)
          const next = imagesRef.current.map((image) =>
            image.id === temp.id
              ? { ...uploaded, url: urls[uploaded.id] ?? temp.url }
              : image,
          )
          setImageList(next)
          dirtyRef.current = true
          void persistNow()
        } catch (nextError) {
          URL.revokeObjectURL(temp.url)
          setImageList(imagesRef.current.filter((image) => image.id !== temp.id))
          setError(
            nextError instanceof Error ? nextError.message : translate('clipboard.uploadFailed'),
          )
        }
      }
    },
    [persistNow, setImageList],
  )

  useEffect(() => {
    if (!ready) return
    function onPaste(event: ClipboardEvent) {
      const files = imageFilesFromDataTransfer(event.clipboardData)
      if (files.length === 0) return
      event.preventDefault()
      void addImages(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addImages, ready])

  function onBodyChange(value: string) {
    bodyRef.current = value
    setBody(value)
    queueTextSave()
  }

  async function handleRemoveImage(id: string) {
    const current = imagesRef.current.find((image) => image.id === id)
    if (!current) return
    if (current.url.startsWith('blob:')) URL.revokeObjectURL(current.url)
    const next = imagesRef.current.filter((image) => image.id !== id)
    setImageList(next)
    dirtyRef.current = true
    await persistNow()
    if (current.path) {
      try {
        await removeClipboardImage(current.path)
      } catch {
        // Storage cleanup is best-effort after the row is saved.
      }
    }
  }

  async function handleCopyImage(image: DisplayImage) {
    if (image.uploading) return
    try {
      const blob = image.path
        ? await downloadClipboardImage(image.path)
        : await fetch(image.url).then((response) => response.blob())
      await copyImageBlob(blob)
      setCopiedId(image.id)
      window.setTimeout(() => {
        setCopiedId((current) => (current === image.id ? null : current))
      }, 1400)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('clipboard.copyFailed'))
    }
  }

  function onDragOver(event: ReactDragEvent<HTMLDivElement>) {
    if (![...event.dataTransfer.types].includes('Files')) return
    event.preventDefault()
    setDragging(true)
  }

  function onDragLeave(event: ReactDragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return
    setDragging(false)
  }

  function onDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    void addImages(imageFilesFromDataTransfer(event.dataTransfer))
  }

  const saveLabel =
    saveState === 'saving'
      ? t('clipboard.saving')
      : saveState === 'error'
        ? t('clipboard.saveError')
        : t('clipboard.saved')

  return (
    <div
      className={`module-page clipboard-page module-heading--clipboard${dragging ? ' is-dragging' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="module-header module-heading--clipboard">
        <BackLink to="/" />
        <div className="module-heading module-heading--clipboard">
          <h1>{t('modules.clipboard')}</h1>
        </div>
        <div className="module-header-actions">
          <span
            className={`clipboard-save${saveState === 'error' ? ' is-error' : ''}`}
            aria-live="polite"
          >
            {ready ? saveLabel : t('clipboard.loading')}
          </span>
        </div>
      </div>

      {error ? <p className="clipboard-error">{error}</p> : null}

      {images.length > 0 ? (
        <ul className="clipboard-images">
          {images.map((image) => (
            <li
              key={image.id}
              className={`clipboard-image${image.uploading ? ' is-uploading' : ''}`}
            >
              <button
                type="button"
                className="clipboard-image-copy"
                onClick={() => void handleCopyImage(image)}
                disabled={image.uploading || !image.url}
                aria-label={t('clipboard.copyImage')}
              >
                {image.url ? (
                  <img src={image.url} alt="" />
                ) : (
                  <span className="clipboard-image-missing">{t('clipboard.image')}</span>
                )}
                {copiedId === image.id ? (
                  <span className="clipboard-image-copied">{t('clipboard.copied')}</span>
                ) : null}
              </button>
              <button
                type="button"
                className="clipboard-image-remove"
                aria-label={t('clipboard.deleteImage')}
                onClick={() => void handleRemoveImage(image.id)}
              >
                <X size={15} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <textarea
        className="clipboard-input"
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        onBlur={flushSave}
        placeholder={t('clipboard.placeholder')}
        spellCheck={false}
        disabled={!ready}
        aria-label={t('clipboard.textAria')}
      />
    </div>
  )
}
