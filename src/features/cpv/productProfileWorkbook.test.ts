import { describe, expect, it } from 'vitest'

import { createWorkbook, setCellValue } from '../vmp/equipmentWorkbook'
import { matchProductProfile, productProfilePath } from './productProfile'
import { loadProductSectionWorkbook, saveProductSectionWorkbook } from './productProfileWorkbook'

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
})
