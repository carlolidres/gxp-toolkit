import { describe, expect, it } from 'vitest'

import { formatDashboardGreeting, getTimeOfDayGreeting } from './greeting'

describe('greeting', () => {
  it('returns morning between 05:00 and 11:59', () => {
    expect(getTimeOfDayGreeting(new Date('2026-06-23T08:30:00'))).toBe('Good morning')
  })

  it('returns afternoon between 12:00 and 17:59', () => {
    expect(getTimeOfDayGreeting(new Date('2026-06-23T14:00:00'))).toBe('Good afternoon')
  })

  it('returns evening outside daytime hours', () => {
    expect(getTimeOfDayGreeting(new Date('2026-06-23T20:00:00'))).toBe('Good evening')
    expect(getTimeOfDayGreeting(new Date('2026-06-23T03:00:00'))).toBe('Good evening')
  })

  it('formats dashboard greeting with display name', () => {
    expect(formatDashboardGreeting('carlolidres', new Date('2026-06-23T14:00:00'))).toBe(
      'Good afternoon, carlolidres',
    )
  })

  it('uses an explicit IANA timezone when provided', () => {
    // 2026-06-23T04:00:00Z is 12:00 in Asia/Taipei (afternoon) and 00:00 in UTC (evening)
    const instant = new Date('2026-06-23T04:00:00Z')
    expect(getTimeOfDayGreeting(instant, 'Asia/Taipei')).toBe('Good afternoon')
    expect(getTimeOfDayGreeting(instant, 'UTC')).toBe('Good evening')
  })
})
