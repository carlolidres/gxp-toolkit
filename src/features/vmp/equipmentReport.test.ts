import { describe, expect, it } from 'vitest'

import { buildEquipmentMasterlist, displayMasterlistDate } from './equipmentMasterlist'
import {
  cleanabilityRating,
  equipmentAgeYears,
  equipmentProductUsers,
  findEquipmentRecord,
  htrAssessment,
  overallCleanability,
  type CleanPart,
} from './equipmentReport'

const part = (patch: Partial<CleanPart>): CleanPart => ({
  id: 'part',
  name: 'Inner Wall',
  moc: '',
  htc: 1,
  htcJustification: 'Smooth wall, cleaning demonstrated.',
  physical: 1,
  disassembly: 1,
  visual: 1,
  cleaning: 1,
  sampling: 1,
  ...patch,
})

describe('equipment report', () => {
  it('shows month-only source dates as the first of that month', () => {
    expect(displayMasterlistDate('Aug 2023')).toBe('01 Aug 2023')
    expect(displayMasterlistDate('August 2028')).toBe('01 Aug 2028')
    expect(displayMasterlistDate('15 Aug 2023')).toBe('15 Aug 2023')
  })

  it('opens the numbered equipment from the masterlist', () => {
    const record = findEquipmentRecord(buildEquipmentMasterlist(), 'Main Equipment', 'LIQUIDS PRODUCTS MANUFACTURING DEPARTMENT', '1')
    expect(record?.equipment).toBe('SJT #1')
    expect(record?.ilTag).toBe('IL-1049')
    expect(record?.approval).toBe('01 Aug 2023')
    expect(record?.nextReview).toBe('01 Aug 2028')
  })

  it('calculates age in completed years', () => {
    expect(equipmentAgeYears('15 Aug 2023', new Date(2026, 10, 2))).toBe('3 years')
    expect(equipmentAgeYears('15 Aug 2026', new Date(2026, 10, 2))).toBe('Less than 1 year')
    expect(equipmentAgeYears('', new Date(2026, 10, 2))).toBe('')
  })

  it('rates reach, cleanability, and the overall equipment', () => {
    expect(htrAssessment(part({}))).toEqual({ score: 5, rating: 1 })
    expect(htrAssessment(part({ physical: 2, disassembly: 2, visual: 2, cleaning: 2, sampling: 1 }))).toEqual({ score: 9, rating: 2 })
    expect(htrAssessment(part({ physical: 3, disassembly: 1, visual: 1, cleaning: 1, sampling: 1 }))).toEqual({ score: 7, rating: 3 })
    expect(htrAssessment(part({ sampling: null })).rating).toBeNull()
    expect(cleanabilityRating(part({ htc: 3, physical: 2, disassembly: 2, visual: 2, cleaning: 2, sampling: 1 }))).toBe(3)
    expect(cleanabilityRating(part({ htcJustification: ' ' }))).toBeNull()
    const blade = part({ id: 'blade', htc: 3, physical: 2, disassembly: 2, visual: 2, cleaning: 2, sampling: 1 })
    const wall = part({ id: 'wall' })
    expect(overallCleanability([wall, blade])).toBe(3)
    expect(overallCleanability([wall, part({ sampling: null })])).toBeNull()
  })

  it('lists products whose equipment sheet names this equipment', () => {
    localStorage.setItem('gxp.cpv.product-profile.v1', JSON.stringify({
      'ABES:equipment': { sheets: [{ name: 'Granulation', cells: { '4:0': 'SJT #1 (IL-1049)' } }] },
      'OTHER:equipment': { sheets: [{ name: 'Granulation', cells: { '4:0': 'SJT #2 (IL-0633)' } }] },
    }))
    expect(equipmentProductUsers('SJT #1', 'IL-1049', new Map([['ABES', 'Abes Product']]))).toEqual([
      { productCode: 'ABES', productName: 'Abes Product', processes: 'Granulation' },
    ])
    localStorage.removeItem('gxp.cpv.product-profile.v1')
  })
})