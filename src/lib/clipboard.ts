import { createId } from '../core/id'
import type { ClipboardImage, ClipboardRow } from './database'
import { t } from '../i18n'
import { isSupabaseConfigured, supabase } from './supabase'

export const CLIPBOARD_BUCKET = 'clipboard'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const SIGNED_URL_TTL_SEC = 60 * 60 * 24

export type ClipboardRecord = {
  body: string
  images: ClipboardImage[]
  updatedAt: string
}

export type ClipboardSummary = {
  body: string
  imageCount: number
}

const EMPTY_RECORD: ClipboardRecord = {
  body: '',
  images: [],
  updatedAt: '',
}

async function requireUserId(): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error(t('error.noSupabase'))
  }
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) {
    throw new Error(t('error.needLogin'))
  }
  return userId
}

export function parseClipboardImages(value: unknown): ClipboardImage[] {
  if (!Array.isArray(value)) return []
  const images: ClipboardImage[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    if (typeof rec.id !== 'string' || typeof rec.path !== 'string') continue
    images.push({
      id: rec.id,
      path: rec.path,
      mime: typeof rec.mime === 'string' ? rec.mime : 'image/png',
    })
  }
  return images
}

function rowToRecord(row: ClipboardRow): ClipboardRecord {
  return {
    body: row.body ?? '',
    images: parseClipboardImages(row.images),
    updatedAt: row.updated_at,
  }
}

export function assertClipboardImageFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error(t('clipboard.imageOnly'))
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(t('clipboard.imageTooLarge'))
  }
}

function extensionForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/heic') return 'heic'
  if (mime === 'image/heif') return 'heif'
  return 'png'
}

export async function getClipboard(): Promise<ClipboardRecord> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('life_clipboard')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? rowToRecord(data) : EMPTY_RECORD
}

export async function getClipboardSummary(): Promise<ClipboardSummary> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('life_clipboard')
    .select('body, images')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return { body: '', imageCount: 0 }
  return {
    body: data.body ?? '',
    imageCount: parseClipboardImages(data.images).length,
  }
}

export async function saveClipboard(input: {
  body: string
  images: ClipboardImage[]
}): Promise<ClipboardRecord> {
  const userId = await requireUserId()
  const updatedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('life_clipboard')
    .upsert(
      {
        user_id: userId,
        body: input.body,
        images: input.images,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return rowToRecord(data)
}

export async function signClipboardImages(
  images: ClipboardImage[],
): Promise<Record<string, string>> {
  if (images.length === 0) return {}
  const { data, error } = await supabase.storage
    .from(CLIPBOARD_BUCKET)
    .createSignedUrls(
      images.map((image) => image.path),
      SIGNED_URL_TTL_SEC,
    )
  if (error) throw error

  const urls: Record<string, string> = {}
  for (const image of images) {
    const signed = data?.find((item) => item.path === image.path)
    if (signed?.signedUrl) urls[image.id] = signed.signedUrl
  }
  return urls
}

export async function uploadClipboardImage(file: File): Promise<ClipboardImage> {
  assertClipboardImageFile(file)
  const userId = await requireUserId()
  const id = createId()
  const mime = file.type || 'image/png'
  const path = `${userId}/${id}.${extensionForMime(mime)}`

  const { error } = await supabase.storage.from(CLIPBOARD_BUCKET).upload(path, file, {
    upsert: false,
    contentType: mime,
    cacheControl: '3600',
  })
  if (error) throw new Error(error.message)

  return { id, path, mime }
}

export async function removeClipboardImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(CLIPBOARD_BUCKET).remove([path])
  if (error) throw new Error(error.message)
}

export async function downloadClipboardImage(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(CLIPBOARD_BUCKET).download(path)
  if (error || !data) {
    throw new Error(error?.message ?? t('clipboard.imageFetchFailed'))
  }
  return data
}

export function subscribeClipboard(
  userId: string,
  onChange: (record: ClipboardRecord) => void,
): () => void {
  const channel = supabase
    .channel(`life-clipboard-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'life_clipboard',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (!payload.new || typeof payload.new !== 'object') return
        onChange(rowToRecord(payload.new as ClipboardRow))
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export function imageFilesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return []
  const fromFiles = [...data.files].filter((file) => file.type.startsWith('image/'))
  if (fromFiles.length > 0) return fromFiles

  const fromItems: File[] = []
  for (const item of data.items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) fromItems.push(file)
  }
  return fromItems
}

async function blobToPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(t('clipboard.convertFailed'))
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (next) => {
        if (next) resolve(next)
        else reject(new Error(t('clipboard.convertFailed')))
      },
      'image/png',
    )
  })
}

export async function copyImageBlob(blob: Blob): Promise<void> {
  if (!navigator.clipboard?.write) {
    throw new Error(t('clipboard.copyUnsupported'))
  }
  const type = blob.type || 'image/png'
  try {
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })])
  } catch {
    const png = type === 'image/png' ? blob : await blobToPng(blob)
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
  }
}
