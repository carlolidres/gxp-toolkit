import { describe, expect, it } from 'vitest'

import { hasCppEntries, normalizeCppMonitoring } from './cppMonitoring'

describe('CPP monitoring', () => {
  it('keeps a VMP report number and complete CPP rows', () => {
    const saved = normalizeCppMonitoring({
      vmp_report_no: ' VMP-10 ',
      issued_date: '02 Feb 2026',
      steps: [
        { step_no: ' I.1 ', description: ' Blend ', cpp: ' Speed ' },
        { step_no: '', description: '', cpp: '' },
      ],
    })
    expect(saved).toEqual({
      vmp_report_no: 'VMP-10',
      issued_date: '2026-02-02',
      steps: [{ step_no: 'I.1', description: 'Blend', cpp: 'Speed' }],
    })
    expect(hasCppEntries(saved)).toBe(true)
    expect(hasCppEntries({ vmp_report_no: '', issued_date: '', steps: [] })).toBe(false)
    expect(() =>
      normalizeCppMonitoring({ vmp_report_no: '', issued_date: '32 Jan 2026', steps: [] }),
    ).toThrow(/dd Mmm YYYY/)
    expect(() =>
      normalizeCppMonitoring({
        vmp_report_no: '',
        issued_date: '',
        steps: [{ step_no: 'I.1', description: '', cpp: '' }],
      }),
    ).toThrow(/required/)
  })
})
