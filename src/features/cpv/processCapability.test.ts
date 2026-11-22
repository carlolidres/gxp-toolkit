import { beforeEach, describe, expect, it } from 'vitest'

import { createWorkbook } from '../vmp/equipmentWorkbook'
import { capabilityInference, capabilityStats, processCapabilityReports, scopedCapabilityValues } from './processCapability'
import { saveProductSectionWorkbook, writeAnalyticalParameter } from './productProfileWorkbook'

describe('process capability', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('computes sample standard deviation and overall capability', () => {
    const stats = capabilityStats([10, 12, 11, 13, 10], 8, 14)
    expect(stats).not.toBeNull()
    expect(stats?.n).toBe(5)
    expect(stats?.mean).toBeCloseTo(11.2, 5)
    expect(stats?.stdev).toBeCloseTo(Math.sqrt(1.7), 5)
    expect(stats?.pp).toBeCloseTo(6 / (6 * Math.sqrt(1.7)), 5)
    expect(stats?.cp).toBeGreaterThan(0)
    expect(stats?.cpk).toBeGreaterThan(0)
  })

  it('opens one tab per quantitative parameter and skips qualitative results', () => {
    const book = createWorkbook()
    const thickness = writeAnalyticalParameter(book.sheets[0], 5, {
      parameter: 'THICKNESS',
      specification: '3.70–4.10 mm',
      unit: 'mm',
      kind: 'quantitative',
      usl: '4.10',
      lsl: '3.70',
    })
    const withResults = {
      ...thickness,
      cells: { ...thickness.cells, '3:1': 'B-1', '4:1': 'B-2', '3:5': '4.07', '4:5': '4.02' },
    }
    const mixed = writeAnalyticalParameter(withResults, 6, {
      parameter: 'APPEARANCE',
      specification: 'Complies',
      unit: '',
      kind: 'qualitative',
    })
    const afterfill = {
      ...mixed,
      id: 'afterfill',
      name: 'Afterfill',
      cells: { ...mixed.cells, '3:5': '4.08', '4:5': '4.03' },
    }
    saveProductSectionWorkbook('CAP-1', 'analytical-report', { ...book, sheets: [mixed, afterfill], activeSheetId: mixed.id })

    const reports = processCapabilityReports('CAP-1')
    expect(reports.map((report) => report.title)).toEqual(['THICKNESS (Sheet1)', 'THICKNESS (Afterfill)'])
    expect(reports[0]?.values).toEqual([4.07, 4.02])
    expect(reports.every((report) => report.parameter !== 'APPEARANCE')).toBe(true)
  })

  it('keeps specification conformance, control limits, and modeled defect rates separate', () => {
    const values = [4.07, 4.02, 4.10, 4.08, 4.03]
    const stats = capabilityStats(values, 3.7, 4.1)
    const inference = capabilityInference({
      parameter: 'THICKNESS',
      stage: 'Bulk',
      unit: 'mm',
      lsl: 3.7,
      usl: 4.1,
      target: 3.9,
    }, values, stats, 'all', values.length)
    const boxplot = inference.boxplot.join(' ')
    const sixpack = inference.sixpack.join(' ')
    expect(boxplot).toContain('All 5 analyzed results are inside')
    expect(boxplot).toContain('does not assess statistical stability')
    expect(sixpack).toContain('does not demonstrate that the process is stable')
    expect(sixpack).toContain('not evidence that the results are normally distributed')
    expect(sixpack).toContain('not observed out-of-specification counts')
    expect(sixpack).toContain('Last 30 observations')
    expect(sixpack).toContain('the full selected window')
    expect(sixpack).toContain('not a regulatory requirement')
    expect(sixpack).not.toContain('caused by')
  })

  it('qualifies a moving-range signal without assigning a cause', () => {
    const values = [10, 10, 10, 10, 10, 20]
    const stats = capabilityStats(values, 0, 30)
    expect(stats?.movingRanges.some((value) => value > (stats?.movingRangeUcl ?? 0))).toBe(true)
    const sixpack = capabilityInference({
      parameter: 'Assay',
      stage: 'Bulk',
      unit: 'mg',
      lsl: 0,
      usl: 30,
      target: 15,
    }, values, stats, 'all', values.length).sixpack.join(' ')
    expect(sixpack).toContain('statistical control is not demonstrated')
    expect(sixpack).toContain('does not identify the cause')
  })

  it('uses every result by default and can keep the latest 30', () => {
    const values = Array.from({ length: 40 }, (_, index) => 10 + (index % 3) * 0.1)
    expect(scopedCapabilityValues(values, 'all')).toHaveLength(40)
    expect(scopedCapabilityValues(values, 'latest-30')).toEqual(values.slice(-30))
    const stats = capabilityStats(values.slice(-30), 8, 14)
    const text = capabilityInference({
      parameter: 'Weight',
      stage: 'Bulk',
      unit: 'mg',
      lsl: 8,
      usl: 14,
      target: 11,
    }, values.slice(-30), stats, 'latest-30', values.length).sixpack.join(' ')
    expect(text).toContain('latest 30 of 40')
    const fullWindow = capabilityInference({
      parameter: 'Weight',
      stage: 'Bulk',
      unit: 'mg',
      lsl: 8,
      usl: 14,
      target: 11,
    }, values, capabilityStats(values, 8, 14), 'all', values.length).sixpack.join(' ')
    expect(fullWindow).toContain('the latest 30 in the selected window')
  })
})
