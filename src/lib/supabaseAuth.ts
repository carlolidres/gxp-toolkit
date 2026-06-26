import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseClient } from './supabase'

export function isSupabaseTableAuthError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('permission denied for table') ||
    normalized.includes('jwt') ||
    normalized.includes('not authenticated') ||
    normalized.includes('invalid claim') ||
    normalized.includes('session') && normalized.includes('expired')
  )
}

/** Fresh session read — do not use getSessionOnce (can cache a pre-login null). */
export async function requireSupabaseSession(
  client: SupabaseClient = getSupabaseClient()!,
): Promise<NonNullable<ReturnType<typeof getSupabaseClient>>> {
  if (!client) {
    throw new Error('Supabase client is not available.')
  }

  const { data, error } = await client.auth.getSession()
  const hasSession = Boolean(data.session?.access_token)

  // #region agent log
  fetch('http://127.0.0.1:7279/ingest/1e249d7b-87da-4823-ad3b-2539191e7dd7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '893cbc' },
    body: JSON.stringify({
      sessionId: '893cbc',
      hypothesisId: 'H1',
      location: 'supabaseAuth.ts:requireSupabaseSession',
      message: 'session gate',
      data: { hasSession, error: error?.message ?? null },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  if (error || !hasSession) {
    throw new Error('Authentication session expired. Please sign in again.')
  }

  return client
}
