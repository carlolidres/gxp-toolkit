import { describe, expect, it } from 'vitest'

import { mapSessionToAuthUser, mapVrmsRoleToUserRole } from './authMapping'

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

  it('maps database user role to Viewer', () => {
    expect(mapVrmsRoleToUserRole('user')).toBe('Viewer')
  })
})
