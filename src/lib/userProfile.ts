import type { User } from '@supabase/supabase-js'

export const LIFE_AVATAR_META_KEY = 'life_avatar'
export const AVATAR_BUCKET = 'avatars'
export const AVATAR_OBJECT_NAME = 'avatar.jpg'

type UserLike = {
  email?: string | null
  user_metadata?: Record<string, unknown>
}

function metaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function displayName(user: UserLike | null | undefined): string {
  if (!user) return '나'
  const meta = user.user_metadata ?? {}
  return (
    metaString(meta, 'full_name') ||
    metaString(meta, 'name') ||
    metaString(meta, 'nickname') ||
    metaString(meta, 'preferred_username') ||
    (user.email ? user.email.split('@')[0] : null) ||
    '나'
  )
}

export function displayEmail(user: UserLike | null | undefined): string | null {
  if (!user) return null
  if (user.email) return user.email
  return metaString(user.user_metadata ?? {}, 'email')
}

export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '나'
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 1).join('')
  return `${Array.from(parts[0])[0] ?? ''}${Array.from(parts[parts.length - 1])[0] ?? ''}`
}

export function customAvatarUrl(user: UserLike | null | undefined): string | null {
  if (!user) return null
  return metaString(user.user_metadata ?? {}, LIFE_AVATAR_META_KEY)
}

export function providerAvatarUrl(user: UserLike | null | undefined): string | null {
  if (!user) return null
  const meta = user.user_metadata ?? {}
  return (
    metaString(meta, 'avatar_url') ||
    metaString(meta, 'picture') ||
    metaString(meta, 'thumbnail_image') ||
    metaString(meta, 'profile_image')
  )
}

export function resolveAvatarUrl(user: UserLike | null | undefined): string | null {
  return customAvatarUrl(user) ?? providerAvatarUrl(user)
}

export function avatarObjectPath(userId: string): string {
  return `${userId}/${AVATAR_OBJECT_NAME}`
}

export function hasCustomAvatar(user: User | UserLike | null | undefined): boolean {
  return Boolean(customAvatarUrl(user))
}
