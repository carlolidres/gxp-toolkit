import { describe, expect, it } from 'vitest'

import {
  addSheet,
  columnLabel,
  createSheet,
  createWorkbook,
  deleteSheet,
  displayCell,
  insertRow,
  pasteText,
  renameSheet,
  setCellValue,
} from './equipmentWorkbook'
import { loadEquipmentWorkbook, saveEquipmentWorkbook } from './equipmentWorkbookStorage'

describe('equipment workbook', () => {
  it('labels columns the way a spreadsheet does', () => {
    expect(columnLabel(0)).toBe('A')
    expect(columnLabel(25)).toBe('Z')
    expect(columnLabel(26)).toBe('AA')
  })

  it('pastes tab-separated Excel content into a block', () => {
    let sheet = createSheet('Sheet1', 20, 8)
    sheet = pasteText(sheet, 0, 0, 'EQ-01\tBlender\nEQ-02\tMill')
    expect(sheet.cells['0:0']).toBe('EQ-01')
    expect(sheet.cells['0:1']).toBe('Blender')
    expect(sheet.cells['1:0']).toBe('EQ-02')
    expect(sheet.cells['1:1']).toBe('Mill')
  })

  it('shifts cells down when a row is inserted', () => {
    let sheet = setCellValue(createSheet('Sheet1', 20, 8), 0, 0, 'A1')
    sheet = insertRow(sheet, 0)
    expect(sheet.cells['1:0']).toBe('A1')
    expect(sheet.cells['0:0']).toBeUndefined()
  })

  it('evaluates SUM and does not treat a blank addend as text', () => {
    let sheet = createSheet('Sheet1', 20, 8)
    sheet = setCellValue(sheet, 0, 0, '2')
    sheet = setCellValue(sheet, 2, 0, '5')
    sheet = setCellValue(sheet, 3, 0, '=SUM(A1:A3)')
    expect(displayCell(sheet, 3, 0)).toBe('7')
    sheet = setCellValue(sheet, 4, 0, '=A1+A3')
    expect(displayCell(sheet, 4, 0)).toBe('7')
  })

  it('opens a blank workbook when stored JSON is unreadable', () => {
    localStorage.setItem('gxp.vmp.equipment-profile.v1', '{not-json')
    const stored = loadEquipmentWorkbook()
    expect(stored.recovered).toBe(true)
    expect(stored.workbook.sheets[0]?.name).toBe('Sheet1')
    saveEquipmentWorkbook({ workbook: stored.workbook, audit: [] })
    expect(loadEquipmentWorkbook().recovered).toBe(false)
    localStorage.removeItem('gxp.vmp.equipment-profile.v1')
  })

  it('keeps the last worksheet and rejects a duplicate name', () => {
    const workbook = createWorkbook()
    expect(() => deleteSheet(workbook, workbook.sheets[0].id)).toThrow(/at least one/)
    const added = addSheet(workbook, 'Sheet2')
    expect(() => renameSheet(added, added.sheets[1].id, 'Sheet1')).toThrow(/already exists/)
  })
})
