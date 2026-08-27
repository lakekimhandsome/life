import { t } from '../i18n'
import { isSupabaseConfigured, supabase } from './supabase'
import {
  AVATAR_BUCKET,
  LIFE_AVATAR_META_KEY,
  avatarObjectPath,
} from './userProfile'

const MAX_SOURCE_BYTES = 10 * 1024 * 1024
const OUTPUT_TYPE = 'image/jpeg'

export function assertAvatarFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error(t('clipboard.imageOnly'))
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(t('clipboard.imageTooLarge'))
  }
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

export async function uploadAvatar(blob: Blob): Promise<string> {
  const userId = await requireUserId()
  const path = avatarObjectPath(userId)

  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: OUTPUT_TYPE,
    cacheControl: '3600',
  })
  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`

  const { error: updateError } = await supabase.auth.updateUser({
    data: { [LIFE_AVATAR_META_KEY]: url },
  })
  if (updateError) {
    throw new Error(updateError.message)
  }

  return url
}

export async function removeAvatar(): Promise<void> {
  const userId = await requireUserId()
  const path = avatarObjectPath(userId)

  const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([path])
  if (removeError) {
    throw new Error(removeError.message)
  }

  const { error: updateError } = await supabase.auth.updateUser({
    data: { [LIFE_AVATAR_META_KEY]: '' },
  })
  if (updateError) {
    throw new Error(updateError.message)
  }
}
