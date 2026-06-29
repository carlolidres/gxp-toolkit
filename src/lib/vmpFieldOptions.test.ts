import { describe, expect, it } from 'vitest'

import { VMP_OTHER_OPTION } from './vmpMasterlist'
import {
  applyCascadeOnChange,
  findDuplicateOption,
  resolveDepartmentField,
  resolveGroupField,
  resolveRoomLineField,
  valuesMatch,
} from './vmpFieldOptions'

describe('vmp field option resolver', () => {
  it('returns Plant 1 thermal mapping departments for facilities', () => {
    const ctx = {
      validationArea: 'Facilities' as const,
      sitePlant: 'Plant 1',
      department: '',
      group: 'Area Thermal Mapping',
    }
    const field = resolveDepartmentField(ctx, [])
    expect(field.options).toContain('Warehouse')
    expect(field.options).toContain('Soft Gel')
    expect(field.options[field.options.length - 1]).toBe(VMP_OTHER_OPTION)
  })

  it('returns Plant 2 thermal mapping departments for facilities', () => {
    const field = resolveDepartmentField(
      {
        validationArea: 'Facilities',
        sitePlant: 'Plant 2',
        department: '',
        group: 'Area Thermal Mapping',
      },
      [],
    )
    expect(field.options).toEqual(['Cephalosporin', 'Stability / Retention Room', VMP_OTHER_OPTION])
  })

  it('returns equipment packaging groups for liquids packaging department', () => {
    const field = resolveGroupField(
      {
        validationArea: 'Equipment',
        sitePlant: 'Plant 1',
        department: 'LIQUIDS PRODUCTS PACKAGING',
        group: '',
      },
      [],
    )
    expect(field.options).toContain('Mixers')
    expect(field.options).toContain('Cartoning Machine')
  })

  it('returns only Others for softgel equipment groups', () => {
    const field = resolveGroupField(
      {
        validationArea: 'Equipment',
        sitePlant: 'Plant 1',
        department: 'SOFTGEL',
        group: '',
      },
      [],
    )
    expect(field.options).toEqual([VMP_OTHER_OPTION])
  })

  it('renames room line to section for equipment thermal mapping', () => {
    const field = resolveRoomLineField(
      {
        validationArea: 'Equipment',
        sitePlant: 'Plant 1',
        department: 'Equipment Thermal Mapping',
        group: '',
      },
      [],
    )
    expect(field.label).toBe('Section')
    expect(field.options).toContain('QC')
    expect(field.options).toContain('Micro')
  })

  it('clears incompatible child values when parent changes', () => {
    const next = applyCascadeOnChange(
      {
        validationArea: 'Equipment',
        sitePlant: 'Plant 1',
        department: 'LIQUIDS PRODUCTS PACKAGING',
        group: 'Mixers',
        roomLine: '',
      },
      'department',
      'DRY PRODUCTS MANUFACTURING',
      [],
      [],
    )
    expect(next.group).toBe('')
  })

  it('clears section when leaving equipment thermal mapping', () => {
    const next = applyCascadeOnChange(
      {
        validationArea: 'Equipment',
        sitePlant: 'Plant 1',
        department: 'Equipment Thermal Mapping',
        group: '',
        roomLine: 'QC',
      },
      'department',
      'SOFTGEL',
      [],
      [],
    )
    expect(next.roomLine).toBe('')
  })

  it('detects duplicate custom options case-insensitively', () => {
    expect(findDuplicateOption('mixing equipment', ['Mixing Equipment', VMP_OTHER_OPTION])).toBe('Mixing Equipment')
    expect(valuesMatch('MIXING EQUIPMENT', 'mixing equipment')).toBe(true)
  })

  it('hides department for Utilities validation area', () => {
    const field = resolveDepartmentField(
      { validationArea: 'Utilities', sitePlant: 'Plant 1', department: '', group: '' },
      ['Engineering'],
    )
    expect(field.visible).toBe(false)
  })

  it('returns computerized systems department options', () => {
    const field = resolveDepartmentField(
      { validationArea: 'Computerized Systems', sitePlant: 'Plant 1', department: '', group: '' },
      [],
    )
    expect(field.options).toContain('Plant-Wide')
    expect(field.options).toContain('QC Plant 1')
    expect(field.options).toContain('Warehouse')
  })

  it('hides group for Computerized Systems validation area', () => {
    const field = resolveGroupField(
      { validationArea: 'Computerized Systems', sitePlant: 'Plant 1', department: 'Chemical Dispensing', group: '' },
      [],
    )
    expect(field.visible).toBe(false)
    expect(field.useDropdown).toBe(false)
  })

  it('clears group when switching to Computerized Systems', () => {
    const next = applyCascadeOnChange(
      {
        validationArea: 'Equipment',
        sitePlant: 'Plant 1',
        department: 'SOFTGEL',
        group: 'Mixers',
        roomLine: '',
      },
      'validationArea',
      'Computerized Systems',
      [],
      [],
    )
    expect(next.group).toBe('')
  })

  it('returns cleaning validation group options', () => {
    const field = resolveGroupField(
      { validationArea: 'Cleaning Validation', sitePlant: 'Plant 1', department: 'Validation', group: '' },
      [],
    )
    expect(field.options).toContain('Cross-Contamination Study')
    expect(field.options).toContain('CIP Verification')
  })

  it('returns plant qualification department and group options', () => {
    const dept = resolveDepartmentField(
      { validationArea: 'Plant Qualification', sitePlant: 'Plant 1', department: '', group: '' },
      [],
    )
    expect(dept.options).toContain('LIQUIDS PRODUCTS MANUFACTURING')
    expect(dept.options).toContain('CEPHALOSPHORIN')

    const group = resolveGroupField(
      { validationArea: 'Plant Qualification', sitePlant: 'Plant 1', department: 'COSMETICS', group: '' },
      [],
    )
    expect(group.options).toContain('Fume Hood Qualification')
    expect(group.options).toContain('ETB Qualification')
  })

  it('returns thermal mapping groups for equipment thermal mapping department', () => {
    const field = resolveGroupField(
      {
        validationArea: 'Equipment',
        sitePlant: 'Plant 1',
        department: 'Equipment Thermal Mapping',
        group: '',
      },
      [],
    )
    expect(field.options).toContain('Refrigerators / Chillers / Freezers')
    expect(field.options).toContain('Laboratory Ovens')
  })

  it('clears department when switching to Utilities', () => {
    const next = applyCascadeOnChange(
      {
        validationArea: 'Equipment',
        sitePlant: 'Plant 1',
        department: 'SOFTGEL',
        group: 'Mixers',
        roomLine: '',
      },
      'validationArea',
      'Utilities',
      [],
      [],
    )
    expect(next.department).toBe('')
  })
})
