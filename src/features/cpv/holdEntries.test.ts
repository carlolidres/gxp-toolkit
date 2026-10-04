import { describe, expect, it } from 'vitest'

import { normalizeHoldEntries } from './holdEntries'

describe('hold entries', () => {
  it('keeps a report reference with its hold-time note and drops a blank row', () => {
    expect(
      normalizeHoldEntries([
        { report_ref: ' BHT-12 ', issued_date: '01 Mar 2026', hold_time: '  48 hours at 25°C  ' },
        { report_ref: '', issued_date: '', hold_time: '' },
      ]),
    ).toEqual([{ report_ref: 'BHT-12', issued_date: '2026-03-01', hold_time: '48 hours at 25°C' }])
    expect(() => normalizeHoldEntries([{ report_ref: '', hold_time: '12 hours' }])).toThrow(/reference/)
    expect(() => normalizeHoldEntries([{ report_ref: 'BHT-1', issued_date: '32 Jan 2026', hold_time: '' }])).toThrow(/dd Mmm YYYY/)
  })
})
