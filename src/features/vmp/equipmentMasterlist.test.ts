import { describe, expect, it } from 'vitest'

import { listEquipmentAuditEvents, logEquipmentDeletion, logEquipmentRecord, setEquipmentAuditActor } from './equipmentAudit'
import {
  applyEquipmentRecord,
  AUXILIARY_DEPARTMENTS,
  AUXILIARY_SHEET,
  buildEquipmentMasterlist,
  deleteEquipmentRecord,
  equipmentMasterlistDepartments,
  equipmentMasterlistFlags,
  equipmentRecordFromSheet,
  equipmentSheetDepartments,
  filterEquipmentMasterlist,
  reviewOneYearAfter,
} from './equipmentMasterlist'
import { createSheet, createWorkbook } from './equipmentWorkbook'
import { workbookToXlsx, xlsxToWorkbook } from './workbookXlsx'

function rowOf(cells: Record<string, string> | undefined, value: string): number {
  const found = Object.keys(cells ?? {}).find((key) => cells?.[key] === value && key.endsWith(':0'))
  return Number(found?.split(':')[0] ?? -1)
}

describe('equipment masterlist', () => {
  it('loads every department from the 2025 masterlist', () => {
    const departments = equipmentMasterlistDepartments()
    expect(departments).toHaveLength(14)
    expect(departments.reduce((total, department) => total + department.count, 0)).toBe(322)
    expect(departments.map((department) => department.title)).toContain('COSMETICS DEPARTMENT')
    expect(departments.map((department) => department.title)).toContain('CREAMS AND OINTMENT DEPARTMENT')
    const workbook = buildEquipmentMasterlist()
    const all = workbook.sheets[0]
    expect(workbook.sheets).toHaveLength(2)
    expect(all?.name).toBe('Main Equipment')
    expect(workbook.sheets[1]?.name).toBe(AUXILIARY_SHEET)
    expect(equipmentSheetDepartments(AUXILIARY_SHEET)).toEqual([...AUXILIARY_DEPARTMENTS])
    expect(Object.values(workbook.sheets[1]?.cells ?? {})).toContain('CEPHALOSPHORIN MANUFACTURING PLANT 2')
    expect(Object.values(workbook.sheets[1]?.cells ?? {}).some((value) => value.startsWith('QUALITY CONTROL'))).toBe(false)
    expect(all?.cells['0:0']).toBe('LIQUIDS PRODUCTS MANUFACTURING DEPARTMENT')
    expect(all?.cells['2:1']).toBe('SJT #1')
    expect(all?.cells['2:2']).toBe('IL-1049')
    expect(all?.cells['2:6']).toBe('01 Aug 2023')
    expect(all?.cells['2:7']).toBe('01 Aug 2028')
    expect(all?.cells['1:7']).toBe('Next Review Date')
    expect(all?.cells['2:3']).toBeUndefined()
    expect(all?.columnCount).toBe(8)
    expect(all?.rowCount).toBeGreaterThan(2)
    expect(all?.cells[`${(all?.rowCount ?? 1) - 1}:0`] || all?.cells[`${(all?.rowCount ?? 1) - 1}:1`]).toBeTruthy()
    expect(Object.keys(all?.cells ?? {}).some((key) => Number(key.split(':')[1]) >= 8)).toBe(false)
    const dry = rowOf(all?.cells, 'DRY PRODUCTS MANUFACTURING DEPARTMENT')
    expect(all?.cells[`${dry + 2}:3`]).toBe('Gran')
    const cosmetics = rowOf(all?.cells, 'COSMETICS DEPARTMENT')
    expect(all?.cells[`${cosmetics + 2}:1`]).toBe('Gasti 2 Filling Machine')
    expect(all?.cells[`${cosmetics + 3}:1`]).toBe('Gasti 1 Filling Machine')
    const flags = equipmentMasterlistFlags()
    expect(flags.some((flag) => flag.issue.includes('Mar 242024'))).toBe(true)
    expect(flags.some((flag) => flag.issue.includes('Jan 20205'))).toBe(true)
    expect(flags.some((flag) => flag.issue.includes('IL-1515'))).toBe(true)
  })

  it('registers equipment in the selected department', () => {
    const workbook = buildEquipmentMasterlist()
    const next = applyEquipmentRecord(workbook, {
      department: 'LIQUIDS PRODUCTS MANUFACTURING DEPARTMENT',
      equipment: 'Trial Tank',
      ilTag: 'EQ-100',
      section: 'Movable',
      protocol: '',
      report: '',
      approval: '15 Aug 2026',
      nextReview: '15 Aug 2027',
      sourceDepartment: '',
      sourceNo: '',
    }, true)
    const sheet = next.sheets[0]
    expect(sheet?.cells['74:1']).toBe('Trial Tank')
    expect(sheet?.cells['74:0']).toBe('73')
    expect(sheet?.cells['74:2']).toBe('EQ-100')
    expect(sheet?.cells['74:3']).toBe('Movable')
    expect(sheet?.cells['74:7']).toBe('15 Aug 2027')
    expect(next.sheets).toHaveLength(2)
  })

  it('keeps auxiliary equipment on the auxiliary sheet', () => {
    const workbook = buildEquipmentMasterlist()
    const next = applyEquipmentRecord(workbook, {
      department: 'SOFTGEL FACILITY',
      equipment: 'Auxiliary Pump',
      ilTag: 'AUX-1',
      section: 'Line 1',
      protocol: '',
      report: '',
      approval: '01 Aug 2026',
      nextReview: '01 Aug 2027',
      sourceDepartment: '',
      sourceNo: '',
    }, true, AUXILIARY_SHEET)
    expect(Object.values(next.sheets[1]?.cells ?? {})).toContain('Auxiliary Pump')
    expect(Object.values(next.sheets[0]?.cells ?? {})).not.toContain('Auxiliary Pump')
    expect(() => applyEquipmentRecord(workbook, {
      department: 'QUALITY CONTROL Plant 2',
      equipment: 'Auxiliary Pump',
      ilTag: 'AUX-1',
      section: 'QC',
      protocol: '',
      report: '',
      approval: '',
      nextReview: '',
      sourceDepartment: '',
      sourceNo: '',
    }, true, AUXILIARY_SHEET)).toThrow(/department/)
  })

  it('keeps a legacy review date and defaults the next review one year after a full approval date', () => {
    expect(reviewOneYearAfter('15 Aug 2023')).toBe('15 Aug 2024')
    expect(reviewOneYearAfter('Aug 2023')).toBe('01 Aug 2024')
    const workbook = buildEquipmentMasterlist()
    const current = equipmentRecordFromSheet(workbook.sheets[0]!, 2)
    expect(current.nextReview).toBe('01 Aug 2028')
    expect(current.approval).toBe('01 Aug 2023')
  })

  it('filters by equipment name or IL tag and deletes with a reason', () => {
    const workbook = buildEquipmentMasterlist()
    const filtered = filterEquipmentMasterlist(workbook, 'il-1049')
    expect(filtered.sheets[0]?.cells['2:1']).toBe('SJT #1')
    expect(Object.values(filtered.sheets[0]?.cells ?? {}).filter((value) => value === 'SJT #2')).toHaveLength(0)
    const sorted = filterEquipmentMasterlist(workbook, 'sjt #')
    const names = Object.entries(sorted.sheets[0]?.cells ?? {})
      .filter(([key, value]) => key.endsWith(':1') && value.startsWith('SJT #'))
      .sort(([a], [b]) => Number(a.split(':')[0]) - Number(b.split(':')[0]))
      .map(([, value]) => value)
    expect(names.slice(0, 4)).toEqual(['SJT #1', 'SJT #2', 'SJT #3', 'SJT #4'])
    expect(() => deleteEquipmentRecord(workbook, equipmentRecordFromSheet(workbook.sheets[0]!, 2), ' ')).toThrow(/reason/)
    const removed = deleteEquipmentRecord(workbook, equipmentRecordFromSheet(workbook.sheets[0]!, 2), 'Retired from service')
    expect(removed.sheets[0]?.cells['2:1']).toBe('SJT #2')
    expect(removed.sheets[0]?.cells['2:0']).toBe('1')
  })

  it('appends equipment changes without removing earlier audit events', () => {
    localStorage.removeItem('gxp.vmp.equipment-audit.v1')
    setEquipmentAuditActor({ id: 'user-1', name: 'Carlo Lidres' })
    const record = equipmentRecordFromSheet(buildEquipmentMasterlist().sheets[0]!, 2)
    logEquipmentRecord(null, { ...record, sourceNo: '' })
    logEquipmentRecord(record, { ...record, section: 'Cubicle 2' })
    logEquipmentDeletion(record, 'Retired from service')
    const events = listEquipmentAuditEvents()
    expect(events[0]?.description).toContain('Reason: Retired from service')
    expect(events.some((event) => event.field_name === 'Section' && event.new_value === 'Cubicle 2')).toBe(true)
    expect(events.some((event) => event.action_type === 'created' && event.field_name === 'Equipment')).toBe(true)
    expect(events.length).toBeGreaterThan(2)
  })

  it('round-trips workbook values through an Excel file', async () => {
    const workbook = createWorkbook()
    const sheet = createSheet('Liquids Manufacturing', 20, 9)
    sheet.cells['0:1'] = 'SJT #1'
    workbook.sheets = [sheet]
    workbook.activeSheetId = sheet.id
    const file = await workbookToXlsx(workbook)
    const opened = await xlsxToWorkbook(file.buffer as ArrayBuffer)
    expect(opened.sheets[0]?.name).toBe('Liquids Manufacturing')
    expect(opened.sheets[0]?.cells['0:1']).toBe('SJT #1')
  })
})
