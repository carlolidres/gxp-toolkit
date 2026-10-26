import { describe, expect, it, vi } from 'vitest'

import { buildDatabaseRows } from '../apqr/apqrService'
import { createWorkbook, displayCell, setCellValue } from '../vmp/equipmentWorkbook'
import { matchProductProfile, productProfilePath } from './productProfile'
import { loadProductSectionWorkbook, saveProductSectionWorkbook } from './productProfileWorkbook'
import { fixtureWorkbook, SPREADSHEET_FIXTURE_CODE } from './spreadsheetTestFixture'

describe('product profile', () => {
  it('keeps the product id in the section path', () => {
    expect(productProfilePath('ABES', 'stability')).toBe('/cpv/products/ABES/profile/stability')
    expect(matchProductProfile('/cpv/products/ABES/profile/stability')).toEqual({
      productCode: 'ABES',
      section: 'stability',
    })
  })

  it('stores each product section separately', () => {
    localStorage.clear()
    const workbook = createWorkbook()
    workbook.sheets[0] = setCellValue(workbook.sheets[0], 0, 0, 'RM')
    saveProductSectionWorkbook('prod-1', 'raw-material', workbook)
    expect(loadProductSectionWorkbook('prod-1', 'stability').sheets[0].cells['0:0']).toBeUndefined()
    expect(loadProductSectionWorkbook('prod-1', 'raw-material').sheets[0].cells['0:0']).toBe('RM')
    expect(loadProductSectionWorkbook('prod-2', 'raw-material').sheets[0].cells['0:0']).toBeUndefined()
  })

  it('keeps the unsaved section when browser storage rejects the write', () => {
    localStorage.clear()
    const workbook = createWorkbook()
    workbook.sheets[0] = setCellValue(workbook.sheets[0], 0, 0, 'RM')
    saveProductSectionWorkbook('prod-1', 'raw-material', workbook)
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    try {
      const next = createWorkbook()
      next.sheets[0] = setCellValue(next.sheets[0], 0, 0, 'NEW')
      expect(() => saveProductSectionWorkbook('prod-1', 'raw-material', next)).toThrow()
      expect(loadProductSectionWorkbook('prod-1', 'raw-material').sheets[0].cells['0:0']).toBe('NEW')
      expect(loadProductSectionWorkbook('prod-1', 'stability').sheets[0].cells['0:0']).toBeUndefined()
      setItem.mockRestore()
      saveProductSectionWorkbook('prod-1', 'raw-material', next)
      expect(loadProductSectionWorkbook('prod-1', 'raw-material').sheets[0].cells['0:0']).toBe('NEW')
    } finally {
      setItem.mockRestore()
    }
  })

  it('keeps the spreadsheet fixture out of the catalog and stored products', () => {
    localStorage.clear()
    expect(buildDatabaseRows().some((row) => row.product_code === SPREADSHEET_FIXTURE_CODE)).toBe(false)
    expect(loadProductSectionWorkbook(SPREADSHEET_FIXTURE_CODE, 'raw-material').sheets[0].cells['0:0']).toBeUndefined()
    const book = fixtureWorkbook('small')
    expect(displayCell(book.sheets[0], 2, 0)).toBe('5')
    expect(book.sheets.map((sheet) => sheet.name)).toEqual(['Data', 'Notes'])
    expect(Object.keys(fixtureWorkbook('medium').sheets[0].cells)).toHaveLength(503)
    expect(Object.keys(fixtureWorkbook('large').sheets[0].cells)).toHaveLength(5003)
  })
})
