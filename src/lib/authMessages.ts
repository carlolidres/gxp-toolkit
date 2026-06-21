const OAUTH_STATUS_KEY = 'gxp-toolkit-oauth-status'

export type OAuthUiState = 'idle' | 'loading' | 'success' | 'cancelled' | 'failure'

export interface OAuthStatus {
  state: OAuthUiState
  message: string
}

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return normalizeAuthMessage(error.message)
  if (typeof error === 'string' && error.trim()) return normalizeAuthMessage(error)
  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error ? String((error as { message?: unknown }).message ?? '') : ''
    if (maybeMessage.trim()) return normalizeAuthMessage(maybeMessage)
    const maybeDescription = 'error_description' in error
      ? String((error as { error_description?: unknown }).error_description ?? '')
      : ''
    if (maybeDescription.trim()) return normalizeAuthMessage(maybeDescription)
  }
  return fallback
}

export function normalizeAuthMessage(message: string): string {
  const text = message.trim()
  const lower = text.toLowerCase()
  if (lower.includes('already registered') || lower.includes('already exists')) {
    return 'An account already exists for this email. Sign in with the same method you used before, or use Google/Microsoft if that is how you registered.'
  }
  if (lower.includes('provider is not enabled') || lower.includes('provider not enabled')) {
    return 'This provider is not enabled in Supabase yet. Enable it in the Supabase authentication provider settings and confirm the redirect URL allow-list.'
  }
  if (lower.includes('cancel')) return 'Authentication was cancelled. You can try again when ready.'
  return text
}

export function rememberOAuthStart(providerLabel: string) {
  sessionStorage.setItem(
    OAUTH_STATUS_KEY,
    JSON.stringify({
      state: 'loading',
      message: `Redirecting to ${providerLabel}…`,
    } satisfies OAuthStatus),
  )
}

export function rememberOAuthFailure(message: string) {
  sessionStorage.setItem(
    OAUTH_STATUS_KEY,
    JSON.stringify({
      state: 'failure',
      message: normalizeAuthMessage(message),
    } satisfies OAuthStatus),
  )
}

export function rememberOAuthSuccess(message = 'Authentication succeeded. Finishing sign-in…') {
  sessionStorage.setItem(
    OAUTH_STATUS_KEY,
    JSON.stringify({
      state: 'success',
      message,
    } satisfies OAuthStatus),
  )
}

export function consumeOAuthStatus(): OAuthStatus | null {
  const raw = sessionStorage.getItem(OAUTH_STATUS_KEY)
  if (!raw) return null
  sessionStorage.removeItem(OAUTH_STATUS_KEY)
  try {
    const parsed = JSON.parse(raw) as OAuthStatus
    return parsed.state && parsed.message ? parsed : null
  } catch {
    return null
  }
}

