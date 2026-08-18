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
    throw new Error('이미지 파일만 올릴 수 있습니다.')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('이미지는 10MB 이하만 올릴 수 있습니다.')
  }
}

async function requireUserId(): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
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
