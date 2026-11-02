import { describe, expect, it, vi } from 'vitest'

import { buildDatabaseRows } from '../apqr/apqrService'
import { axisSize, createWorkbook, DEFAULT_ROW_HEIGHT, displayCell, setCellValue, sheetNameError } from '../vmp/equipmentWorkbook'
import { matchProductProfile, productProfilePath, EQUIPMENT_PROCESS_FORMS, equipmentSheetName } from './productProfile'
import { addEquipmentBreakerRow, addEquipmentEntryRow, addProfileBatch, addProfileMaterial, applyEquipmentProcess, applyIpcDecimals, commitProfileBatch, equipmentColumnBatch, equipmentSourceBatches, addIpcChartSheet, addIpcSeriesColumn, attachIpcRunChart, ipcParameters, ipcResultText, ipcNelsonSignals, ipcRowHeaderLabel, ipcRunChart, ipcRunObservation, isEquipmentBreakerRow, loadProductSectionWorkbook, markEquipmentBatch, markProfileItemNotApplicable, packagingColumnBatch, profileGridLimits, profileSuppliers, removeProfileMaterial, removeProfileSupplier, refreshIpcWorkbook, restoreProfileItemCode, saveProductSectionWorkbook, syncEquipmentProfiles, writeEquipmentName, writeIpcParameter, writeProfileBatch, writeProfileControlNos, writeProfileEquipmentCell, writeProfileHeader, writeProfilePackaging, markPackagingItemNotApplicable, restorePackagingItem, writePackagingControlNos, saveRawProfileBatch, refreshPackagingSheet } from './productProfileWorkbook'
import { fixtureWorkbook, SPREADSHEET_FIXTURE_CODE } from './spreadsheetTestFixture'

describe('product profile', () => {
  it('keeps the product id in the section path', () => {
    expect(productProfilePath('ABES', 'stability')).toBe('/cpv/products/ABES/profile/stability')
    expect(productProfilePath('DQIE', 'equipment')).toBe('/cpv/products/DQIE/profile/equipment')
    localStorage.clear()
    const equipment = loadProductSectionWorkbook('DQIE', 'equipment').sheets[0]
    expect(equipment.cells['0:0']).toBe('UNIQUE BATCH NO.')
    expect(equipment.cells['1:0']).toBe('CONTROL NO.')
    expect(equipment.cells['2:0']).toBe('ROOM / LINE')
    expect(equipment.cells['3:0']).toBe('EQUIPMENT')
    expect(equipment.cells['0:1']).toBeUndefined()
    expect(equipment.cells['1:1']).toBeUndefined()
    expect(equipment.merges ?? []).toEqual([])
    expect(equipment.styles['0:0']).toMatchObject({ bold: true, align: 'center' })
    expect(equipment.styles['0:1']).toMatchObject({ bold: true, align: 'center' })
    expect(equipment.styles['1:1']).toMatchObject({ bold: true, align: 'center' })
    expect(equipment.styles['2:1']).toMatchObject({ align: 'center', bold: false })
    expect(equipment.styles['3:1']).toMatchObject({ bold: true, align: 'left' })
    expect(equipment.styles['4:0']).toMatchObject({ bold: true, align: 'center' })
    expect(equipment.styles['4:1']).toMatchObject({ align: 'center', bold: false })
    expect(equipment.styles['3:1']).toMatchObject({ borderTop: true, borderRight: true, borderBottom: true, borderLeft: true })
    const wide = { ...equipment, cells: { ...equipment.cells, '0:2': 'BATCH' } }
    const breaker = addEquipmentBreakerRow(wide)
    expect(isEquipmentBreakerRow(breaker, 5)).toBe(true)
    expect(breaker.styles['5:0']).toMatchObject({ bold: true, align: 'left' })
    expect(breaker.styles['5:1']).toMatchObject({ bold: true, align: 'left' })
    expect(breaker.merges).toContainEqual({ r1: 5, c1: 1, r2: 5, c2: 2 })
    expect(breaker.merges?.some((merge) => merge.r1 === 5 && merge.c1 === 0)).toBe(false)
    const named = writeEquipmentName(equipment, 4, 'Fluidized Bed Dryer #1-WSG- 120CD (IL-0181)')
    expect(named.cells['2:1']).toBeUndefined()
    expect(named.columnWidths[0]).toBeGreaterThan(168)
    expect(named.styles['4:0']).toMatchObject({ bold: true, align: 'center' })
    const used = markEquipmentBatch(named, 4, 1, true)
    expect(used.cells['4:1']).toBe('Fluidized Bed Dryer #1-WSG- 120CD (IL-0181)')
    expect(used.cells['2:1']).toBe('Gran')
    expect(used.styles['4:1']).toMatchObject({ align: 'center', bold: false })
    const unused = markEquipmentBatch(named, 4, 1, false)
    expect(unused.cells['4:1']).toBeUndefined()
    expect(unused.cells['2:1']).toBeUndefined()
    expect(unused.styles['4:1']?.fill).toBe('#c5c8ce')
    saveProductSectionWorkbook('ZZ-SYNC', 'equipment', { sheets: [used], activeSheetId: used.id })
    syncEquipmentProfiles('Fluidized Bed Dryer #1-WSG- 120CD (IL-0181)', 'Dryer Renamed (IL-0181)')
    const synced = loadProductSectionWorkbook('ZZ-SYNC', 'equipment').sheets[0]
    expect(synced.cells['4:0']).toBe('Dryer Renamed (IL-0181)')
    expect(synced.cells['4:1']).toBe('Dryer Renamed (IL-0181)')
    const stored = JSON.parse(localStorage.getItem('gxp.cpv.product-profile.v1') ?? '{}') as Record<string, unknown>
    delete stored['ZZ-SYNC:equipment']
    localStorage.setItem('gxp.cpv.product-profile.v1', JSON.stringify(stored))
    expect(profileGridLimits(equipment)).toEqual({ rows: 5, columns: 2 })
    expect(equipment.columnWidths[0]).toBe(168)
    const book = createWorkbook()
    const steps = EQUIPMENT_PROCESS_FORMS.flatMap((item) => [...item.steps])
    expect(EQUIPMENT_PROCESS_FORMS.map((item) => item.form)).toEqual([
      'Dry Products',
      'Liquid Product',
      'Softgel',
      'Creams and Ointment, Cosmetics, Topicals',
    ])
    for (const step of steps) expect(sheetNameError(book, '', equipmentSheetName(step))).toBeNull()
    expect(equipmentSheetName('Filling/Packaging')).toBe('Filling-Packaging')
    expect(matchProductProfile('/cpv/products/ABES/profile/stability')).toEqual({
      productCode: 'ABES',
      section: 'stability',
    })
  })

  it('stores each product section separately', () => {
    localStorage.clear()
    const workbook = createWorkbook()
    workbook.sheets[0] = setCellValue(workbook.sheets[0], 3, 0, 'RM')
    saveProductSectionWorkbook('prod-1', 'raw-material', workbook)
    expect(loadProductSectionWorkbook('prod-1', 'stability').sheets[0].cells['3:0']).toBeUndefined()
    expect(loadProductSectionWorkbook('prod-1', 'raw-material').sheets[0].cells['3:0']).toBe('RM')
    expect(loadProductSectionWorkbook('prod-2', 'raw-material').sheets[0].cells['3:0']).toBeUndefined()
  })

  it('keeps the unsaved section when browser storage rejects the write', () => {
    localStorage.clear()
    const workbook = createWorkbook()
    workbook.sheets[0] = setCellValue(workbook.sheets[0], 3, 0, 'RM')
    saveProductSectionWorkbook('prod-1', 'raw-material', workbook)
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    try {
      const next = createWorkbook()
      next.sheets[0] = setCellValue(next.sheets[0], 3, 0, 'NEW')
      expect(() => saveProductSectionWorkbook('prod-1', 'raw-material', next)).toThrow()
      expect(loadProductSectionWorkbook('prod-1', 'raw-material').sheets[0].cells['3:0']).toBe('NEW')
      expect(loadProductSectionWorkbook('prod-1', 'stability').sheets[0].cells['3:0']).toBeUndefined()
      setItem.mockRestore()
      saveProductSectionWorkbook('prod-1', 'raw-material', next)
      expect(loadProductSectionWorkbook('prod-1', 'raw-material').sheets[0].cells['3:0']).toBe('NEW')
    } finally {
      setItem.mockRestore()
    }
  })

  it('keeps the spreadsheet fixture out of the catalog and stored products', () => {
    localStorage.clear()
    expect(buildDatabaseRows().some((row) => row.product_code === SPREADSHEET_FIXTURE_CODE)).toBe(false)
    const opened = loadProductSectionWorkbook(SPREADSHEET_FIXTURE_CODE, 'raw-material').sheets[0]
    expect(opened.cells['0:0']).toBe('Unique Batch\nNo.')
    expect(opened.cells['0:1']).toBe('DESCRIPTION')
    expect(opened.cells['1:1']).toBe('Item Code')
    expect(opened.cells['1:2']).toBe('Control No.')
    expect(opened.cells['1:0']).toBeUndefined()
    expect(opened.cells['0:2']).toBeUndefined()
    expect(opened.styles['0:0']).toMatchObject({ align: 'center', valign: 'middle', wrap: true, bold: true, borderTop: true, borderRight: true, borderBottom: true, borderLeft: true })
    expect(opened.styles['0:1']).toMatchObject({ bold: true })
    expect(opened.styles['1:1']).toMatchObject({ bold: true, align: 'center' })
    expect(opened.styles['1:2']).toMatchObject({ bold: true, align: 'center' })
    expect(profileGridLimits(opened)).toEqual({ rows: 3, columns: 3 })
    expect(opened.merges).toEqual(expect.arrayContaining([
      { r1: 0, c1: 0, r2: 1, c2: 0 },
      { r1: 0, c1: 1, r2: 0, c2: 2 },
    ]))
    expect(loadProductSectionWorkbook('ABES', 'stability').sheets[0].cells['0:1']).toBe('DESCRIPTION')
    const book = fixtureWorkbook('small')
    expect(displayCell(book.sheets[0], 2, 0)).toBe('5')
    expect(book.sheets.map((sheet) => sheet.name)).toEqual(['Data', 'Notes'])
    expect(Object.keys(fixtureWorkbook('medium').sheets[0].cells)).toHaveLength(503)
    expect(Object.keys(fixtureWorkbook('large').sheets[0].cells)).toHaveLength(5003)
  })

  it('adds a batch number and a material group without showing the extra fields', () => {
    localStorage.clear()
    const header = loadProductSectionWorkbook('ABES', 'raw-material').sheets[0]
    expect(profileGridLimits({ ...header, cells: { ...header.cells, '4:3': 'stray' } })).toEqual({ rows: 3, columns: 3 })
    const batch = addProfileBatch(header, {
      uniqueBatchNo: 'B-1',
      moControlNo: 'MO-9',
      poControlNo: 'PO-2',
      productCode: '',
      sku: '',
      mfgDate: '2026-01',
      expDate: '2028-01',
      fgReleasedDate: '2026-02-14',
    })
    const updated = writeProfileBatch(batch, 2, {
      uniqueBatchNo: 'B-9',
      moControlNo: 'MO-1',
      poControlNo: 'PO-2',
      productCode: 'PC-1',
      sku: 'SKU-1',
      mfgDate: '2026-01',
      expDate: '2028-01',
      fgReleasedDate: '2026-02-14',
    })
    expect(updated.cells['2:0']).toBe('B-9')
    expect(updated.cells['3:0']).toBeUndefined()
    expect(JSON.parse(updated.snippets['profile-batch:2']).moControlNo).toBe('MO-1')
    expect(JSON.parse(updated.snippets['profile-batch:2']).productCode).toBe('PC-1')
    expect(JSON.parse(updated.snippets['profile-batch:2']).sku).toBe('SKU-1')
    expect(batch.cells['2:0']).toBe('B-1')
    expect(JSON.parse(batch.snippets['profile-batch:2']).poControlNo).toBe('PO-2')
    const nextBatch = addProfileBatch(batch, {
      uniqueBatchNo: 'B-2',
      moControlNo: '',
      poControlNo: '',
      productCode: '',
      sku: '',
      mfgDate: '',
      expDate: '',
      fgReleasedDate: '',
    })
    expect(nextBatch.cells['3:0']).toBe('B-2')
    expect(profileGridLimits(nextBatch)).toEqual({ rows: 4, columns: 3 })
    const coded = writeProfileHeader(nextBatch, {
      description: 'water purified',
      supplierName: '',
      supplierAddress: '',
      itemCode: '00188835',
      controlNos: [],
    })
    expect(coded.cells['2:1']).toBe('00188835')
    expect(coded.cells['3:1']).toBe('00188835')
    const third = addProfileBatch(coded, {
      uniqueBatchNo: 'B-3',
      moControlNo: '',
      poControlNo: '',
      productCode: '',
      sku: '',
      mfgDate: '',
      expDate: '',
      fgReleasedDate: '',
    })
    expect(third.cells['4:1']).toBe('00188835')
    expect(third.styles['4:1']).toMatchObject({ align: 'center' })
    const controls = writeProfileControlNos(header, 2, ['CN-1', ' CN-2 ', ''])
    expect(controls.cells['2:2']).toBe('CN-1\nCN-2')
    expect(controls.rowHeights[2]).toBe(48)
    expect(controls.styles['2:2']).toMatchObject({ wrap: true, valign: 'top' })
    expect(writeProfileControlNos(controls, 2, []).cells['2:2']).toBeUndefined()
    expect(writeProfileControlNos(controls, 2, []).rowHeights[2]).toBe(24)
    expect(() => addProfileBatch(header, {
      uniqueBatchNo: ' ',
      moControlNo: '',
      poControlNo: '',
      productCode: '',
      sku: '',
      mfgDate: '',
      expDate: '',
      fgReleasedDate: '',
    })).toThrow('Unique Batch No. is required.')
    const material = addProfileMaterial(header, {
      description: 'lactose',
      supplierName: 'Acme',
      supplierAddress: 'Manila',
      itemCode: 'IC1',
      controlNos: ['C1', ' C2 ', ''],
    })
    expect(material.cells['0:3']).toBe('LACTOSE')
    expect(material.cells['1:3']).toBe('Item Code')
    expect(material.cells['1:4']).toBe('Control No.')
    expect(material.styles['0:3']).toMatchObject({ bold: true, borderTop: true, borderLeft: true })
    const batched = addProfileBatch(material, {
      uniqueBatchNo: 'B-M',
      moControlNo: '',
      poControlNo: '',
      productCode: '',
      sku: '',
      mfgDate: '',
      expDate: '',
      fgReleasedDate: '',
    })
    expect(batched.cells['2:3']).toBe('IC1')
    expect(batched.styles['2:3']).toMatchObject({ borderTop: true, borderRight: true, borderBottom: true, borderLeft: true })
    expect(material.notes['0:3']).toBe('Acme\nManila')
    expect(profileGridLimits(material)).toEqual({ rows: 3, columns: 5 })
    const second = addProfileMaterial(material, {
      description: 'starch',
      supplierName: '',
      supplierAddress: '',
      itemCode: '',
      controlNos: [],
    })
    expect(second.cells['0:5']).toBe('STARCH')
    const removed = removeProfileMaterial(second, 3)
    expect(removed.cells['0:3']).toBe('STARCH')
    expect(removed.cells['0:5']).toBeUndefined()
    expect(removed.cells['0:0']).toBe('Unique Batch\nNo.')
    expect(profileGridLimits(removed)).toEqual({ rows: 3, columns: 5 })
    const cleared = removeProfileMaterial(removed, 3)
    expect(cleared.cells['0:3']).toBeUndefined()
    expect(profileGridLimits(cleared)).toEqual({ rows: 3, columns: 3 })
    expect(() => removeProfileMaterial(cleared, 3)).toThrow('Choose a material column set.')
    expect(() => addProfileMaterial(header, {
      description: ' ',
      supplierName: '',
      supplierAddress: '',
      itemCode: '',
      controlNos: [],
    })).toThrow('Material Description is required.')
    const written = writeProfileHeader(header, {
      description: 'water purified',
      supplierName: 'Acme',
      supplierAddress: 'Manila',
      itemCode: 'WP-1',
      controlNos: ['ignored'],
    })
    expect(written.cells['0:1']).toBe('WATER PURIFIED')
    expect(written.cells['2:1']).toBe('WP-1')
    expect(written.cells['0:3']).toBeUndefined()
    expect(written.notes['0:1']).toBe('Acme\nManila')
    expect(profileSuppliers(written)).toEqual([{ name: 'Acme', address: 'Manila' }])
    expect(profileGridLimits(written)).toEqual({ rows: 3, columns: 3 })
    const book = loadProductSectionWorkbook('ABES', 'raw-material')
    book.sheets[0] = written
    saveProductSectionWorkbook('ABES', 'raw-material', book)
    const reloaded = loadProductSectionWorkbook('ABES', 'raw-material').sheets[0]
    expect(reloaded.cells['0:1']).toBe('WATER PURIFIED')
    expect(reloaded.cells['2:1']).toBe('WP-1')
    expect(profileGridLimits(reloaded)).toEqual({ rows: 3, columns: 3 })
  })

  it('grays a not-applicable item code and repeats it on the next batch row', () => {
    localStorage.clear()
    const blank = {
      uniqueBatchNo: 'B1',
      moControlNo: '',
      poControlNo: '',
      productCode: '',
      sku: '',
      mfgDate: '',
      expDate: '',
      fgReleasedDate: '',
    }
    const header = writeProfileHeader(loadProductSectionWorkbook('NA', 'raw-material').sheets[0], {
      description: 'water',
      supplierName: 'Acme',
      supplierAddress: 'Manila',
      itemCode: '00188835',
      controlNos: [],
    })
    const first = addProfileBatch(header, blank)
    const withControls = writeProfileControlNos(first, 2, ['CN-1', 'CN-2'], 2)
    expect(axisSize(withControls.rowHeights, withControls.rowSizes, 2, DEFAULT_ROW_HEIGHT)).toBe(48)
    const marked = markProfileItemNotApplicable(withControls, 2, 1)
    expect(marked.cells['2:1']).toBeUndefined()
    expect(marked.cells['2:2']).toBeUndefined()
    expect(marked.styles['2:1']?.fill).toBe('#c5c8ce')
    expect(marked.styles['2:2']?.fill).toBe('#c5c8ce')
    expect(axisSize(marked.rowHeights, marked.rowSizes, 2, DEFAULT_ROW_HEIGHT)).toBe(24)
    const material = addProfileMaterial(marked, {
      description: 'starch',
      supplierName: 'Beta',
      supplierAddress: 'Cebu',
      itemCode: '00188839',
      controlNos: [],
    })
    const markedMaterial = markProfileItemNotApplicable(material, 2, 3)
    expect(markedMaterial.cells['2:3']).toBeUndefined()
    expect(markedMaterial.styles['2:4']?.fill).toBe('#c5c8ce')
    const next = addProfileBatch(markedMaterial, { ...blank, uniqueBatchNo: 'B2' })
    expect(next.cells['3:0']).toBe('B2')
    expect(next.cells['3:1']).toBeUndefined()
    expect(next.cells['3:2']).toBeUndefined()
    expect(next.cells['3:3']).toBeUndefined()
    expect(next.cells['3:4']).toBeUndefined()
    expect(next.styles['3:1']?.fill).toBe('#c5c8ce')
    expect(next.styles['3:3']?.fill).toBe('#c5c8ce')
    expect(next.styles['3:4']?.fill).toBe('#c5c8ce')
    const restored = restoreProfileItemCode(marked, 2, 1)
    expect(restored.cells['2:1']).toBe('00188835')
    expect(restored.styles['2:1']?.fill).toBeUndefined()
    expect(restored.styles['2:2']?.fill).toBeUndefined()
    const hidden = removeProfileSupplier(header, 'Acme')
    expect(profileSuppliers(hidden)).toEqual([])
    const shown = writeProfileHeader(hidden, {
      description: 'water',
      supplierName: 'Acme',
      supplierAddress: 'Manila',
      itemCode: '00188835',
      controlNos: [],
    })
    expect(profileSuppliers(shown)).toEqual([{ name: 'Acme', address: 'Manila' }])
    const kept = writeProfileHeader(marked, {
      description: 'water',
      supplierName: 'Acme',
      supplierAddress: 'Manila',
      itemCode: '00999999',
      controlNos: [],
    })
    expect(kept.cells['2:1']).toBeUndefined()
    expect(kept.styles['2:1']?.fill).toBe('#c5c8ce')
  })

  it('opens packaging material with its own header', () => {
    localStorage.clear()
    const sheet = loadProductSectionWorkbook('DQIE', 'packaging-material').sheets[0]
    expect(sheet.cells['0:0']).toBe('Unique Batch No.')
    expect(sheet.cells['1:0']).toBe('Control No.')
    expect(sheet.cells['2:0']).toBe('Product Code')
    expect(sheet.cells['3:0']).toBe('Packaging Material Name')
    expect(sheet.cells['3:1']).toBe('Item No.')
    expect(sheet.cells['3:2']).toBe('Control No.')
    expect(sheet.cells['0:1']).toBeUndefined()
    expect(sheet.cells['0:2']).toBeUndefined()
    expect(sheet.cells['1:1']).toBeUndefined()
    expect(sheet.cells['2:1']).toBeUndefined()
    expect(sheet.cells['2:2']).toBeUndefined()
    expect(sheet.merges).toEqual([
      { r1: 0, c1: 1, r2: 0, c2: 2 },
      { r1: 1, c1: 1, r2: 1, c2: 2 },
      { r1: 2, c1: 1, r2: 2, c2: 2 },
    ])
    expect(sheet.styles['0:1']).toMatchObject({ borderTop: true, borderRight: true, borderBottom: true, borderLeft: true })
    expect(sheet.styles['2:2']).toMatchObject({ borderTop: true, borderRight: true })
    expect(sheet.styles['0:0']).toMatchObject({ bold: true, align: 'center', borderTop: true, borderLeft: true })
    expect(sheet.styles['3:1']).toMatchObject({ bold: true, align: 'center' })
    expect(sheet.columnWidths[0]).toBe(280)
    expect(profileGridLimits(sheet)).toEqual({ rows: 4, columns: 3 })
    expect(loadProductSectionWorkbook('DQIE', 'raw-material').sheets[0].cells['0:1']).toBe('DESCRIPTION')
  })

  it('opens in-process control with the parameter header', () => {
    localStorage.clear()
    const raw = commitProfileBatch(loadProductSectionWorkbook('DQIE', 'raw-material'), {
      uniqueBatchNo: '2025DQIE-2',
      moControlNo: '25MDW-209',
      poControlNo: '25DQIEP-2',
      productCode: '',
      sku: '33900302',
      mfgDate: '',
      expDate: '',
      fgReleasedDate: '',
    }, null)
    saveProductSectionWorkbook('DQIE', 'raw-material', raw)
    const sheet = loadProductSectionWorkbook('DQIE', 'in-process-control').sheets[0]
    expect(sheet.cells['0:0']).toBe('UNIQUE BATCH NO.')
    expect(sheet.cells['0:1']).toBe('CONTROL NO.')
    expect(sheet.cells['0:2']).toBeUndefined()
    expect(sheet.cells['4:2']).toBeUndefined()
    const named = writeIpcParameter(sheet, 2, ['Granulation', 'Moisture Content', 'NMT 1.0%', 'Step 5.3 – Drying', '%'])
    expect(named.cells['0:2']).toBe('Granulation')
    expect(named.cells['4:2']).toBe('%')
    expect(sheet.cells['1:1']).toBeUndefined()
    expect(sheet.merges).toEqual([
      { r1: 0, c1: 0, r2: 4, c2: 0 },
      { r1: 0, c1: 1, r2: 4, c2: 1 },
    ])
    expect(sheet.cells['5:0']).toBe('2025DQIE-2')
    expect(sheet.cells['5:1']).toBe('25MDW-209')
    expect(sheet.freezeCols).toBe(1)
    expect(sheet.cells['5:2']).toBeUndefined()
    expect(sheet.styles['0:0']).toMatchObject({ bold: true, align: 'center' })
    expect(sheet.styles['5:0']).toMatchObject({ bold: true, align: 'center' })
    expect(sheet.styles['0:2']).toMatchObject({ align: 'center', bold: true })
    expect(sheet.styles['1:2']).toMatchObject({ align: 'center', bold: true })
    expect(sheet.styles['2:2']).toMatchObject({ align: 'center', bold: false })
    expect(sheet.styles['3:2']).toMatchObject({ align: 'center', bold: true })
    expect(sheet.styles['4:2']).toMatchObject({ align: 'center', bold: false })
    expect(sheet.styles['5:2']).toMatchObject({ align: 'center', bold: false })
    expect(ipcRowHeaderLabel(0)).toBe('')
    expect(ipcRowHeaderLabel(4)).toBe('')
    expect(ipcRowHeaderLabel(5)).toBe('1')
    expect(ipcRowHeaderLabel(7)).toBe('3')
    const fitted = writeIpcParameter(sheet, 2, ['GRANULATION', 'MOISTURE CONTENT (Before Sizing)', 'Informative', 'Gran I', '%'])
    expect(fitted.columnWidths[2]).toBeGreaterThan(240)
    const edited = {
      ...named,
      cells: { ...named.cells, '5:2': '0.2', '6:0': '2025DQIE-3' },
    }
    saveProductSectionWorkbook('DQIE', 'in-process-control', { ...raw, sheets: [edited], activeSheetId: edited.id })
    const kept = loadProductSectionWorkbook('DQIE', 'in-process-control').sheets[0]
    expect(kept.name).toBe('Moisture Content')
    expect(kept.cells['0:2']).toBe('Granulation')
    expect(kept.cells['5:2']).toBe('0.2')
    const places = applyIpcDecimals({ ...kept, cells: { ...kept.cells, '6:0': '2025DQIE-3' } }, 2, 2)
    expect(places.styles['5:2']).toMatchObject({ format: 'number', decimals: 2 })
    expect(places.styles['6:2']).toMatchObject({ format: 'number', decimals: 2 })
    expect(displayCell(places, 5, 2)).toBe('0.20')
    const chart = ipcRunChart({
      ...places,
      cells: { ...places.cells, '5:2': '0.2', '6:0': '2025DQIE-3', '6:2': '0.4' },
    }, 2, 1, 0)
    expect(chart?.title).toBe('Moisture Content')
    expect(chart?.specification).toBe('NMT 1.0%')
    expect(chart?.median).toBe(0.5)
    expect(chart?.batches).toEqual([1, 2])
    expect(chart?.points).toEqual([{ batch: 1, value: 0.2 }, { batch: 2, value: 0.4 }])
    expect(chart!.yMax).toBeGreaterThanOrEqual(1.05)
    expect(chart!.yMin).toBeLessThanOrEqual(chart!.lcl - Math.abs(chart!.lcl) * 0.05 + 1e-6)
    expect(chart!.ucl).toBeGreaterThan(chart!.lcl)
    expect(chart?.series.map((item) => item.name)).toEqual(['Step 5.3 – Drying'])
    const series = addIpcSeriesColumn(fitted)
    expect(series.columnWidths[3]).toBe(series.columnWidths[2])
    expect(series.cells['3:3']).toBeUndefined()
    expect(series.cells['4:3']).toBe('%')
    expect(series.cells['0:3']).toBeUndefined()
    expect(series.merges).toEqual(expect.arrayContaining([
      { r1: 0, c1: 2, r2: 0, c2: 3 },
      { r1: 1, c1: 2, r2: 1, c2: 3 },
      { r1: 2, c1: 2, r2: 2, c2: 3 },
    ]))
    expect(profileGridLimits(series).columns).toBe(4)
    const refreshed = refreshIpcWorkbook({ ...raw, sheets: [{ ...series, cells: { ...series.cells, '3:3': 'Gran II', '5:3': '0.6' } }], activeSheetId: series.id }, 'DQIE')
    expect(refreshed.sheets[0].cells['0:2']).toBe('GRANULATION')
    expect(refreshed.sheets[0].cells['1:2']).toBe('MOISTURE CONTENT (Before Sizing)')
    expect(refreshed.sheets[0].cells['3:2']).toBe('Gran I')
    expect(refreshed.sheets[0].cells['3:3']).toBe('Gran II')
    expect(refreshed.sheets[0].columnWidths[3]).toBe(refreshed.sheets[0].columnWidths[2])
    expect(refreshed.sheets[0].merges).toEqual(expect.arrayContaining([
      { r1: 0, c1: 2, r2: 0, c2: 3 },
      { r1: 1, c1: 2, r2: 1, c2: 3 },
      { r1: 2, c1: 2, r2: 2, c2: 3 },
    ]))
    const compared = ipcRunChart(refreshed.sheets[0], 2, 1, 0)
    expect(compared?.series.map((item) => item.name)).toEqual(['Gran I', 'Gran II'])
    const extra = addIpcSeriesColumn(refreshed.sheets[0])
    expect(extra.cells['3:4']).toBeUndefined()
    expect(extra.cells['4:4']).toBe('%')
    expect(extra.columnWidths[4]).toBe(extra.columnWidths[2])
    const added = refreshIpcWorkbook({ ...raw, sheets: [{ ...extra, cells: { ...extra.cells, '3:4': 'Gran III' } }], activeSheetId: extra.id }, 'DQIE')
    expect(added.sheets[0].cells['3:4']).toBe('Gran III')
    expect(added.sheets[0].columnWidths[4]).toBe(added.sheets[0].columnWidths[2])
    expect(ipcRunChart(added.sheets[0], 2, 1, 0)?.series.map((item) => item.name)).toEqual(['Gran I', 'Gran II', 'Gran III'])
    const stray = { ...refreshed.sheets[0], cells: { ...refreshed.sheets[0].cells, '1:3': 'LOD' } }
    const single = refreshIpcWorkbook({ ...raw, sheets: [stray], activeSheetId: stray.id }, 'DQIE')
    expect(single.sheets[0].cells['1:2']).toBe('MOISTURE CONTENT (Before Sizing)')
    expect(single.sheets[0].cells['1:3']).toBeUndefined()
    expect(single.sheets[0].cells['3:3']).toBe('Gran II')
    expect(ipcParameters(single.sheets[0])).toEqual([{ column: 2, name: 'MOISTURE CONTENT (Before Sizing)', specification: 'Informative' }])
    expect(compared?.series[0].ucl).not.toBe(compared?.series[1].ucl)
    expect(ipcRunChart(refreshed.sheets[0], 2, 1, 0, [3])?.series).toHaveLength(2)
    expect(ipcResultText('abc')).toBeNull()
    expect(ipcResultText('0.2')).toBe('0.2')
    const filling = writeIpcParameter(kept, 2, ['Filling', 'Moisture Content', 'NMT 1.0%', 'Step 5.3 – Drying', '%'])
    saveProductSectionWorkbook('DQIE', 'in-process-control', { ...raw, sheets: [filling], activeSheetId: filling.id })
    expect(loadProductSectionWorkbook('DQIE', 'in-process-control').sheets[0].cells['5:1']).toBe('25DQIEP-2\n33900302')
    expect(loadProductSectionWorkbook('DQIE', 'raw-material').sheets[0].cells['0:1']).toBe('DESCRIPTION')
    const current = loadProductSectionWorkbook('DQIE', 'in-process-control')
    const charted = addIpcChartSheet(current, current.sheets[0].id, 2, 1, 0)
    expect(charted.sheets).toHaveLength(2)
    saveProductSectionWorkbook('DQIE', 'in-process-control', charted)
    const migrated = loadProductSectionWorkbook('DQIE', 'in-process-control')
    expect(migrated.sheets).toHaveLength(1)
    expect(migrated.sheets[0].snippets?.['ipc-run-column']).toBe('2')
    expect(migrated.sheets[0].snippets?.['ipc-run-usl']).toBe('1')
    expect(migrated.sheets[0].snippets?.['ipc-run-lsl']).toBe('0')
    expect(migrated.sheets[0].snippets?.['ipc-chart']).toBeUndefined()
    const attached = attachIpcRunChart(migrated, migrated.sheets[0].id, 2, 1.5, 0.1)
    expect(attached.sheets).toHaveLength(1)
    expect(attached.sheets[0].snippets?.['ipc-run-usl']).toBe('1.5')
    const observed = ipcRunObservation([22, 18, 23, 21, 20, 25, 19, 21])
    expect(observed?.runsAboutMedian).toBe(6)
    expect(observed?.expectedRunsAboutMedian).toBeCloseTo(4.75, 5)
    expect(observed?.longestRunAboutMedian).toBe(2)
    expect(observed?.clusteringP).toBeCloseTo(0.848, 3)
    expect(observed?.mixturesP).toBeCloseTo(0.152, 3)
    expect(observed?.runsUpDown).toBe(6)
    expect(observed?.expectedRunsUpDown).toBeCloseTo(5, 5)
    expect(observed?.longestRunUpDown).toBe(3)
    expect(observed?.trendsP).toBeCloseTo(0.830, 3)
    expect(observed?.oscillationP).toBeCloseTo(0.170, 3)
    expect(ipcNelsonSignals([22, 18, 23, 21, 20, 25, 19, 21])).toEqual([])
    expect(ipcNelsonSignals([1, 1, 1, 1, 1, 1, 1, 5]).map((signal) => signal.test)).toContain(1)
    expect(ipcNelsonSignals([5, 5, 5, 5, 5, 5, 5, 5, 5, 0]).some((signal) => signal.test === 2)).toBe(true)
    expect(ipcNelsonSignals([1, 2, 3, 4, 5, 6]).some((signal) => signal.test === 3)).toBe(true)
  })

  it('copies each raw-material batch into a packaging column pair', () => {
    localStorage.clear()
    const blank = {
      moControlNo: '',
      sku: '',
      mfgDate: '',
      expDate: '',
      fgReleasedDate: '',
    }
    let raw = loadProductSectionWorkbook('DQIE', 'raw-material').sheets[0]
    raw = addProfileBatch(raw, { ...blank, uniqueBatchNo: '2025DQIE-2', poControlNo: '25DQIEP-2', productCode: '33900302' })
    raw = addProfileBatch(raw, { ...blank, uniqueBatchNo: '2025DQIE-3', poControlNo: '25DQIEP-3', productCode: '33900303' })
    const book = loadProductSectionWorkbook('DQIE', 'raw-material')
    book.sheets[0] = raw
    saveProductSectionWorkbook('DQIE', 'raw-material', book)
    const sheet = loadProductSectionWorkbook('DQIE', 'packaging-material').sheets[0]
    expect(sheet.cells['0:1']).toBe('2025DQIE-2')
    expect(sheet.cells['1:1']).toBe('25DQIEP-2')
    expect(sheet.cells['2:1']).toBe('33900302')
    expect(sheet.cells['0:2']).toBeUndefined()
    expect(sheet.cells['0:3']).toBe('2025DQIE-3')
    expect(sheet.cells['1:3']).toBe('25DQIEP-3')
    expect(sheet.cells['2:3']).toBe('33900303')
    expect(sheet.cells['3:3']).toBe('Item No.')
    expect(sheet.cells['3:4']).toBe('Control No.')
    expect(sheet.styles['0:1']).toMatchObject({ align: 'center', bold: true })
    expect(sheet.freezeRows).toBe(4)
    expect(sheet.freezeCols).toBe(1)
    expect(loadProductSectionWorkbook('DQIE', 'raw-material').sheets[0].styles['1:1']).toMatchObject({ bold: true })
    expect(sheet.merges).toEqual(expect.arrayContaining([
      { r1: 0, c1: 1, r2: 0, c2: 2 },
      { r1: 1, c1: 1, r2: 1, c2: 2 },
      { r1: 2, c1: 1, r2: 2, c2: 2 },
      { r1: 0, c1: 3, r2: 0, c2: 4 },
    ]))
    expect(profileGridLimits(sheet)).toEqual({ rows: 4, columns: 5 })
    expect(sheet.cells['0:0']).toBe('Unique Batch No.')
    const written = writeProfilePackaging(sheet, 4, {
      name: 'dequadin 250 mcg loz. orange flavor',
      description: 'printed with dequalinium chloride',
      itemNo: '33900355',
      subItemNo: 'A4390',
      supplierName: 'Inova',
      supplierAddress: 'Philippines',
    })
    expect(written.cells['4:0']).toBe('DEQUADIN 250 MCG LOZ. ORANGE FLAVOR\nPRINTED WITH DEQUALINIUM CHLORIDE')
    expect(written.styles['4:0']).toMatchObject({ bold: true, wrap: true, align: 'center' })
    expect(written.cells['4:1']).toBe('33900355\nA4390')
    expect(written.cells['4:3']).toBe('33900355\nA4390')
    expect(written.cells['4:2']).toBeUndefined()
    expect(written.rowHeights[4]).toBeGreaterThan(24)
    expect(written.notes['4:0']).toBe('Inova\nPhilippines')
    expect(profileGridLimits(written).rows).toBe(5)
    const gray = markPackagingItemNotApplicable(written, 4, 1)
    expect(gray.cells['4:1']).toBeUndefined()
    expect(gray.cells['4:2']).toBeUndefined()
    expect(gray.styles['4:1']?.fill).toBe('#c5c8ce')
    expect(gray.styles['4:2']?.fill).toBe('#c5c8ce')
    expect(gray.cells['4:3']).toBe('33900355\nA4390')
    const restored = restorePackagingItem(gray, 4, 1)
    expect(restored.cells['4:1']).toBe('33900355\nA4390')
    expect(restored.styles['4:1']?.fill).toBeUndefined()
    const numbered = writePackagingControlNos(restored, 4, ['0000122549', '0000122550'], 2)
    expect(numbered.cells['4:2']).toBe('0000122549\n0000122550')
    expect(numbered.rowHeights[4]).toBe(written.rowHeights[4])
    saveRawProfileBatch('DQIE', {
      uniqueBatchNo: '2025DQIE-9',
      moControlNo: '',
      poControlNo: '25DQIEP-9',
      productCode: '33900309',
      sku: '',
      mfgDate: '',
      expDate: '',
      fgReleasedDate: '',
    })
    expect(loadProductSectionWorkbook('DQIE', 'raw-material').sheets[0].cells['4:0']).toBe('2025DQIE-9')
    expect(refreshPackagingSheet(written, 'DQIE').cells['0:5']).toBe('2025DQIE-9')
    expect(refreshPackagingSheet(written, 'DQIE').cells['1:5']).toBe('25DQIEP-9')
    expect(() => writeProfilePackaging(sheet, 4, {
      name: ' ',
      description: '',
      itemNo: '',
      subItemNo: '',
      supplierName: '',
      supplierAddress: '',
    })).toThrow('Packaging Material is required.')
  })

  it('keeps one raw-material row when the same unique batch has another PO and SKU', () => {
    localStorage.clear()
    const blank = {
      moControlNo: '',
      poControlNo: '',
      productCode: '',
      sku: '',
      mfgDate: '',
      expDate: '',
      fgReleasedDate: '',
    }
    let book = loadProductSectionWorkbook('DQIE', 'raw-material')
    book = commitProfileBatch(book, { ...blank, uniqueBatchNo: '2025DQIE-4', poControlNo: '25DQIEP-4', productCode: '33900302', sku: "100's" }, null)
    book = commitProfileBatch(book, { ...blank, uniqueBatchNo: '2025DQIE-4', poControlNo: '25DQIEP-8', productCode: '33900308', sku: "50's" }, null)
    expect(book.sheets[0].cells['2:0']).toBe('2025DQIE-4')
    expect(book.sheets[0].cells['3:0']).toBeUndefined()
    expect(book.sheets.map((item) => item.name)).toEqual(["100's", "50's"])
    expect(JSON.parse(book.sheets[0].snippets['profile-batch:2']).orders).toHaveLength(2)
    saveProductSectionWorkbook('DQIE', 'raw-material', book)
    const packaging = loadProductSectionWorkbook('DQIE', 'packaging-material')
    expect(packaging.sheets.map((item) => item.name)).toEqual(["100's", "50's"])
    expect(packaging.sheets[0].cells['0:1']).toBe('2025DQIE-4')
    expect(packaging.sheets[0].cells['1:1']).toBe('25DQIEP-4')
    expect(packaging.sheets[1].cells['1:1']).toBe('25DQIEP-8')
    expect(packaging.sheets[1].cells['2:1']).toBe('33900308')
  })

  it('fills equipment from the batch and adds a packaging sheet per SKU', () => {
    localStorage.clear()
    const blank = { poControlNo: '', productCode: '', sku: '', mfgDate: '', expDate: '', fgReleasedDate: '' }
    let raw = loadProductSectionWorkbook('DQIE', 'raw-material')
    raw = commitProfileBatch(raw, {
      ...blank,
      uniqueBatchNo: '2025DQIE-4',
      moControlNo: 'MO-4',
      orders: [
        { poControlNo: '25DQIEP-4', productCode: '33900302', sku: "100's" },
        { poControlNo: '25DQIEP-8', productCode: '33900308', sku: "50's" },
      ],
    }, null)
    saveProductSectionWorkbook('DQIE', 'raw-material', raw)
    const batches = equipmentSourceBatches('DQIE')
    const opened = loadProductSectionWorkbook('DQIE', 'equipment')
    const granulation = applyEquipmentProcess(opened, opened.sheets[0].id, 'Granulation', batches)
    expect(granulation.sheets.map((sheet) => sheet.name)).toEqual(['Granulation'])
    expect(granulation.sheets[0].cells['0:1']).toBe('2025DQIE-4')
    expect(granulation.sheets[0].cells['1:1']).toBe('MO-4')
    expect(granulation.sheets[0].cells['2:0']).toBe('ROOM / LINE')
    const blistering = applyEquipmentProcess(opened, opened.sheets[0].id, 'Blistering', batches)
    expect(blistering.sheets.map((sheet) => sheet.name)).toEqual(["Blistering - 100's", "Blistering - 50's"])
    expect(blistering.sheets[0].cells['1:1']).toBe('25DQIEP-4')
    expect(blistering.sheets[0].cells['2:0']).toBe('SKU')
    expect(blistering.sheets[0].cells['2:1']).toBe("100's")
    expect(blistering.sheets[0].cells['3:0']).toBe('ROOM / LINE')
    expect(blistering.sheets[1].cells['1:1']).toBe('25DQIEP-8')
    expect(blistering.sheets[1].cells['2:1']).toBe("50's")
    expect(profileGridLimits(blistering.sheets[0])).toEqual({ rows: 6, columns: 2 })
    expect(equipmentColumnBatch('DQIE', 'Granulation', 1)?.moControlNo).toBe('MO-4')
    expect(packagingColumnBatch('DQIE', "100's", 1)?.poControlNo).toBe('25DQIEP-4')
    const longer = addEquipmentEntryRow(granulation.sheets[0])
    expect(profileGridLimits(longer).rows).toBe(6)
  })

  it('writes a newly registered equipment onto the product profile cell', () => {
    const sheet = loadProductSectionWorkbook('ZZ-REG', 'equipment').sheets[0]
    writeProfileEquipmentCell('ZZ-REG', sheet.id, 4, 0, 'Trial Pump (AUX-9)')
    expect(loadProductSectionWorkbook('ZZ-REG', 'equipment').sheets[0].cells['4:0']).toBe('Trial Pump (AUX-9)')
    const stored = JSON.parse(localStorage.getItem('gxp.cpv.product-profile.v1') ?? '{}') as Record<string, unknown>
    delete stored['ZZ-REG:equipment']
    localStorage.setItem('gxp.cpv.product-profile.v1', JSON.stringify(stored))
  })
})
