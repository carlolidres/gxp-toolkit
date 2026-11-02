import {
  LOGIN_FLASH_KEY,
  SESSION_USER_KEY,
} from '../config/sessionPolicy'

const OAUTH_STATUS_KEY = 'gxp-toolkit-oauth-status'
const SHARED_SESSION_KEY = 'gxp-toolkit-shared-session'

function publishSharedSession() {
  try {
    const entries: Record<string, string> = {}
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (!key || key === LOGIN_FLASH_KEY) continue
      const value = sessionStorage.getItem(key)
      if (value != null) entries[key] = value
    }
    if (!entries[SESSION_USER_KEY]) {
      localStorage.removeItem(SHARED_SESSION_KEY)
      return
    }
    localStorage.setItem(SHARED_SESSION_KEY, JSON.stringify(entries))
  } catch {
    // The current tab stays signed in when this browser cannot store the shared copy.
  }
}

function adoptSharedSession() {
  if (sessionStorage.getItem(SESSION_USER_KEY)) return
  const raw = localStorage.getItem(SHARED_SESSION_KEY)
  if (!raw) return
  try {
    const entries = JSON.parse(raw) as Record<string, string>
    if (typeof entries?.[SESSION_USER_KEY] !== 'string') return
    for (const [key, value] of Object.entries(entries)) {
      if (typeof value === 'string') sessionStorage.setItem(key, value)
    }
  } catch {
    localStorage.removeItem(SHARED_SESSION_KEY)
  }
}

export function readSessionUserJson(): string | null {
  adoptSharedSession()
  const value = sessionStorage.getItem(SESSION_USER_KEY)
  if (value) publishSharedSession()
  return value
}

export function writeSessionUserJson(json: string) {
  sessionStorage.setItem(SESSION_USER_KEY, json)
  publishSharedSession()
}

export function discardCachedUser() {
  sessionStorage.removeItem(SESSION_USER_KEY)
  localStorage.removeItem(SHARED_SESSION_KEY)
}

export function setLoginFlash(message: string) {
  sessionStorage.setItem(LOGIN_FLASH_KEY, message.trim())
}

export function consumeLoginFlash(): string | null {
  const message = sessionStorage.getItem(LOGIN_FLASH_KEY)
  if (message) sessionStorage.removeItem(LOGIN_FLASH_KEY)
  return message
}

function clearSupabaseAuthTokenKeys() {
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index)
    if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
      sessionStorage.removeItem(key)
    }
  }
}

/** Remove cached auth/session keys; does not touch unrelated app storage. */
export function clearAuthSessionStorage() {
  sessionStorage.removeItem(SESSION_USER_KEY)
  sessionStorage.removeItem(OAUTH_STATUS_KEY)
  clearSupabaseAuthTokenKeys()
  // ponytail: one-time cleanup for sessions persisted before sessionStorage migration
  localStorage.removeItem(SESSION_USER_KEY)
  localStorage.removeItem(SHARED_SESSION_KEY)
}
