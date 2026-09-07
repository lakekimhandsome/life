/// <reference types="vite/client" />

declare const __COMMIT_HASH__: string

interface ImportMetaEnv {
  readonly VITE_ALPHA_VANTAGE_API_KEY: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
