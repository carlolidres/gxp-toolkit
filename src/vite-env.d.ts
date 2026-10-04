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
  /** eDoc Paddle billing — default false; never put API keys here */
  readonly VITE_BILLING_ENABLED?: string
  readonly VITE_PADDLE_CHECKOUT_ENABLED?: string
  readonly VITE_ANNUAL_BILLING_ENABLED?: string
  readonly VITE_BUSINESS_PLAN_ENABLED?: string
  readonly VITE_FREE_PLAN_LIMITS_ENABLED?: string
  readonly VITE_BILLING_PORTAL_ENABLED?: string
  readonly VITE_PADDLE_ENV?: string
  readonly VITE_PADDLE_CLIENT_TOKEN?: string
  /** PayMongo display/checkout flags — default false. Never put PayMongo secret keys here. */
  readonly VITE_ENABLE_PAYMONGO?: string
  readonly VITE_PAYMONGO_CHECKOUT_ENABLED?: string
  /** CPV module — production default false. Local dev shows CPV unless set false. */
  readonly VITE_ENABLE_CPV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
