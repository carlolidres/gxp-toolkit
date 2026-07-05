import { describe, expect, it } from 'vitest'

import { APQR_ID_PATTERN, generateApqrId, generateUniqueApqrId, isValidApqrId } from './apqrId'

describe('apqrId', () => {
  it('generates 4-character mixed-case alphanumeric IDs', () => {
    for (let i = 0; i < 40; i += 1) {
      const id = generateApqrId()
      expect(id).toMatch(APQR_ID_PATTERN)
      expect(isValidApqrId(id)).toBe(true)
    }
  })

  it('skips taken IDs', () => {
    const taken = new Set<string>()
    const first = generateUniqueApqrId(taken)
    taken.add(first)
    const second = generateUniqueApqrId(taken)
    expect(second).not.toBe(first)
    expect(isValidApqrId(second)).toBe(true)
  })
})
