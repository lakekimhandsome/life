import {
  defaultHubLayout,
  normalizeHubLayout,
  type HubLayout,
} from '../domain/hubLayout'
import { isSupabaseConfigured, supabase } from './supabase'

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

async function readCloudHubLayout(userId: string): Promise<HubLayout | null> {
  const { data, error } = await supabase
    .from('life_user_prefs')
    .select('prefs')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('life_user_prefs read failed', error.message)
    return null
  }
  if (!data?.prefs) return null

  const prefs = data.prefs as { hubLayout?: unknown }
  if (prefs.hubLayout == null) return null
  return normalizeHubLayout(prefs.hubLayout)
}

async function writeCloudHubLayout(
  userId: string,
  layout: HubLayout,
): Promise<void> {
  const { data: existing } = await supabase
    .from('life_user_prefs')
    .select('prefs')
    .eq('user_id', userId)
    .maybeSingle()

  const prev =
    existing?.prefs && typeof existing.prefs === 'object'
      ? (existing.prefs as Record<string, unknown>)
      : {}

  const { error } = await supabase.from('life_user_prefs').upsert(
    {
      user_id: userId,
      prefs: { ...prev, hubLayout: layout },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    console.warn('life_user_prefs write failed', error.message)
  }
}

export async function getHubLayout(): Promise<HubLayout> {
  const userId = await requireUserId()
  const cloud = await readCloudHubLayout(userId)
  return cloud ?? defaultHubLayout()
}

export async function saveHubLayout(layout: HubLayout): Promise<HubLayout> {
  const next = normalizeHubLayout(layout)
  const userId = await requireUserId()
  await writeCloudHubLayout(userId, next)
  return next
}
