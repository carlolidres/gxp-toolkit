import { describe, expect, it } from 'vitest'

import {
  applyVmpMasterlistFilters,
  emptyVmpFilters,
  generateRecordId,
  getControlledSelectValue,
  getEquipmentGroupOptions,
  getOtherOptionValue,
  getVmpKpiCounts,
  mergeVmpOptions,
  VMP_OTHER_OPTION,
  vmpMasterlistSeedRecords,
} from './vmpMasterlist'
import { getCalculatedDueStatus, getDueMonth, getDueYear } from './vmpMasterlistSchedule'

const referenceDate = new Date('2026-06-28T00:00:00')

describe('vmp masterlist selectors', () => {
  it('filters by combined fields and search text', () => {
    const rows = applyVmpMasterlistFilters(
      vmpMasterlistSeedRecords,
      {
        ...emptyVmpFilters,
        validationArea: 'Equipment',
        criticality: 'High',
        search: 'AU-041',
      },
      'all',
      referenceDate,
    )

    expect(rows.map((row) => row.recordId)).toEqual(['VMP-EQ-02-000-041'])
  })

  it('computes KPI selectors from record dates and statuses', () => {
    expect(getVmpKpiCounts(vmpMasterlistSeedRecords, referenceDate)).toMatchObject({
      all: 5,
      qualified: 2,
      dueSoon: 1,
      overdue: 1,
      highRisk: 3,
    })

    expect(
      applyVmpMasterlistFilters(vmpMasterlistSeedRecords, emptyVmpFilters, 'dueSoon', referenceDate).map(
        (row) => row.recordId,
      ),
    ).toEqual(['VMP-EQ-02-000-041'])
  })

  it('keeps registry options unique and maps custom values to Others', () => {
    const options = mergeVmpOptions(['Report', 'Protocol', 'Report'], ['Others'])

    expect(options).toEqual(['Protocol', 'Report', VMP_OTHER_OPTION])
    expect(getControlledSelectValue('Protocol', options)).toBe('Protocol')
    expect(getControlledSelectValue('Direct Impact Equipment', options)).toBe(VMP_OTHER_OPTION)
    expect(getOtherOptionValue('Direct Impact Equipment', options)).toBe('Direct Impact Equipment')
  })

  it('derives schedule fields from next due date', () => {
    expect(getDueMonth('2030-03-31')).toBe('March')
    expect(getDueYear('2030-03-31')).toBe('2030')
    expect(getCalculatedDueStatus('2026-06-20', referenceDate)).toBe('Overdue')
    expect(getCalculatedDueStatus('2026-08-15', referenceDate)).toBe('DueSoon')
  })

  it('generates unique record ids by validation area', () => {
    const existing = vmpMasterlistSeedRecords.map((record) => record.recordId)
    const next = generateRecordId('Equipment', existing)
    expect(next).toBe('VMP-EQ-02-000-042')
    expect(existing).not.toContain(next)
  })

  it('returns equipment group options for liquids manufacturing department', () => {
    const options = getEquipmentGroupOptions('LIQUIDS PRODUCTS MANUFACTURING DEPARTMENT')
    expect(options).toContain('Steam-Jacketed Tank (SJT)')
    expect(options).toContain('Filters')
    expect(getEquipmentGroupOptions('DRY PRODUCTS MANUFACTURING')).toEqual([])
  })
})
