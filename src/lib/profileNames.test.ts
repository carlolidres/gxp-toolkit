import { describe, expect, it } from 'vitest'

import { joinDisplayName, splitDisplayName } from './profileNames'

describe('profileNames', () => {
  it('splits a full display name into first and last name', () => {
    expect(splitDisplayName('Carlo Lidres', 'carlo@example.com')).toEqual({
      firstName: 'Carlo',
      lastName: 'Lidres',
    })
  })

  it('joins first and last name into a display name', () => {
    expect(joinDisplayName('Carlo', 'Lidres')).toBe('Carlo Lidres')
  })
})
