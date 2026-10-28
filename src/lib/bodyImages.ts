import { createClient } from '@supabase/supabase-js'
import { t } from '../i18n'
import { supabase } from './supabase'

export const BODY_IMAGE_BUCKET = 'body-images'
const imageBase = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/authenticated/${BODY_IMAGE_BUCKET}/`
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
}

export async function uploadBodyImage(file: File): Promise<string> {
  if (!extensions[file.type]) throw new Error(t('bodyImage.format'))
  if (file.size > 10 * 1024 * 1024) throw new Error(t('clipboard.imageTooLarge'))
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error(t('error.needLogin'))
  const path = `${data.session.user.id}/${crypto.randomUUID()}.${extensions[file.type]}`
  const { error } = await supabase.storage.from(BODY_IMAGE_BUCKET).upload(path, file, {
    contentType: file.type, upsert: false,
  })
  if (error) throw error
  return imageBase + path
}

export function bodyImageResolver(shareToken?: string) {
  const client = shareToken ? createClient(
    import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { 'x-life-share-token': shareToken } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  ) : supabase
  return async (source: string): Promise<string> => {
    if (!source.startsWith(imageBase)) return source
    const path = source.slice(imageBase.length)
    const { data, error } = await client.storage.from(BODY_IMAGE_BUCKET).createSignedUrl(path, 3600)
    if (error) throw error
    return data.signedUrl
  }
}

export const resolveBodyImage = bodyImageResolver()
