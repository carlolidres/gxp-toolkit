import { afterEach, describe, expect, it } from 'vitest'

import { SESSION_ACTIVITY_KEY, SESSION_INACTIVITY_MS, SESSION_USER_KEY } from '../config/sessionPolicy'
import {
  clearAuthSessionStorage,
  consumeLoginFlash,
  isInactiveBeyond,
  setLoginFlash,
  touchSessionActivity,
  writeSessionUserJson,
} from './authSessionStore'

afterEach(() => {
  clearAuthSessionStorage()
  sessionStorage.clear()
  localStorage.clear()
})

describe('authSessionStore', () => {
  it('treats missing activity as not expired', () => {
    expect(isInactiveBeyond()).toBe(false)
  })

  it('expires after the inactivity window', () => {
    const now = 1_700_000_000_000
    touchSessionActivity(now - SESSION_INACTIVITY_MS)
    expect(isInactiveBeyond(SESSION_INACTIVITY_MS, now)).toBe(true)
  })

  it('clears cached session keys on logout cleanup', () => {
    writeSessionUserJson('{"id":"u1"}')
    touchSessionActivity()
    localStorage.setItem(SESSION_USER_KEY, '{"legacy":true}')
    sessionStorage.setItem(SESSION_ACTIVITY_KEY, '1')
    sessionStorage.setItem('sb-test-auth-token', '{"access_token":"x"}')

    clearAuthSessionStorage()

    expect(sessionStorage.getItem(SESSION_USER_KEY)).toBeNull()
    expect(sessionStorage.getItem(SESSION_ACTIVITY_KEY)).toBeNull()
    expect(sessionStorage.getItem('sb-test-auth-token')).toBeNull()
    expect(localStorage.getItem(SESSION_USER_KEY)).toBeNull()
  })

  it('consumes login flash once', () => {
    setLoginFlash('Session expired.')
    expect(consumeLoginFlash()).toBe('Session expired.')
    expect(consumeLoginFlash()).toBeNull()
  })
})
