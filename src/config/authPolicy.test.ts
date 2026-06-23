import { describe, expect, it } from 'vitest'

import { isDesignatedAdminEmail, resolveProfileRole } from '../config/authPolicy'

describe('authPolicy', () => {
  it('recognizes the designated administrator email', () => {
    expect(isDesignatedAdminEmail('carlolidres@gmail.com')).toBe(true)
    expect(isDesignatedAdminEmail('Carlolidres@gmail.com')).toBe(true)
    expect(isDesignatedAdminEmail('other@example.com')).toBe(false)
  })

  it('promotes the designated administrator to admin profile role', () => {
    expect(resolveProfileRole('carlolidres@gmail.com', 'user')).toBe('admin')
    expect(resolveProfileRole('other@example.com', 'user')).toBe('user')
  })
})
