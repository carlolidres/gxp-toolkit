import { describe, expect, it } from 'vitest'

import { formatAppDate, formatAppDateTime, parseIsoDate } from './dateUtils'

describe('dateUtils', () => {
  it('formats ISO dates as dd Mmm YYYY', () => {
    expect(formatAppDate('2025-01-01')).toBe('01 Jan 2025')
    expect(formatAppDate('2025-12-31')).toBe('31 Dec 2025')
    expect(formatAppDate(null)).toBe('—')
  })

  it('parses ISO date prefixes without timezone drift', () => {
    expect(parseIsoDate('2025-01-01T12:00:00Z')).toEqual({ year: 2025, month: 1, day: 1 })
  })

  it('formats datetime values with the same date pattern', () => {
    expect(formatAppDateTime('2025-01-01T14:30:00')).toMatch(/^01 Jan 2025, \d{2}:\d{2} (am|pm)$/)
  })
})
