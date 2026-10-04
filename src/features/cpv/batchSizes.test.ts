import { describe, expect, it } from 'vitest'

import { formatBatchSizeLabel, normalizeBatchSizes } from './batchSizes'

describe('batch sizes', () => {
  it('shows the commercial size and each alternate with its unit', () => {
    expect(formatBatchSizeLabel('100', 'Kg', [{ size: '50', unit: 'L' }])).toBe('100 Kg, 50 L')
    expect(formatBatchSizeLabel('', null, [])).toBe('—')
  })

  it('keeps Kg or L and drops a blank alternate', () => {
    expect(normalizeBatchSizes('120', 'Kg', [{ size: '', unit: 'L' }, { size: '80', unit: 'L' }])).toEqual({
      batch_size: '120',
      batch_size_unit: 'Kg',
      alternate_batch_sizes: [{ size: '80', unit: 'L' }],
    })
    expect(() => normalizeBatchSizes('-1', 'Kg', [])).toThrow(/zero or greater/)
    expect(() => normalizeBatchSizes('10', 'g', [])).toThrow(/Kg or L/)
  })
})
