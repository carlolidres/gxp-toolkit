import { describe, expect, it } from 'vitest'

import {
  addCalendarDays,
  classifyDelivery,
  defaultCommitmentSchedule,
  defaultStabilityPullOutDate,
  expectedStabilityTabulationCompletionDate,
} from './scheduling'

describe('apqr scheduling', () => {
  it('computes default stability pull-out 60 days before coverage end', () => {
    expect(defaultStabilityPullOutDate('2026-12-31')).toBe('2026-11-01')
  })

  it('computes commitment schedule 90 days after coverage end', () => {
    expect(defaultCommitmentSchedule('2026-12-31')).toBe('2027-03-31')
  })

  it('computes expected stability tabulation completion', () => {
    expect(expectedStabilityTabulationCompletionDate('2026-11-01')).toBe(addCalendarDays('2026-11-01', 90))
  })

  it('classifies on-time and overdue delivery', () => {
    expect(classifyDelivery('2027-03-31', '2027-03-30')).toBe('Delivered On Time')
    expect(classifyDelivery('2027-03-31', '2027-04-01')).toBe('Delivered Overdue')
    expect(classifyDelivery('2027-03-31', null, '2027-04-01')).toBe('Currently Overdue and Undelivered')
  })
})
