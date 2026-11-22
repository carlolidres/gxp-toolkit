import { beforeEach, describe, expect, it } from 'vitest'

import { addStabilityParameterSheet, addStabilityTimepoint, commitProfileBatch, commitStabilityStudy, emptyStabilityStudy, loadProductSectionWorkbook, readStabilityStudy, saveProductSectionWorkbook, setStabilityParameter, type ProfileBatchEntry } from './productProfileWorkbook'

const batch: ProfileBatchEntry = {
  uniqueBatchNo: '',
  moControlNo: '',
  poControlNo: '',
  productCode: '',
  sku: '',
  mfgDate: '',
  expDate: '',
  fgReleasedDate: '',
}

describe('stability sheet', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps study columns independent of raw-material batches and names the sheet from the parameter', () => {
    let book = loadProductSectionWorkbook('DQIE', 'raw-material')
    book = commitProfileBatch(book, { ...batch, uniqueBatchNo: '2025DQIE-2', moControlNo: '25DQIEP-2', poControlNo: '25DQIEP-2' }, null)
    book = commitProfileBatch(book, { ...batch, uniqueBatchNo: '2025DQIE-3', moControlNo: '25DQIE-3', poControlNo: '25DQIEP-3' }, null)
    saveProductSectionWorkbook('DQIE', 'raw-material', book)

    const loaded = loadProductSectionWorkbook('DQIE', 'stability')
    const sheet = loaded.sheets[0]
    expect(sheet.name).toBe('Parameter')
    expect(sheet.cells['0:0']).toBe('Test Points')
    expect(sheet.cells['0:1']).toBe('Parameter')
    expect(sheet.cells['1:1']).toBeUndefined()
    expect(sheet.cells['2:0']).toBe('Initial')
    expect(Object.values(sheet.cells)).not.toContain('25DQIEP-2')
    expect(Object.values(sheet.cells)).not.toContain('Item Code')

    const study = commitStabilityStudy(sheet, null, {
      ...emptyStabilityStudy(),
      genericName: 'Dequalinium',
      uniqueBatchNo: 'UB-9',
      moControlNo: 'MO-9',
      poControlNo: 'PO-9',
    })
    expect(study.cells['1:1']).toBe('PO-9')
    expect(study.cells['1:1']).not.toBe('MO-9')
    expect(readStabilityStudy(study, 1)?.uniqueBatchNo).toBe('UB-9')
    expect(readStabilityStudy(study, 1)?.moControlNo).toBe('MO-9')
    expect(() => commitStabilityStudy(study, null, { ...emptyStabilityStudy(), poControlNo: 'po-9' })).toThrow(/already/)
    expect(() => commitStabilityStudy(study, null, emptyStabilityStudy())).toThrow(/PO Control/)

    const named = setStabilityParameter({ ...loaded, sheets: [study] }, study.id, 'MOISTURE CONTENT', '%')
    expect(named.sheets[0].name).toBe('MOISTURE CONTENT (%)')
    expect(named.sheets[0].cells['0:1']).toBe('MOISTURE CONTENT (%)')

    const added = addStabilityParameterSheet(named, 'ASSAY', 'mg')
    const created = added.sheets.find((item) => item.id === added.activeSheetId)
    expect(created?.name).toBe('ASSAY (mg)')
    expect(created?.cells['0:1']).toBe('ASSAY (mg)')
    expect(created?.cells['2:0']).toBe('Initial')

    const timed = addStabilityTimepoint(study, 6)
    expect(timed.cells['3:0']).toBe('6 Months')
    expect(addStabilityTimepoint(timed, 1).cells['4:0']).toBe('1 Month')
    expect(() => addStabilityTimepoint(timed, 6)).toThrow(/already/)
  })

  it('opens holding time, other data, deviations, and complaints as a blank sheet', () => {
    for (const section of ['holding-time', 'other-data', 'deviation-report', 'product-complaints']) {
      const sheet = loadProductSectionWorkbook('DQIE', section).sheets[0]
      expect(sheet.cells['0:0']).toBeUndefined()
      expect(sheet.cells['0:1']).toBeUndefined()
      expect(Object.values(sheet.cells)).not.toContain('DESCRIPTION')
      expect(Object.values(sheet.cells)).not.toContain('Item Code')
    }
  })
})
