import { describe, expect, it } from 'vitest'

import { createEmptyQcInstrument, sanitizeInstrumentsForSave, validateQcInstruments } from './vmpQcInstruments'

describe('vmp qc instruments', () => {
  it('rejects blank and duplicate instrument names', () => {
    const rows = [
      { ...createEmptyQcInstrument('qa@test.local'), instrumentName: 'HPLC 1' },
      { ...createEmptyQcInstrument('qa@test.local'), instrumentName: 'hplc 1' },
    ]
    expect(validateQcInstruments(rows)).toBe('Duplicate instrument entries are not allowed.')

    const blank = [{ ...createEmptyQcInstrument('qa@test.local'), instrumentName: '   ' }]
    expect(validateQcInstruments(blank)).toBe('At least one Associated QC Instrument is required.')
  })

  it('trims instrument names on save', () => {
    const rows = [{ ...createEmptyQcInstrument('qa@test.local'), instrumentName: '  GC No. 1  ' }]
    const saved = sanitizeInstrumentsForSave(rows, 'qa@test.local')
    expect(saved).toHaveLength(1)
    expect(saved[0].instrumentName).toBe('GC No. 1')
  })
})
