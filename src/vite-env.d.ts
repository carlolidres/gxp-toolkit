/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL (public; safe for client bundle when using anon key + RLS) */
  readonly VITE_SUPABASE_URL: string
  /** Supabase anon (public) key — never use the service role key here */
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Application environment label, e.g. development | staging | production */
  readonly VITE_APP_ENV: string
  /** GitHub Pages subpath base, e.g. /gxp-toolkit/ — drives vite.config.ts base */
  readonly VITE_BASE_PATH?: string
  /** Set when building or previewing for GitHub Pages static deploy */
  readonly VITE_GITHUB_PAGES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
