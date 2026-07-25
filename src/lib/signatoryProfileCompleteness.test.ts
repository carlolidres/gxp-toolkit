import { describe, expect, it } from 'vitest'

import { getSignatoryProfileCompleteness } from './signatoryProfileCompleteness'

describe('getSignatoryProfileCompleteness', () => {
  it('reports complete when name, title, and signature are set', () => {
    const result = getSignatoryProfileCompleteness({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      jobTitle: 'QA Manager',
      signatureDataUrl: 'data:image/png;base64,abc',
    })
    expect(result.complete).toBe(true)
    expect(result.missing).toEqual([])
    expect(result.fullName).toBe('Ada Lovelace')
  })

  it('lists missing profile fields for incomplete users', () => {
    const result = getSignatoryProfileCompleteness({
      name: 'Ada',
      email: 'ada@example.com',
      jobTitle: null,
      signatureDataUrl: null,
    })
    expect(result.complete).toBe(false)
    expect(result.missing).toEqual(['lastName', 'jobTitle', 'signature'])
    expect(result.reminderMessage).toContain('Account Settings')
    expect(result.reminderMessage).toContain('Last name')
  })
})
