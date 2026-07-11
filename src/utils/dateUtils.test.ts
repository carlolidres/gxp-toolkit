import { describe, expect, it } from 'vitest'

import {
  currentAppMonthYear,
  dateInAppMonthYear,
  formatAppDate,
  formatAppDateTime,
  formatAppMonthYear,
  parseIsoDate,
} from './dateUtils'

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

  it('formats month-year values as Mmm YYYY', () => {
    expect(formatAppMonthYear('2026-07')).toBe('Jul 2026')
    expect(formatAppMonthYear('2026-07-15')).toBe('Jul 2026')
    expect(formatAppMonthYear(null)).toBe('—')
  })

  it('returns the current calendar month as YYYY-MM', () => {
    expect(currentAppMonthYear(new Date(2026, 6, 11))).toBe('2026-07')
  })

  it('matches ISO dates that fall within a YYYY-MM month', () => {
    expect(dateInAppMonthYear('2026-07-01', '2026-07')).toBe(true)
    expect(dateInAppMonthYear('2026-07-31', '2026-07')).toBe(true)
    expect(dateInAppMonthYear('2026-06-30', '2026-07')).toBe(false)
    expect(dateInAppMonthYear(null, '2026-07')).toBe(false)
    expect(dateInAppMonthYear('2026-07-01', '')).toBe(true)
  })
})
