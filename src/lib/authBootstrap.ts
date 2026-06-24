import type { SupabaseClient } from '@supabase/supabase-js'

let sessionPromise: ReturnType<SupabaseClient['auth']['getSession']> | null = null
let restoreSessionPromise: Promise<unknown> | null = null

const AUTH_RPC_TIMEOUT_MS = 15_000

/** Prevent hung Supabase auth calls from blocking the UI indefinitely. */
export function withAuthTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${AUTH_RPC_TIMEOUT_MS}ms`))
    }, AUTH_RPC_TIMEOUT_MS)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** Deduplicate getSession during React StrictMode double-mount (PKCE code is one-time). */
export function getSessionOnce(client: SupabaseClient) {
  if (!sessionPromise) {
    sessionPromise = withAuthTimeout(client.auth.getSession(), 'getSession')
  }
  return sessionPromise
}

export function resetGetSessionOnce() {
  sessionPromise = null
}

/** Deduplicate restoreSession so parallel StrictMode effects do not double signOut. */
export function runRestoreSessionOnce<T>(run: () => Promise<T>): Promise<T> {
  if (!restoreSessionPromise) {
    restoreSessionPromise = run().finally(() => {
      restoreSessionPromise = null
    })
  }
  return restoreSessionPromise as Promise<T>
}

export function resetRestoreSessionOnce() {
  restoreSessionPromise = null
}

export function cleanOAuthParamsFromUrl(): void {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('code') && !url.searchParams.has('error')) return

  url.searchParams.delete('code')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}
