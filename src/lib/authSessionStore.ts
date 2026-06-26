import {
  LOGIN_FLASH_KEY,
  SESSION_USER_KEY,
} from '../config/sessionPolicy'

const OAUTH_STATUS_KEY = 'gxp-toolkit-oauth-status'

export function readSessionUserJson(): string | null {
  return sessionStorage.getItem(SESSION_USER_KEY)
}

export function writeSessionUserJson(json: string) {
  sessionStorage.setItem(SESSION_USER_KEY, json)
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
}
