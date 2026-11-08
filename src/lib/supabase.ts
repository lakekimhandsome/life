import { createClient } from '@supabase/supabase-js'
import type { Database } from './database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase env missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY',
  )
}

export const supabase = createClient<Database>(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
  {
    auth: {
      flowType: 'pkce',
      // Callback page calls exchangeCodeForSession explicitly.
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey)
}
