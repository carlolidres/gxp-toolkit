import { describe, expect, it } from 'vitest'

import { arrangeReportRows, latestReportEntry, normalizeReportEntries } from './reportEntries'

describe('report entries', () => {
  it('lists the latest issued date first and shows that row on the sheet', () => {
    const rows = normalizeReportEntries([
      { tracer_no: 'R-2', issued_date: '2026-03-01', remarks: 'Later' },
      { tracer_no: 'R-1', issued_date: '2026-01-15', remarks: '' },
    ])
    expect(rows.map((row) => row.tracer_no)).toEqual(['R-2', 'R-1'])
    expect(latestReportEntry(rows)?.tracer_no).toBe('R-2')
  })

  it('keeps an unfinished row after the dated rows', () => {
    expect(
      arrangeReportRows([
        { tracer_no: 'R-1', issued_date: '15 Jan 2026', remarks: '' },
        { tracer_no: '', issued_date: '3 Oc', remarks: '' },
        { tracer_no: 'R-2', issued_date: '01 Mar 2026', remarks: '' },
      ]).map((row) => row.tracer_no),
    ).toEqual(['R-2', 'R-1', ''])
  })

  it('drops a blank row and requires a tracer and a date', () => {
    expect(normalizeReportEntries([{ tracer_no: '', issued_date: '', remarks: '' }])).toEqual([])
    expect(() => normalizeReportEntries([{ tracer_no: 'R-1', issued_date: '', remarks: '' }])).toThrow(/dd Mmm YYYY/)
    expect(normalizeReportEntries([{ tracer_no: 'R-3', issued_date: '02 Feb 2026', remarks: 'Noted' }])[0]?.issued_date).toBe(
      '2026-02-02',
    )
  })
})