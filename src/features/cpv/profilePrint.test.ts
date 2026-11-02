import { describe, expect, it } from 'vitest'

import { addProfileBatch, addProfileMaterial, loadProductSectionWorkbook, markProfileItemNotApplicable, writeProfileControlNos, writeProfileHeader } from './productProfileWorkbook'
import { batchesInReleaseRange, buildProfilePdf, profilePrintHeading, profilePrintTable, toggleBatchSelection } from './profilePrint'

const batch = {
  moControlNo: '',
  poControlNo: '',
  productCode: '',
  sku: '',
  mfgDate: '',
  expDate: '',
  fgReleasedDate: '',
}

describe('profile print', () => {
  it('fills the report header from the section and product', () => {
    expect(profilePrintHeading({
      section: 'raw-material',
      client: 'Inova Pharmaceuticals (Singapore) Pte Ltd',
      productName: 'Dequadin 250mcg Lozenges Orange (Export)',
      productCode: 'dqie',
    })).toMatchObject({
      appendix: 'APPENDIX 1: RAW MATERIALS TABULATION',
      client: 'INOVA PHARMACEUTICALS (SINGAPORE) PTE LTD',
      productName: 'DEQUADIN 250MCG LOZENGES ORANGE (EXPORT)',
      productCode: 'DQIE',
      groupTitle: 'Raw Materials',
    })
  })

  it('selects batches by released date, and a second tick fills the range', () => {
    const rows = [
      { row: 2, uniqueBatchNo: 'B1', released: '2025-01-01', values: [] },
      { row: 3, uniqueBatchNo: 'B2', released: '2025-06-01', values: [] },
      { row: 4, uniqueBatchNo: 'B3', released: '', values: [] },
      { row: 5, uniqueBatchNo: 'B4', released: '2026-01-01', values: [] },
    ]
    expect(batchesInReleaseRange(rows, '2025-03-01', '2025-12-31')).toEqual([3])
    expect(batchesInReleaseRange(rows, '', '')).toEqual([2, 3, 4, 5])
    const spanned = toggleBatchSelection([2, 3, 4, 5], [2], 5, true)
    expect(spanned).toEqual([2, 3, 4, 5])
    expect(toggleBatchSelection([2, 3, 4, 5], spanned, 3, false)).toEqual([2, 4, 5])
  })

  it('builds a bordered PDF for the chosen batches and leaves not-applicable cells blank', async () => {
    localStorage.clear()
    const header = writeProfileHeader(loadProductSectionWorkbook('DQIE', 'raw-material').sheets[0], {
      description: 'water purified',
      supplierName: 'Acme',
      supplierAddress: 'Manila',
      itemCode: '00188835',
      controlNos: [],
    })
    const first = addProfileBatch(header, { ...batch, uniqueBatchNo: '2025DQIE-2', fgReleasedDate: '2025-02-01' })
    const withControl = writeProfileControlNos(first, 2, ['25MDW-209', '25MDW-210'], 2)
    const second = addProfileBatch(withControl, { ...batch, uniqueBatchNo: '2025DQIE-3', fgReleasedDate: '2025-08-01' })
    const marked = markProfileItemNotApplicable(second, 3, 1)
    const withMaterial = addProfileMaterial(marked, {
      description: 'starch',
      supplierName: '',
      supplierAddress: '',
      itemCode: '00188839',
      controlNos: [],
    })
    const table = profilePrintTable(withMaterial, 'raw-material')
    expect(table.materials).toEqual(['WATER PURIFIED', 'STARCH'])
    expect(table.batches.map((item) => item.uniqueBatchNo)).toEqual(['2025DQIE-2', '2025DQIE-3'])
    expect(table.batches[0].values[0]).toMatchObject({ itemCode: '00188835', controlNo: '25MDW-209\n25MDW-210', gray: false })
    expect(table.batches[1].values[0]).toMatchObject({ itemCode: '', controlNo: '', gray: true })
    expect(table.batches[1].values[1].itemCode).toBe('00188839')
    const bytes = await buildProfilePdf({
      appendix: 'APPENDIX 1: RAW MATERIALS TABULATION',
      client: 'INOVA PHARMACEUTICALS (SINGAPORE) PTE LTD',
      productName: 'DEQUADIN 250MCG LOZENGES ORANGE (EXPORT)',
      productCode: 'DQIE',
      groupTitle: table.groupTitle,
      materials: table.materials,
      batches: table.batches,
    })
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
    expect(bytes.byteLength).toBeGreaterThan(500)
  })
})
