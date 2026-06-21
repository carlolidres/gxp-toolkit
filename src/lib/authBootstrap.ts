import type { SupabaseClient } from '@supabase/supabase-js'

let sessionPromise: ReturnType<SupabaseClient['auth']['getSession']> | null = null

/** Deduplicate getSession during React StrictMode double-mount (PKCE code is one-time). */
export function getSessionOnce(client: SupabaseClient) {
  if (!sessionPromise) {
    sessionPromise = client.auth.getSession()
  }
  return sessionPromise
}

export function cleanOAuthParamsFromUrl(): void {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('code') && !url.searchParams.has('error')) return

  url.searchParams.delete('code')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}
