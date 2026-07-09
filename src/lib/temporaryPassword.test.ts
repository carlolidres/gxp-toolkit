import { describe, expect, it } from 'vitest'

import { generateTemporaryPassword, isStrongTemporaryPassword } from './temporaryPassword'

describe('generateTemporaryPassword', () => {
  it('returns a 16-character password with required character classes', () => {
    const password = generateTemporaryPassword(16)
    expect(password).toHaveLength(16)
    expect(isStrongTemporaryPassword(password)).toBe(true)
  })
})
