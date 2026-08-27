import {
  defaultHubLayout,
  normalizeHubLayout,
  type HubLayout,
} from '../domain/hubLayout'
import { isLocalePreference, t, type LocalePreference } from '../i18n'
import { isSupabaseConfigured, supabase } from './supabase'

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

async function readCloudPrefs(userId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('life_user_prefs')
    .select('prefs')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('life_user_prefs read failed', error.message)
    return {}
  }
  if (!data?.prefs || typeof data.prefs !== 'object') return {}
  return data.prefs as Record<string, unknown>
}

let writeChain = Promise.resolve()

async function patchCloudPrefs(patch: Record<string, unknown>): Promise<void> {
  const run = writeChain.then(async () => {
    const userId = await requireUserId()
    const prev = await readCloudPrefs(userId)
    const { error } = await supabase.from('life_user_prefs').upsert(
      {
        user_id: userId,
        prefs: { ...prev, ...patch },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (error) {
      console.warn('life_user_prefs write failed', error.message)
      throw error
    }
  })
  writeChain = run.then(
    () => undefined,
    () => undefined,
  )
  await run
}

export async function getHubLayout(): Promise<HubLayout> {
  const userId = await requireUserId()
  const prefs = await readCloudPrefs(userId)
  if (prefs.hubLayout == null) return defaultHubLayout()
  return normalizeHubLayout(prefs.hubLayout)
}

export async function saveHubLayout(layout: HubLayout): Promise<HubLayout> {
  const next = normalizeHubLayout(layout)
  await patchCloudPrefs({ hubLayout: next })
  return next
}

export async function getLocalePreference(): Promise<LocalePreference | null> {
  const userId = await requireUserId()
  const prefs = await readCloudPrefs(userId)
  return isLocalePreference(prefs.locale) ? prefs.locale : null
}

export async function saveLocalePreference(
  preference: LocalePreference,
): Promise<LocalePreference> {
  await patchCloudPrefs({ locale: preference })
  return preference
}
