import { describe, expect, it } from 'vitest'

import {
  calculateSummary,
  cpk,
  detectConsecutiveTrend,
  mean,
  median,
  movingRange,
  outOfSpec,
  standardDeviation,
} from './statistics'

describe('statistics utilities', () => {
  it('calculates descriptive statistics', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9], false)).toBe(2)
    expect(movingRange([2, 5, 4])).toEqual([3, 1])
  })

  it('detects trends and specification excursions', () => {
    expect(detectConsecutiveTrend([1, 2, 3, 4, 5, 6])).toBe('upward')
    expect(outOfSpec([8, 10, 12], 9, 11)).toEqual([0, 2])
  })

  it('calculates capability and a complete summary', () => {
    const values = [98, 99, 100, 101, 102]
    expect(cpk(values, 90, 110)).toBeGreaterThan(1)
    expect(calculateSummary(values, { lsl: 90, usl: 110 }).outOfSpec).toBe(0)
  })
})

