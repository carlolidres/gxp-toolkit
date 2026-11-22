import { describe, expect, it } from 'vitest'

import { forecastStabilitySeries, stabilityMonths, stabilityTimeTicks } from './stabilityForecast'

describe('stability forecast', () => {
  it('refuses a slope when fewer than three time points exist', () => {
    const forecast = forecastStabilitySeries('PO-1', 'ASSAY (%)', '%', [
      { months: 0, label: 'Initial', value: 100 },
      { months: 3, label: '3 Months', value: 99 },
    ], { usl: 110, lsl: 90 })
    expect(forecast.status).toBe('insufficient_data')
    expect(forecast.rows).toEqual([])
    expect(forecast.curve).toEqual([])
    expect(forecast.inference).toMatch(/insufficient evidence/i)
    expect(forecast.inference).toMatch(/approved shelf life/i)
  })

  it('fits a zero-order line and keeps the forecast separate from an approved expiry', () => {
    const forecast = forecastStabilitySeries('PO-1', 'ASSAY (%)', '%', [
      { months: 0, label: 'Initial', value: 100 },
      { months: 3, label: '3 Months', value: 99 },
      { months: 6, label: '6 Months', value: 98 },
      { months: 9, label: '9 Months', value: 97 },
    ], { usl: 110, lsl: 90 })
    expect(stabilityMonths('Initial')).toBe(0)
    expect(stabilityMonths('6 Months')).toBe(6)
    expect(forecast.model).toBe('zero-order')
    expect(forecast.rows.find((row) => row.label === 'Initial')?.mean).toBeCloseTo(100, 5)
    expect(forecast.rows.find((row) => row.extrapolated)?.extrapolated).toBe(true)
    expect(forecast.interval).toBe('mean')
    expect(forecast.curve.find((point) => point.months === 0)?.mean).toBeCloseTo(100, 5)
    expect(forecast.curve.some((point) => point.months > forecast.horizon)).toBe(true)
    expect(stabilityTimeTicks(0, 48)).toEqual([0, 12, 24, 36, 48])
    expect(forecast.inference).toMatch(/operational forecast/i)
    expect(forecast.inference).toMatch(/stayed inside the entered USL and LSL/i)
    expect(forecast.inference).not.toMatch(/approved expiry is/i)
  })

  it('does not treat missing limits as conformance', () => {
    const forecast = forecastStabilitySeries('PO-1', 'MOISTURE CONTENT (%)', '%', [
      { months: 0, label: 'Initial', value: 1.1 },
      { months: 3, label: '3 Months', value: 2.5 },
      { months: 6, label: '6 Months', value: 2.4 },
    ], { usl: null, lsl: null })
    expect(forecast.inference).toMatch(/No USL or LSL has been entered/i)
    expect(forecast.inference).not.toMatch(/stayed inside/i)
  })
})
