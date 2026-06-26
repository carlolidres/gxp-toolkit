import { afterEach, describe, expect, it } from 'vitest'

import { SESSION_USER_KEY } from '../config/sessionPolicy'
import {
  clearAuthSessionStorage,
  consumeLoginFlash,
  setLoginFlash,
  writeSessionUserJson,
} from './authSessionStore'

afterEach(() => {
  clearAuthSessionStorage()
  sessionStorage.clear()
  localStorage.clear()
})

describe('authSessionStore', () => {
  it('clears cached session keys on logout cleanup', () => {
    writeSessionUserJson('{"id":"u1"}')
    localStorage.setItem(SESSION_USER_KEY, '{"legacy":true}')
    sessionStorage.setItem('sb-test-auth-token', '{"access_token":"x"}')

    clearAuthSessionStorage()

    expect(sessionStorage.getItem(SESSION_USER_KEY)).toBeNull()
    expect(sessionStorage.getItem('sb-test-auth-token')).toBeNull()
    expect(localStorage.getItem(SESSION_USER_KEY)).toBeNull()
  })

  it('consumes login flash once', () => {
    setLoginFlash('Session expired.')
    expect(consumeLoginFlash()).toBe('Session expired.')
    expect(consumeLoginFlash()).toBeNull()
  })
})
