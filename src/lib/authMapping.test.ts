import { describe, expect, it } from 'vitest'

import { ADMIN_DEFAULT_RESET_PASSWORD } from '../config/authPasswordPolicy'
import { mapSessionToAuthUser } from './authMapping'

describe('admin default password reset auth mapping', () => {
  it('maps mustChangePassword from profile data', () => {
    const user = mapSessionToAuthUser({
      id: 'auth-1',
      profileId: 'p-1',
      email: 'user@example.com',
      displayName: 'Test User',
      role: 'viewer',
      mustChangePassword: true,
    })

    expect(user.mustChangePassword).toBe(true)
  })

  it('uses the approved temporary password constant', () => {
    expect(ADMIN_DEFAULT_RESET_PASSWORD).toBe('iLoveJesus')
    expect(ADMIN_DEFAULT_RESET_PASSWORD.length).toBeGreaterThanOrEqual(8)
  })
})
