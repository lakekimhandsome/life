import { db } from '../core/db'
import {
  defaultHubLayout,
  normalizeHubLayout,
  type HubLayout,
} from '../domain/hubLayout'
import { isSupabaseConfigured, supabase } from './supabase'

const PREFS_KEY = 'hubLayout'

async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

async function readLocalHubLayout(): Promise<HubLayout | null> {
  const row = await db.prefs.get(PREFS_KEY)
  if (!row) return null
  return normalizeHubLayout(row.value)
}

async function writeLocalHubLayout(layout: HubLayout): Promise<void> {
  await db.prefs.put({
    key: PREFS_KEY,
    value: layout,
    updatedAt: new Date().toISOString(),
  })
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
  const userId = await currentUserId()
  if (userId) {
    const cloud = await readCloudHubLayout(userId)
    if (cloud) return cloud
  }

  const local = await readLocalHubLayout()
  return local ?? defaultHubLayout()
}

export async function saveHubLayout(layout: HubLayout): Promise<HubLayout> {
  const next = normalizeHubLayout(layout)
  await writeLocalHubLayout(next)

  const userId = await currentUserId()
  if (userId) {
    await writeCloudHubLayout(userId, next)
  }

  return next
}

/** 로그인 후 클라우드 prefs가 비어 있으면 로컬 hubLayout을 올린다. */
export async function migrateHubLayoutToCloudIfNeeded(): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return

  const cloud = await readCloudHubLayout(userId)
  if (cloud) return

  const local = await readLocalHubLayout()
  if (!local) return

  await writeCloudHubLayout(userId, local)
}
