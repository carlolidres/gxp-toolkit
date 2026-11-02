import { addSheet, assertSheetAction, axisSize, copySheet, createWorkbook, DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, ensureSize, normalizeWorkbook, renameSheet, setCellValue, SHEET_NAME_MAX, sheetNameError, writeAxisSize, type CellStyle, type EquipmentSheet, type EquipmentWorkbook, type MergeRange } from '../vmp/equipmentWorkbook'
import { equipmentRecordFromSheet, isMainEquipmentSheet, loadEquipmentMasterlist } from '../vmp/equipmentMasterlist'
import { equipmentProfileLabel } from '../vmp/equipmentReport'
import { fixtureWorkbook, SPREADSHEET_FIXTURE_CODE, spreadsheetFixtureEnabled } from './spreadsheetTestFixture'
import { equipmentSheetName } from './productProfile'

const STORAGE_KEY = 'gxp.cpv.product-profile.v1'
const CENTERED: CellStyle = { align: 'center', valign: 'middle' }
const BOLD: CellStyle = { ...CENTERED, bold: true }
const BOX: CellStyle = { borderTop: true, borderRight: true, borderBottom: true, borderLeft: true, borderColor: '#1d2430', borderStyle: 'solid' }
const NOT_APPLICABLE: CellStyle = { align: 'center', valign: 'middle', fill: '#c5c8ce' }
const BREAKER_TEXT: CellStyle = { bold: true, align: 'left', valign: 'middle' }
const BATCH_SNIPPET = 'profile-batch:'
const MATERIAL_SNIPPET = 'profile-material:'
const HEADER_SNIPPET = 'profile-header'
const SECTION_SNIPPET = 'profile-section'
const NA_SNIPPET = 'profile-na:'
const REMOVED_SUPPLIERS = 'profile-suppliers-removed'
const FIRST_BATCH_ROW = 2
const PACKAGING_SECTION = 'packaging-material'
const EQUIPMENT_SECTION = 'equipment'
const IPC_SECTION = 'in-process-control'
const IPC_HEADER_ROWS = 5
const IPC_DECIMALS = 'ipc-decimals:'
const IPC_CHART = 'ipc-chart'
const IPC_RUN_COLUMN = 'ipc-run-column'
const IPC_RUN_USL = 'ipc-run-usl'
const IPC_RUN_LSL = 'ipc-run-lsl'
const IPC_SERIES_LAST = 'ipc-series-last'
const IPC_LEGEND_ROW = 3
const IPC_PACKAGING_PROCESS = /fill|capp|packag|carton|blister|strip|bottl|sachet|alu/i
export const IPC_PARAMETER_LABELS = [
  'Enter process step (e.g., Granulation, Final Blending, Manufacturing)',
  'Enter IPC parameter (e.g., Moisture Content, LOD)',
  'Enter acceptance criteria (e.g., NMT 1.0%)',
  'Enter BMR step number and description (e.g., Step 5.3 – Drying)',
  'Enter unit (e.g., %, °C, min, rpm)',
]
const EQUIPMENT_HEADER_ROWS = 4
const EQUIPMENT_LABEL_WIDTH = 168
const EQUIPMENT_BODY_SNIPPET = 'equipment-body-rows'
const EQUIPMENT_BREAKER_SNIPPET = 'equipment-breakers'
const PACKAGING_HEADER_ROWS = 4
const PACKAGING_NAME_WIDTH = 280
const PACKAGING_ROW_SNIPPET = 'profile-packaging:'

export type ProfilePoEntry = {
  poControlNo: string
  productCode: string
  sku: string
}

export type ProfileBatchEntry = {
  uniqueBatchNo: string
  moControlNo: string
  poControlNo: string
  productCode: string
  sku: string
  orders?: ProfilePoEntry[]
  mfgDate: string
  expDate: string
  fgReleasedDate: string
}

export type ProfilePackagingEntry = {
  name: string
  description: string
  itemNo: string
  subItemNo: string
  supplierName: string
  supplierAddress: string
}

export type ProfileMaterialEntry = {
  description: string
  supplierName: string
  supplierAddress: string
  itemCode: string
  controlNos: string[]
}

function overlapsProfileHeader(merge: MergeRange): boolean {
  return merge.r1 <= 1 && merge.r2 >= 0 && merge.c1 <= 2 && merge.c2 >= 0
}

function shiftRowsUp<T>(record: Record<string, T> | undefined): Record<string, T> {
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(record ?? {})) {
    const [rowText, columnText] = key.split(':')
    const row = Number(rowText)
    const column = Number(columnText)
    if (!Number.isInteger(row) || !Number.isInteger(column)) {
      next[key] = value
      continue
    }
    if (row === 0) continue
    next[`${row - 1}:${column}`] = value
  }
  return next
}

function dropTitleRow(sheet: EquipmentSheet): EquipmentSheet {
  if (sheet.cells?.['2:1'] !== 'Item Code' || sheet.cells?.['2:2'] !== 'Control No.') return sheet
  const snippets: Record<string, string> = {}
  for (const [key, value] of Object.entries(sheet.snippets ?? {})) {
    const retired = new RegExp(`^${NA_SNIPPET}(\\d+):(\\d+)$`).exec(key)
    if (retired) {
      const row = Number(retired[1])
      if (row > 0) snippets[`${NA_SNIPPET}${row - 1}:${retired[2]}`] = value
      continue
    }
    const match = new RegExp(`^${BATCH_SNIPPET}(\\d+)$`).exec(key)
    if (!match) {
      snippets[key] = value
      continue
    }
    const row = Number(match[1])
    if (row > 0) snippets[`${BATCH_SNIPPET}${row - 1}`] = value
  }
  const rowSizes: Record<string, number> = {}
  for (const [key, value] of Object.entries(sheet.rowSizes ?? {})) {
    const row = Number(key)
    if (Number.isInteger(row) && row > 0) rowSizes[String(row - 1)] = value
  }
  return {
    ...sheet,
    cells: shiftRowsUp(sheet.cells),
    styles: shiftRowsUp(sheet.styles),
    notes: shiftRowsUp(sheet.notes),
    links: shiftRowsUp(sheet.links),
    comments: shiftRowsUp(sheet.comments),
    checkboxes: shiftRowsUp(sheet.checkboxes),
    lockedCells: shiftRowsUp(sheet.lockedCells),
    lists: shiftRowsUp(sheet.lists),
    rowHeights: sheet.rowHeights.slice(1),
    rowSizes: Object.keys(rowSizes).length ? rowSizes : undefined,
    merges: (sheet.merges ?? []).flatMap((merge) => {
      if (merge.r2 < 1) return []
      const r1 = Math.max(0, merge.r1 - 1)
      const r2 = merge.r2 - 1
      return r2 >= r1 ? [{ ...merge, r1, r2 }] : []
    }),
    snippets,
  }
}

function readStoredMaterial(raw: string | undefined): ProfileMaterialEntry | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ProfileMaterialEntry>
    const description = String(parsed.description ?? '').trim()
    if (!description) return null
    return {
      description,
      supplierName: String(parsed.supplierName ?? ''),
      supplierAddress: String(parsed.supplierAddress ?? ''),
      itemCode: String(parsed.itemCode ?? ''),
      controlNos: Array.isArray(parsed.controlNos) ? parsed.controlNos.map((item) => String(item)) : [],
    }
  } catch {
    return null
  }
}

function stampProfileHeader(sheet: EquipmentSheet): EquipmentSheet {
  const base = dropTitleRow(sheet)
  const saved = readStoredMaterial(base.snippets?.[HEADER_SNIPPET])
  const cells = { ...base.cells }
  cells['0:0'] = 'Unique Batch\nNo.'
  cells['0:1'] = saved?.description || 'DESCRIPTION'
  cells['1:1'] = 'Item Code'
  cells['1:2'] = 'Control No.'
  for (const key of ['1:0', '0:2']) delete cells[key]
  const styles = { ...(base.styles ?? {}) }
  styles['0:0'] = { ...styles['0:0'], ...BOLD, wrap: true }
  styles['0:1'] = { ...styles['0:1'], ...BOLD, wrap: true }
  for (const key of ['1:1', '1:2']) styles[key] = { ...styles[key], ...BOLD }
  const carried = carryItemCodes(base, cells, styles)
  const placed = applyMaterialItemCodes(base, carried.cells, carried.styles)
  const painted = paintNotApplicable(base, placed.cells, placed.styles)
  return {
    ...base,
    cells: painted.cells,
    styles: borderProfile(base, painted.cells, painted.styles),
    merges: [
      ...(base.merges ?? []).filter((merge) => !overlapsProfileHeader(merge)),
      { r1: 0, c1: 0, r2: 1, c2: 0 },
      { r1: 0, c1: 1, r2: 0, c2: 2 },
    ],
  }
}

function stampPackagingHeader(sheet: EquipmentSheet, batches: ProfileBatchEntry[]): EquipmentSheet {
  const cells = { ...sheet.cells }
  const styles = { ...(sheet.styles ?? {}) }
  cells['0:0'] = 'Unique Batch No.'
  cells['1:0'] = 'Control No.'
  cells['2:0'] = 'Product Code'
  cells['3:0'] = 'Packaging Material Name'
  for (const key of Object.keys(cells)) {
    const [row, column] = key.split(':').map(Number)
    if (column >= 1 && row >= 0 && row < PACKAGING_HEADER_ROWS) delete cells[key]
  }
  for (const key of Object.keys(styles)) {
    const [row, column] = key.split(':').map(Number)
    if (column >= 1 && row >= 0 && row < PACKAGING_HEADER_ROWS) delete styles[key]
  }
  const groups = Math.max(1, batches.length)
  const merges: MergeRange[] = []
  for (let index = 0; index < groups; index += 1) {
    const column = 1 + index * 2
    const batch = batches[index]
    if (batch) {
      cells[`${0}:${column}`] = batch.uniqueBatchNo
      if (batch.poControlNo.trim()) cells[`${1}:${column}`] = batch.poControlNo.trim()
      if (batch.productCode.trim()) cells[`${2}:${column}`] = batch.productCode.trim()
      for (const row of [0, 1, 2]) {
        const key = `${row}:${column}`
        styles[key] = { ...styles[key], ...BOLD }
        delete styles[key].wrap
      }
    }
    cells[`${3}:${column}`] = 'Item No.'
    cells[`${3}:${column + 1}`] = 'Control No.'
    for (const key of [`${3}:${column}`, `${3}:${column + 1}`]) {
      styles[key] = { ...styles[key], ...BOLD }
      delete styles[key].wrap
    }
    merges.push(
      { r1: 0, c1: column, r2: 0, c2: column + 1 },
      { r1: 1, c1: column, r2: 1, c2: column + 1 },
      { r1: 2, c1: column, r2: 2, c2: column + 1 },
    )
  }
  for (const key of ['0:0', '1:0', '2:0', '3:0']) {
    styles[key] = { ...styles[key], ...BOLD }
    delete styles[key].wrap
  }
  const columnWidths = sheet.columnWidths.slice()
  if ((columnWidths[0] ?? DEFAULT_COL_WIDTH) === DEFAULT_COL_WIDTH) columnWidths[0] = PACKAGING_NAME_WIDTH
  const snippets = { ...(sheet.snippets ?? {}), [SECTION_SNIPPET]: PACKAGING_SECTION }
  const next = { ...sheet, cells, styles, columnWidths, snippets }
  return {
    ...next,
    freezeRows: PACKAGING_HEADER_ROWS,
    freezeCols: 1,
    styles: borderProfile(next, cells, styles),
    merges: [
      ...(sheet.merges ?? []).filter((merge) => merge.r2 < 0 || merge.r1 > 2),
      ...merges,
    ],
  }
}

const EQUIPMENT_PACKAGING_PROCESSES = ['Filling-Packaging', 'Sachet Filling', 'Blistering', 'Stripping', 'Alu-alu', 'Bottling']

export function equipmentProcessKind(sheetName: string): { packaging: boolean; sku: string } {
  const name = sheetName.trim()
  for (const step of EQUIPMENT_PACKAGING_PROCESSES) {
    if (name === step) return { packaging: true, sku: '' }
    const prefix = `${step} - `
    if (name.startsWith(prefix)) return { packaging: true, sku: name.slice(prefix.length) }
  }
  return { packaging: false, sku: '' }
}

function equipmentValueColumns(batches: ProfileBatchEntry[], packaging: boolean, sku: string): { uniqueBatchNo: string; controlNo: string; sku: string }[] {
  const columns: { uniqueBatchNo: string; controlNo: string; sku: string }[] = []
  for (const batch of batches) {
    const uniqueBatchNo = batch.uniqueBatchNo.trim()
    if (!packaging) {
      if (!uniqueBatchNo && !batch.moControlNo.trim()) continue
      columns.push({ uniqueBatchNo, controlNo: batch.moControlNo.trim(), sku: '' })
      continue
    }
    const orders = orderLines(batch).filter((line) => !sku || line.sku.trim().toLowerCase() === sku.toLowerCase())
    const chosen = orders[0]
    if (sku && !chosen) continue
    if (!uniqueBatchNo && !chosen) continue
    columns.push({ uniqueBatchNo, controlNo: chosen?.poControlNo.trim() ?? '', sku: chosen?.sku.trim() ?? sku })
  }
  return columns
}

function equipmentSkus(batches: ProfileBatchEntry[]): string[] {
  const skus: string[] = []
  for (const batch of batches) {
    for (const line of orderLines(batch)) {
      const sku = line.sku.trim()
      if (!sku || skus.some((item) => item.toLowerCase() === sku.toLowerCase())) continue
      skus.push(sku)
    }
  }
  return skus
}

function equipmentHeaderRows(sheetName: string): number {
  return equipmentProcessKind(sheetName).packaging ? 5 : EQUIPMENT_HEADER_ROWS
}

export function equipmentColumnBatch(productId: string, sheetName: string, column: number): ProfileBatchEntry | null {
  if (column < 1) return null
  const kind = equipmentProcessKind(sheetName)
  const batches = rawMaterialBatches(productId)
  const shown = equipmentValueColumns(batches, kind.packaging, kind.sku)[column - 1]
  if (!shown?.uniqueBatchNo) return null
  return batches.find((batch) => batch.uniqueBatchNo.trim().toLowerCase() === shown.uniqueBatchNo.toLowerCase()) ?? null
}

export function packagingColumnBatch(productId: string, sheetName: string, column: number): ProfileBatchEntry | null {
  if (column < 1) return null
  const batch = batchesForSheet(rawMaterialBatches(productId), sheetName)[Math.floor((column - 1) / 2)]
  return batch?.uniqueBatchNo.trim() ? batch : null
}

function equipmentBodyRows(sheet: EquipmentSheet): number {
  const stored = Number(sheet.snippets?.[EQUIPMENT_BODY_SNIPPET] ?? '1')
  return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 1
}

export function isEquipmentBreakerRow(sheet: EquipmentSheet, row: number): boolean {
  return (sheet.snippets?.[EQUIPMENT_BREAKER_SNIPPET] ?? '').split(',').some((item) => Number(item) === row)
}

function styleEquipmentGrid(sheet: EquipmentSheet, cells: Record<string, string>, styles: Record<string, CellStyle>): Record<string, CellStyle> {
  const kind = equipmentProcessKind(sheet.name)
  const header = equipmentHeaderRows(sheet.name)
  const identityRows = kind.packaging ? 3 : 2
  const columns = profileGridLimits({ ...sheet, cells }).columns
  const next = { ...styles }
  for (let column = 1; column < columns; column += 1) {
    for (let row = 0; row < identityRows; row += 1) next[`${row}:${column}`] = { ...next[`${row}:${column}`], ...BOLD }
    next[`${identityRows}:${column}`] = { ...next[`${identityRows}:${column}`], ...CENTERED, bold: false }
    next[`${identityRows + 1}:${column}`] = { ...next[`${identityRows + 1}:${column}`], ...BREAKER_TEXT }
  }
  for (let offset = 0; offset < equipmentBodyRows(sheet); offset += 1) {
    const row = header + offset
    const breaker = isEquipmentBreakerRow(sheet, row)
    for (let column = 0; column < columns; column += 1) {
      if (breaker) next[`${row}:${column}`] = { ...next[`${row}:${column}`], ...BREAKER_TEXT }
      else if (column === 0) next[`${row}:${column}`] = { ...next[`${row}:${column}`], ...BOLD, wrap: true }
      else next[`${row}:${column}`] = { ...next[`${row}:${column}`], ...CENTERED, bold: false, wrap: true }
    }
  }
  return next
}

function equipmentTextWidth(text: string, minimum: number): number {
  return Math.min(720, Math.max(minimum, text.trim().length * 8 + 28))
}

function fitEquipmentText(sheet: EquipmentSheet, row: number, column: number, text: string, minimum: number): EquipmentSheet {
  const trimmed = text.trim()
  if (!trimmed) return sheet
  const width = Math.max(axisSize(sheet.columnWidths, sheet.colSizes, column, DEFAULT_COL_WIDTH), equipmentTextWidth(trimmed, minimum))
  const columns = writeAxisSize(sheet.columnWidths, sheet.colSizes, column, width, DEFAULT_COL_WIDTH)
  const lines = Math.max(1, Math.ceil(equipmentTextWidth(trimmed, minimum) / width))
  const height = Math.max(axisSize(sheet.rowHeights, sheet.rowSizes, row, DEFAULT_ROW_HEIGHT), lines * 20 + 4)
  const rows = writeAxisSize(sheet.rowHeights, sheet.rowSizes, row, height, DEFAULT_ROW_HEIGHT)
  return { ...sheet, columnWidths: columns.dense, colSizes: columns.extra, rowHeights: rows.dense, rowSizes: rows.extra }
}

function masterlistEquipment(label: string): { section: string; main: boolean } | null {
  const wanted = label.trim().toLowerCase()
  if (!wanted) return null
  for (const sheet of loadEquipmentMasterlist().sheets) {
    const main = isMainEquipmentSheet(sheet.name)
    for (let row = 0; row < sheet.rowCount; row += 1) {
      const record = equipmentRecordFromSheet(sheet, row)
      if (!record.equipment) continue
      if (equipmentProfileLabel(record.equipment, record.ilTag).toLowerCase() !== wanted) continue
      return { section: record.section.trim(), main }
    }
  }
  return null
}

function equipmentRoomText(sheet: EquipmentSheet, column: number): string {
  const header = equipmentHeaderRows(sheet.name)
  const sections: string[] = []
  for (let row = header; row < header + equipmentBodyRows(sheet); row += 1) {
    if (isEquipmentBreakerRow(sheet, row)) continue
    const found = masterlistEquipment(cellText(sheet, row, column))
    if (!found?.main || !found.section) continue
    if (sections.some((item) => item.toLowerCase() === found.section.toLowerCase())) continue
    sections.push(found.section)
  }
  return sections.join(', ')
}

export function equipmentRowInUse(sheet: EquipmentSheet, row: number): boolean {
  const columns = profileGridLimits(sheet).columns
  for (let column = 1; column < columns; column += 1) {
    if (cellText(sheet, row, column)) return true
  }
  return false
}

function shiftKeyed<T>(source: Record<string, T>, dropRow: number): Record<string, T> {
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(source)) {
    const [row, column] = key.split(':').map(Number)
    if (row === dropRow) continue
    next[`${row > dropRow ? row - 1 : row}:${column}`] = value
  }
  return next
}

function shiftColumnKeyed<T>(source: Record<string, T>, dropColumn: number): Record<string, T> {
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(source)) {
    const [row, column] = key.split(':').map(Number)
    if (column === dropColumn) continue
    next[`${row}:${column > dropColumn ? column - 1 : column}`] = value
  }
  return next
}

export function presentEquipmentSheet(sheet: EquipmentSheet): EquipmentSheet {
  const header = equipmentHeaderRows(sheet.name)
  const cells = { ...sheet.cells }
  const heading = `${header - 1}:1`
  if (cells[heading]?.trim()) cells[heading] = cells[heading].trim().toUpperCase()
  for (let row = header; row < header + equipmentBodyRows(sheet); row += 1) {
    if (!isEquipmentBreakerRow(sheet, row)) continue
    const anchor = `${row}:1`
    const legacy = `${row}:0`
    if (!cells[anchor]?.trim() && cells[legacy]?.trim()) {
      cells[anchor] = cells[legacy].trim().toUpperCase()
      delete cells[legacy]
    } else if (cells[anchor]?.trim()) cells[anchor] = cells[anchor].trim().toUpperCase()
  }
  const columns = profileGridLimits({ ...sheet, cells }).columns
  for (let column = 1; column < columns; column += 1) {
    const key = `${header - 2}:${column}`
    const room = equipmentRoomText({ ...sheet, cells }, column)
    if (room) cells[key] = room
    else delete cells[key]
  }
  let next: EquipmentSheet = { ...sheet, cells }
  const headingText = cells[heading]?.trim() ?? ''
  if (headingText) next = fitEquipmentText(next, header - 1, 1, headingText, 104)
  for (let column = 1; column < columns; column += 1) {
    const room = cellText(next, header - 2, column)
    if (room) next = fitEquipmentText(next, header - 2, column, room, 104)
  }
  for (let row = header; row < header + equipmentBodyRows(next); row += 1) {
    if (isEquipmentBreakerRow(next, row)) {
      const title = cellText(next, row, 1)
      if (title) next = fitEquipmentText(next, row, 1, title, 104)
      continue
    }
    const name = cellText(next, row, 0)
    if (name) next = fitEquipmentText(next, row, 0, name, EQUIPMENT_LABEL_WIDTH)
    for (let column = 1; column < columns; column += 1) {
      const value = cellText(next, row, column)
      if (value) next = fitEquipmentText(next, row, column, value, 104)
    }
  }
  const styles = styleEquipmentGrid(next, next.cells, next.styles ?? {})
  const merges = (next.merges ?? []).filter((merge) => merge.r1 !== header - 1 && !isEquipmentBreakerRow(next, merge.r1))
  if (columns > 2) {
    merges.push({ r1: header - 1, c1: 1, r2: header - 1, c2: columns - 1 })
    for (let row = header; row < header + equipmentBodyRows(next); row += 1) {
      if (isEquipmentBreakerRow(next, row)) merges.push({ r1: row, c1: 1, r2: row, c2: columns - 1 })
    }
  }
  return { ...next, styles: borderProfile(next, next.cells, styles), merges }
}

function stampEquipmentHeader(sheet: EquipmentSheet, batches: ProfileBatchEntry[] = []): EquipmentSheet {
  const kind = equipmentProcessKind(sheet.name)
  const labels = kind.packaging
    ? ['UNIQUE BATCH NO.', 'CONTROL NO.', 'SKU', 'ROOM / LINE', 'EQUIPMENT']
    : ['UNIQUE BATCH NO.', 'CONTROL NO.', 'ROOM / LINE', 'EQUIPMENT']
  const cells = { ...sheet.cells }
  const styles = { ...(sheet.styles ?? {}) }
  for (let row = 0; row < labels.length; row += 1) delete cells[`${row}:0`]
  labels.forEach((label, row) => {
    cells[`${row}:0`] = label
    styles[`${row}:0`] = { ...styles[`${row}:0`], ...BOLD }
    delete styles[`${row}:0`].wrap
  })
  const valueRows = kind.packaging ? 3 : 2
  for (const key of Object.keys(cells)) {
    const [row, column] = key.split(':').map(Number)
    if (column >= 1 && row >= 0 && row < valueRows) delete cells[key]
  }
  equipmentValueColumns(batches, kind.packaging, kind.sku).forEach((column, index) => {
    const at = index + 1
    if (column.uniqueBatchNo) cells[`0:${at}`] = column.uniqueBatchNo
    if (column.controlNo) cells[`1:${at}`] = column.controlNo
    if (kind.packaging && column.sku) cells[`2:${at}`] = column.sku
  })
  const columnWidths = sheet.columnWidths.slice()
  if ((columnWidths[0] ?? DEFAULT_COL_WIDTH) === DEFAULT_COL_WIDTH) columnWidths[0] = EQUIPMENT_LABEL_WIDTH
  const snippets = { ...(sheet.snippets ?? {}), [SECTION_SNIPPET]: EQUIPMENT_SECTION }
  const next = {
    ...sheet,
    cells,
    styles,
    columnWidths,
    snippets,
    merges: (sheet.merges ?? []).filter((merge) => merge.r2 < 0 || merge.r1 >= labels.length),
  }
  return presentEquipmentSheet(next)
}

export function equipmentSourceBatches(productId: string): ProfileBatchEntry[] {
  return rawMaterialBatches(productId)
}

export function refreshEquipmentWorkbook(workbook: EquipmentWorkbook, productId: string): EquipmentWorkbook {
  const batches = rawMaterialBatches(productId)
  return { ...workbook, sheets: workbook.sheets.map((sheet) => stampEquipmentHeader(sheet, batches)) }
}

export function addEquipmentEntryRow(sheet: EquipmentSheet): EquipmentSheet {
  const header = equipmentHeaderRows(sheet.name)
  let used = equipmentBodyRows(sheet)
  for (const [key, value] of Object.entries(sheet.cells ?? {})) {
    if (!String(value ?? '').trim()) continue
    const row = Number(key.split(':')[0])
    if (row >= header) used = Math.max(used, row - header + 1)
  }
  const next = {
    ...sheet,
    snippets: { ...(sheet.snippets ?? {}), [SECTION_SNIPPET]: EQUIPMENT_SECTION, [EQUIPMENT_BODY_SNIPPET]: String(used + 1) },
  }
  return presentEquipmentSheet(next)
}

export function addEquipmentBreakerRow(sheet: EquipmentSheet): EquipmentSheet {
  const header = equipmentHeaderRows(sheet.name)
  let used = equipmentBodyRows(sheet)
  for (const [key, value] of Object.entries(sheet.cells ?? {})) {
    if (!String(value ?? '').trim()) continue
    const row = Number(key.split(':')[0])
    if (row >= header) used = Math.max(used, row - header + 1)
  }
  const row = header + used
  const marked = (sheet.snippets?.[EQUIPMENT_BREAKER_SNIPPET] ?? '').split(',').filter(Boolean)
  marked.push(String(row))
  const next = {
    ...sheet,
    snippets: {
      ...(sheet.snippets ?? {}),
      [SECTION_SNIPPET]: EQUIPMENT_SECTION,
      [EQUIPMENT_BODY_SNIPPET]: String(used + 1),
      [EQUIPMENT_BREAKER_SNIPPET]: marked.join(','),
    },
  }
  return presentEquipmentSheet(next)
}

export function syncEquipmentProfiles(previousLabel: string, nextLabel: string): void {
  const from = previousLabel.trim().toLowerCase()
  const to = nextLabel.trim()
  const renamed = Boolean(from) && from !== to.toLowerCase()
  const all = readAll()
  for (const [key, raw] of Object.entries(all)) {
    if (!key.endsWith(`:${EQUIPMENT_SECTION}`)) continue
    const workbook = normalizeWorkbook(raw)
    if (!workbook) continue
    const sheets = workbook.sheets.map((sheet) => {
      const cells = { ...sheet.cells }
      if (renamed) {
        for (const [cell, text] of Object.entries(cells)) {
          if (String(text ?? '').trim().toLowerCase() === from) cells[cell] = to
        }
      }
      return presentEquipmentSheet({ ...sheet, cells })
    })
    saveProductSectionWorkbook(key.slice(0, -(`:${EQUIPMENT_SECTION}`.length)), EQUIPMENT_SECTION, { ...workbook, sheets })
  }
}

export function writeEquipmentName(sheet: EquipmentSheet, row: number, label: string): EquipmentSheet {
  const header = equipmentHeaderRows(sheet.name)
  const body = Math.max(equipmentBodyRows(sheet), row - header + 1)
  const written = setCellValue(sheet, row, 0, label)
  return presentEquipmentSheet({
    ...written,
    snippets: { ...(written.snippets ?? {}), [SECTION_SNIPPET]: EQUIPMENT_SECTION, [EQUIPMENT_BODY_SNIPPET]: String(body) },
  })
}

export function markEquipmentBatch(sheet: EquipmentSheet, row: number, column: number, used: boolean): EquipmentSheet {
  const label = cellText(sheet, row, 0)
  if (!label || isEquipmentBreakerRow(sheet, row)) throw new Error('Identify the equipment before marking a batch.')
  const key = `${row}:${column}`
  const cells = { ...sheet.cells }
  const styles = { ...(sheet.styles ?? {}) }
  if (used) {
    cells[key] = label
    const style = { ...styles[key], ...CENTERED, bold: false, wrap: true }
    delete style.fill
    styles[key] = style
  } else {
    delete cells[key]
    styles[key] = { ...styles[key], ...NOT_APPLICABLE, bold: false }
  }
  return presentEquipmentSheet({ ...sheet, cells, styles })
}

export function removeEquipmentProfileRow(sheet: EquipmentSheet, row: number): EquipmentSheet {
  const header = equipmentHeaderRows(sheet.name)
  if (row < header) throw new Error('Header rows stay on this sheet.')
  const breakers = (sheet.snippets?.[EQUIPMENT_BREAKER_SNIPPET] ?? '')
    .split(',')
    .map(Number)
    .filter((item) => Number.isInteger(item) && item !== row)
    .map((item) => item > row ? item - 1 : item)
  const next = {
    ...sheet,
    cells: shiftKeyed(sheet.cells, row),
    styles: shiftKeyed(sheet.styles ?? {}, row),
    snippets: {
      ...(sheet.snippets ?? {}),
      [SECTION_SNIPPET]: EQUIPMENT_SECTION,
      [EQUIPMENT_BODY_SNIPPET]: String(Math.max(1, equipmentBodyRows(sheet) - 1)),
      [EQUIPMENT_BREAKER_SNIPPET]: breakers.join(','),
    },
  }
  return presentEquipmentSheet(next)
}

function dropSheetColumn(sheet: EquipmentSheet, column: number): EquipmentSheet {
  const widths = sheet.columnWidths.slice()
  if (column < widths.length) widths.splice(column, 1)
  return {
    ...sheet,
    cells: shiftColumnKeyed(sheet.cells, column),
    styles: shiftColumnKeyed(sheet.styles ?? {}, column),
    columnWidths: widths,
    merges: (sheet.merges ?? []).flatMap((merge) => {
      if (column < merge.c1) return [{ ...merge, c1: merge.c1 - 1, c2: merge.c2 - 1 }]
      if (column > merge.c2) return [merge]
      if (merge.c1 === merge.c2) return []
      return [{ ...merge, c2: merge.c2 - 1 }]
    }),
  }
}

export function removeEquipmentBatch(workbook: EquipmentWorkbook, productId: string, uniqueBatchNo: string): EquipmentWorkbook {
  const wanted = uniqueBatchNo.trim().toLowerCase()
  clearStoredBatch(productId, wanted)
  const dropped = {
    ...workbook,
    sheets: workbook.sheets.map((sheet) => {
      const column = Object.keys(sheet.cells).map((key) => {
        const [row, col] = key.split(':').map(Number)
        return row === 0 && col >= 1 && String(sheet.cells[key] ?? '').trim().toLowerCase() === wanted ? col : -1
      }).find((col) => col >= 1)
      return column ? dropSheetColumn(sheet, column) : sheet
    }),
  }
  return refreshEquipmentWorkbook(dropped, productId)
}

const SHEET_HISTORY_KEY = 'gxp.cpv.sheet-history.v1'

export type SheetHistoryEntry = {
  id: string
  at: string
  label: string
  reason: string
  workbook: EquipmentWorkbook
}

function readSheetHistory(): Record<string, SheetHistoryEntry[]> {
  try {
    const raw = localStorage.getItem(SHEET_HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) as Record<string, SheetHistoryEntry[]> : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function listSheetHistory(key: string): SheetHistoryEntry[] {
  return readSheetHistory()[key] ?? []
}

export function rememberSheetHistory(key: string, label: string, reason: string, workbook: EquipmentWorkbook): void {
  const all = readSheetHistory()
  const entry: SheetHistoryEntry = { id: `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`, at: new Date().toISOString(), label, reason, workbook }
  all[key] = [entry, ...(all[key] ?? [])].slice(0, 20)
  localStorage.setItem(SHEET_HISTORY_KEY, JSON.stringify(all))
}

export function forgetSheetHistory(key: string, id: string): void {
  const all = readSheetHistory()
  all[key] = (all[key] ?? []).filter((entry) => entry.id !== id)
  localStorage.setItem(SHEET_HISTORY_KEY, JSON.stringify(all))
}

function clearStoredBatch(productId: string, uniqueBatchNo: string): void {
  if (!productId.trim() || !uniqueBatchNo) return
  const raw = loadProductSectionWorkbook(productId, 'raw-material')
  const cleared = {
    ...raw,
    sheets: raw.sheets.map((sheet) => {
      const row = profileBatchRows(sheet, sheet.cells).find((item) => readProfileBatch(sheet, item).uniqueBatchNo.trim().toLowerCase() === uniqueBatchNo)
      if (row === undefined) return sheet
      const cells = { ...sheet.cells }
      const snippets = { ...(sheet.snippets ?? {}) }
      delete cells[`${row}:0`]
      delete snippets[`${BATCH_SNIPPET}${row}`]
      return { ...sheet, cells, snippets }
    }),
  }
  saveProductSectionWorkbook(productId, 'raw-material', cleared)
  const packaging = loadProductSectionWorkbook(productId, 'packaging-material')
  saveProductSectionWorkbook(productId, 'packaging-material', refreshPackagingWorkbook(packaging, productId))
}

export function applyEquipmentProcess(workbook: EquipmentWorkbook, sheetId: string, step: string, batches: ProfileBatchEntry[]): EquipmentWorkbook {
  const process = equipmentSheetName(step)
  const packaging = equipmentProcessKind(process).packaging
  const skus = packaging ? equipmentSkus(batches) : []
  const names = skus.length > 1 ? skus.map((sku) => equipmentSheetName(`${process} - ${sku}`).slice(0, 31)) : [process]
  const current = workbook.sheets.find((sheet) => sheet.id === sheetId)
  if (!current) return workbook
  const renameError = sheetNameError(workbook, sheetId, names[0])
  if (renameError) throw new Error(renameError)
  let next = renameSheet(workbook, sheetId, names[0])
  for (const name of names.slice(1)) {
    if (next.sheets.some((sheet) => sheet.name.toLowerCase() === name.toLowerCase())) continue
    if (sheetNameError(next, '', name)) continue
    next = addSheet(next, name)
  }
  next = { ...next, activeSheetId: sheetId }
  return { ...next, sheets: next.sheets.map((sheet) => stampEquipmentHeader(sheet, batches)) }
}

export function ipcResultText(value: string): string | null {
  const text = value.trim()
  if (!text) return ''
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return null
  return text
}

function ipcHeaderStyle(row: number): CellStyle {
  return { align: 'center', valign: 'middle', bold: row === 0 || row === 1 || row === 3, wrap: true }
}

export function ipcRowHeaderLabel(row: number): string {
  return row < IPC_HEADER_ROWS ? '' : String(row - IPC_HEADER_ROWS + 1)
}

export function ipcParameters(sheet: EquipmentSheet): Array<{ column: number; name: string; specification: string }> {
  const name = String(sheet.cells?.['1:2'] ?? '').trim()
  if (!name) return []
  return [{
    column: 2,
    name,
    specification: String(sheet.cells?.['2:2'] ?? '').trim(),
  }]
}

function ipcHeaderColumns(cells: Record<string, string>): number[] {
  const columns = new Set<number>()
  for (const [key, value] of Object.entries(cells)) {
    const [row, column] = key.split(':').map(Number)
    if (row < IPC_HEADER_ROWS && column >= 2 && String(value ?? '').trim()) columns.add(column)
  }
  return [...columns].sort((left, right) => left - right)
}

function ipcWrappedLines(text: string, width: number): number {
  const maxChars = Math.max(8, Math.floor((width - 36) / 8))
  let lines = 0
  for (const paragraph of (text.trim() ? text.split('\n') : [''])) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (!words.length) {
      lines += 1
      continue
    }
    let length = 0
    let row = 1
    for (const word of words) {
      const next = length === 0 ? word.length : length + 1 + word.length
      if (length > 0 && next > maxChars) {
        row += 1
        length = word.length
      } else length = next
    }
    lines += row
  }
  return Math.max(1, lines)
}

function fitIpcHeaders(sheet: EquipmentSheet): EquipmentSheet {
  const columns = ipcHeaderColumns(sheet.cells ?? {})
  if (!columns.length) return sheet
  const columnWidths = sheet.columnWidths.slice()
  const rowHeights = sheet.rowHeights.slice()
  const needed = Array.from({ length: IPC_HEADER_ROWS }, () => DEFAULT_ROW_HEIGHT)
  for (const column of columns) {
    const lines = Array.from({ length: IPC_HEADER_ROWS }, (_, row) => String(sheet.cells[`${row}:${column}`] ?? ''))
    const longest = lines.reduce((max, line) => Math.max(max, ...line.split('\n').map((part) => part.length)), 0)
    const width = Math.max(120, Math.min(640, Math.ceil(longest * 8) + 36))
    while (columnWidths.length <= column) columnWidths.push(DEFAULT_COL_WIDTH)
    columnWidths[column] = width
    lines.forEach((line, row) => {
      needed[row] = Math.max(needed[row], ipcWrappedLines(line, width) * DEFAULT_ROW_HEIGHT)
    })
  }
  const shared = columnWidths[2] ?? 120
  const last = ipcSeriesLast({ ...sheet, columnWidths })
  for (let column = 2; column <= last; column += 1) {
    while (columnWidths.length <= column) columnWidths.push(shared)
    columnWidths[column] = shared
  }
  for (let row = 0; row < IPC_HEADER_ROWS; row += 1) {
    while (rowHeights.length <= row) rowHeights.push(DEFAULT_ROW_HEIGHT)
    rowHeights[row] = needed[row]
  }
  return { ...sheet, columnWidths, rowHeights }
}

function ipcSheetTitle(text: string): string {
  const cleaned = text.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '').trim()
  return cleaned.length > SHEET_NAME_MAX ? cleaned.slice(0, SHEET_NAME_MAX).trim() : cleaned
}

function uniqueSheetTitle(workbook: EquipmentWorkbook, sheetId: string, title: string): string | null {
  if (!title) return null
  if (!sheetNameError(workbook, sheetId, title)) return title
  for (let count = 2; count < 50; count += 1) {
    const suffix = ` ${count}`
    const name = `${title.slice(0, SHEET_NAME_MAX - suffix.length).trim()}${suffix}`
    if (!sheetNameError(workbook, sheetId, name)) return name
  }
  return null
}

function nameIpcSheets(workbook: EquipmentWorkbook): EquipmentWorkbook {
  let next = workbook
  for (const sheet of workbook.sheets) {
    if (sheet.snippets?.[IPC_CHART]) continue
    const current = next.sheets.find((item) => item.id === sheet.id)
    const title = uniqueSheetTitle(next, sheet.id, ipcSheetTitle(ipcParameters(current ?? sheet)[0]?.name ?? ''))
    if (!title || current?.name === title) continue
    next = renameSheet(next, sheet.id, title)
  }
  return next
}

export function writeIpcParameter(sheet: EquipmentSheet, column: number, values: string[]): EquipmentSheet {
  const cells = { ...sheet.cells }
  const styles = { ...(sheet.styles ?? {}) }
  for (let row = 0; row < IPC_HEADER_ROWS; row += 1) {
    const text = values[row]?.trim() ?? ''
    const key = `${row}:${column}`
    if (text) cells[key] = text
    else delete cells[key]
    styles[key] = { ...styles[key], ...ipcHeaderStyle(row) }
  }
  const next = { ...sheet, cells, styles }
  return fitIpcHeaders({ ...next, styles: borderProfile(next, cells, styles) })
}

export function commitIpcParameter(workbook: EquipmentWorkbook, sheetId: string, column: number, values: string[]): EquipmentWorkbook {
  void column
  return nameIpcSheets({
    ...workbook,
    sheets: workbook.sheets.map((item) => (item.id === sheetId ? writeIpcParameter(item, 2, values) : item)),
  })
}

export function applyIpcDecimals(sheet: EquipmentSheet, column: number, decimals: number): EquipmentSheet {
  const places = Math.min(10, Math.max(0, Math.trunc(decimals)))
  const styles = { ...(sheet.styles ?? {}) }
  const rows = profileGridLimits(sheet).rows
  for (let row = IPC_HEADER_ROWS; row < rows; row += 1) {
    styles[`${row}:${column}`] = { ...styles[`${row}:${column}`], format: 'number', decimals: places, align: 'center', valign: 'middle', bold: false }
  }
  return {
    ...sheet,
    styles,
    snippets: { ...(sheet.snippets ?? {}), [`${IPC_DECIMALS}${column}`]: String(places) },
  }
}

function ipcPackagingProcess(text: string): boolean {
  return IPC_PACKAGING_PROCESS.test(text)
}

function ipcSheetPackaging(cells: Record<string, string>): boolean {
  return Object.entries(cells).some(([key, value]) => {
    const [row, column] = key.split(':').map(Number)
    return row === 0 && column >= 2 && ipcPackagingProcess(String(value ?? ''))
  })
}

function ipcShownControl(batch: ProfileBatchEntry, packaging: boolean): string {
  if (!packaging) return batch.moControlNo.trim()
  return [batch.poControlNo.trim(), batch.sku.trim()].filter(Boolean).join('\n')
}

export type IpcChartSeries = {
  column: number
  name: string
  points: Array<{ batch: number; value: number }>
  ucl: number | null
  lcl: number | null
}

export type IpcRunChart = {
  title: string
  specification: string
  median: number
  ucl: number
  lcl: number
  yMin: number
  yMax: number
  ticks: number[]
  batches: number[]
  points: Array<{ batch: number; value: number }>
  series: IpcChartSeries[]
}

function ipcSeriesLast(sheet: EquipmentSheet): number {
  const stored = Number(sheet.snippets?.[IPC_SERIES_LAST])
  let last = Number.isInteger(stored) && stored >= 2 ? stored : 2
  for (const [key, value] of Object.entries(sheet.cells ?? {})) {
    const [row, column] = key.split(':').map(Number)
    if (row < IPC_HEADER_ROWS && column > last && String(value ?? '').trim()) last = column
  }
  for (const merge of sheet.merges ?? []) {
    if (merge.c1 === 2 && merge.r1 <= 2 && merge.r2 <= 2 && merge.c2 > last) last = merge.c2
  }
  return last
}

function ipcSeriesMerges(last: number): MergeRange[] {
  if (last <= 2) return []
  return [0, 1, 2].map((row) => ({ r1: row, c1: 2, r2: row, c2: last }))
}

export function addIpcSeriesColumn(sheet: EquipmentSheet): EquipmentSheet {
  const last = ipcSeriesLast(sheet) + 1
  const cells = { ...sheet.cells }
  const styles = { ...(sheet.styles ?? {}) }
  const unit = String(cells['4:2'] ?? '').trim()
  if (unit) cells[`4:${last}`] = unit
  for (let row = 0; row < IPC_HEADER_ROWS; row += 1) {
    styles[`${row}:${last}`] = { ...styles[`${row}:${last}`], ...ipcHeaderStyle(row) }
  }
  const columnWidths = sheet.columnWidths.slice()
  while (columnWidths.length <= last) columnWidths.push(DEFAULT_COL_WIDTH)
  columnWidths[last] = Math.max(120, columnWidths[2] ?? 120)
  const snippets = { ...(sheet.snippets ?? {}), [IPC_SERIES_LAST]: String(last) }
  return fitIpcHeaders({
    ...sheet,
    cells,
    styles: borderProfile({ ...sheet, cells }, cells, styles),
    columnWidths,
    snippets,
    columnCount: Math.max(sheet.columnCount, last + 1),
    merges: [
      ...(sheet.merges ?? []).filter((merge) => !(merge.c1 === 2 && merge.r1 <= 2 && merge.r2 <= 2 && merge.r1 === merge.r2)),
      ...ipcSeriesMerges(last),
    ],
  })
}

function movingLimits(values: number[]): { ucl: number; lcl: number } {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  if (values.length < 2) return { ucl: mean, lcl: mean }
  let range = 0
  for (let index = 1; index < values.length; index += 1) range += Math.abs(values[index] - values[index - 1])
  const band = (range / (values.length - 1)) * 2.66
  return { ucl: mean + band, lcl: mean - band }
}

function chartTicks(low: number, high: number): { yMin: number; yMax: number; ticks: number[] } {
  const span = Math.max(high - low, 1e-6)
  const rough = span / 6
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  const step = nice * power
  const yMin = Math.floor((low + step * 1e-8) / step) * step
  const yMax = Math.ceil((high - step * 1e-8) / step) * step
  const ticks: number[] = []
  for (let value = yMin; value <= yMax + step * 0.5; value += step) ticks.push(Math.round(value * 1e8) / 1e8)
  return { yMin, yMax: Math.max(yMax, yMin + step), ticks }
}

export function ipcRunChart(sheet: EquipmentSheet, column: number, usl: number, lsl: number, scaleColumns?: number[]): IpcRunChart | null {
  const parameter = ipcParameters(sheet).find((item) => item.column === column)
  if (!parameter || !Number.isFinite(usl) || !Number.isFinite(lsl)) return null
  const rows = Object.keys(sheet.cells ?? {}).flatMap((key) => {
    const [row, cellColumn] = key.split(':').map(Number)
    return cellColumn === 0 && row >= IPC_HEADER_ROWS && String(sheet.cells[key] ?? '').trim() ? [row] : []
  }).sort((left, right) => left - right)
  const batches = rows.map((row) => row - IPC_HEADER_ROWS + 1)
  const points = rows.flatMap((row) => {
    const text = String(sheet.cells[`${row}:${column}`] ?? '').trim()
    const value = Number(text)
    if (!text || !Number.isFinite(value)) return []
    return [{ batch: row - IPC_HEADER_ROWS + 1, value }]
  })
  const median = (usl + lsl) / 2
  const series = Array.from({ length: ipcSeriesLast(sheet) - 1 }, (_, index) => {
    const seriesColumn = index + 2
    const seriesPoints = rows.flatMap((row) => {
      const text = String(sheet.cells[`${row}:${seriesColumn}`] ?? '').trim()
      const value = Number(text)
      if (!text || !Number.isFinite(value)) return []
      return [{ batch: row - IPC_HEADER_ROWS + 1, value }]
    })
    const seriesLimits = seriesPoints.length ? movingLimits(seriesPoints.map((point) => point.value)) : null
    return {
      column: seriesColumn,
      name: String(sheet.cells[`${IPC_LEGEND_ROW}:${seriesColumn}`] ?? '').trim() || `Series ${index + 1}`,
      points: seriesPoints,
      ucl: seriesLimits?.ucl ?? null,
      lcl: seriesLimits?.lcl ?? null,
    }
  })
  const shown = scaleColumns ? series.filter((item) => scaleColumns.includes(item.column)) : series
  const limits = points.length ? movingLimits(points.map((point) => point.value)) : null
  const lcl = limits?.lcl ?? lsl
  const ucl = limits?.ucl ?? usl
  const scaledLimits = shown.flatMap((item) => [item.ucl, item.lcl].filter((value): value is number => value != null))
  const floorSource = scaledLimits.length ? Math.min(...scaledLimits) : lcl
  const floor = floorSource - Math.abs(floorSource) * 0.05
  const ceiling = usl + Math.abs(usl) * 0.05
  const samples = [floor, ceiling, usl, lsl, median, ...scaledLimits, ...shown.flatMap((item) => item.points.map((point) => point.value))]
  const low = Math.min(...samples)
  const high = Math.max(...samples)
  const axis = chartTicks(low === high ? low - 1 : low, low === high ? high + 1 : high)
  return {
    title: parameter.name,
    specification: parameter.specification,
    median,
    ucl,
    lcl,
    yMin: axis.yMin,
    yMax: axis.yMax,
    ticks: axis.ticks,
    batches,
    points,
    series,
  }
}

export type IpcRunObservation = {
  runsAboutMedian: number
  expectedRunsAboutMedian: number
  longestRunAboutMedian: number
  clusteringP: number | null
  mixturesP: number | null
  runsUpDown: number | null
  expectedRunsUpDown: number | null
  longestRunUpDown: number | null
  trendsP: number | null
  oscillationP: number | null
}

export type IpcNelsonSignal = {
  test: number
  pattern: string
}

function resultsMedian(values: number[]): number {
  const sorted = values.slice().sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const density = 0.3989422804 * Math.exp((-z * z) / 2)
  const tail = density * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z >= 0 ? 1 - tail : tail
}

function runsAboutMedian(values: number[], median: number): { runs: number; longest: number; above: number; onOrBelow: number } {
  let runs = 0
  let longest = 0
  let current = 0
  let above = 0
  let side = 0
  for (const value of values) {
    const next = value > median ? 1 : -1
    if (next === 1) above += 1
    if (next !== side) {
      runs += 1
      current = 1
      side = next
    } else current += 1
    longest = Math.max(longest, current)
  }
  return { runs, longest, above, onOrBelow: values.length - above }
}

function runsUpOrDown(values: number[]): { runs: number; longest: number } | null {
  if (values.length < 2) return null
  let runs = 1
  let longestSteps = 1
  let current = 1
  let direction = 0
  for (let index = 1; index < values.length; index += 1) {
    const next = values[index] > values[index - 1] ? 1 : -1
    if (next === direction) {
      current += 1
    } else {
      if (direction !== 0) runs += 1
      current = 1
      direction = next
    }
    longestSteps = Math.max(longestSteps, current)
  }
  return { runs, longest: longestSteps + 1 }
}

export function ipcRunObservation(values: number[]): IpcRunObservation | null {
  if (!values.length) return null
  const median = resultsMedian(values)
  const about = runsAboutMedian(values, median)
  const total = values.length
  const expectedAbout = (2 * about.above * about.onOrBelow) / total + 1
  const aboutVariance = total > 1
    ? (2 * about.above * about.onOrBelow * (2 * about.above * about.onOrBelow - total)) / (total ** 2 * (total - 1))
    : 0
  const aboutZ = aboutVariance > 0 ? (about.runs - expectedAbout) / Math.sqrt(aboutVariance) : null
  const vertical = runsUpOrDown(values)
  const expectedVertical = vertical ? (2 * total - 1) / 3 : null
  const verticalVariance = vertical ? (16 * total - 29) / 90 : 0
  const verticalZ = vertical && expectedVertical != null && verticalVariance > 0
    ? (vertical.runs - expectedVertical) / Math.sqrt(verticalVariance)
    : null
  return {
    runsAboutMedian: about.runs,
    expectedRunsAboutMedian: expectedAbout,
    longestRunAboutMedian: about.longest,
    clusteringP: aboutZ == null ? null : normalCdf(aboutZ),
    mixturesP: aboutZ == null ? null : 1 - normalCdf(aboutZ),
    runsUpDown: vertical?.runs ?? null,
    expectedRunsUpDown: expectedVertical,
    longestRunUpDown: vertical?.longest ?? null,
    trendsP: verticalZ == null ? null : normalCdf(verticalZ),
    oscillationP: verticalZ == null ? null : 1 - normalCdf(verticalZ),
  }
}

const NELSON_PATTERNS = ['Extreme point', 'Shift', 'Trend', 'Oscillation', 'Small shift', 'Small shift', 'Stratification', 'Mixture']

function nelsonWindow(length: number, size: number, test: (start: number) => boolean): boolean {
  if (length < size) return false
  for (let start = 0; start <= length - size; start += 1) {
    if (test(start)) return true
  }
  return false
}

export function ipcNelsonSignals(values: number[]): IpcNelsonSignal[] {
  if (values.length < 2) return []
  let range = 0
  for (let index = 1; index < values.length; index += 1) range += Math.abs(values[index] - values[index - 1])
  const sigma = (range / (values.length - 1)) * 2.66 / 3
  if (!(sigma > 0)) return []
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const zone = values.map((value) => (value - mean) / sigma)
  const fired = [
    zone.some((value) => Math.abs(value) > 3),
    nelsonWindow(zone.length, 9, (start) => {
      const window = zone.slice(start, start + 9)
      return window.every((value) => value > 0) || window.every((value) => value < 0)
    }),
    nelsonWindow(values.length, 6, (start) => {
      let up = true
      let down = true
      for (let index = start + 1; index < start + 6; index += 1) {
        if (!(values[index] > values[index - 1])) up = false
        if (!(values[index] < values[index - 1])) down = false
      }
      return up || down
    }),
    nelsonWindow(values.length, 14, (start) => {
      let sign = 0
      for (let index = start + 1; index < start + 14; index += 1) {
        const delta = values[index] - values[index - 1]
        if (delta === 0 || delta * sign > 0) return false
        sign = delta > 0 ? 1 : -1
      }
      return true
    }),
    nelsonWindow(zone.length, 3, (start) => {
      const window = zone.slice(start, start + 3)
      return window.filter((value) => value > 2).length >= 2 || window.filter((value) => value < -2).length >= 2
    }),
    nelsonWindow(zone.length, 5, (start) => {
      const window = zone.slice(start, start + 5)
      return window.filter((value) => value > 1).length >= 4 || window.filter((value) => value < -1).length >= 4
    }),
    nelsonWindow(zone.length, 15, (start) => zone.slice(start, start + 15).every((value) => Math.abs(value) < 1)),
    nelsonWindow(zone.length, 8, (start) => zone.slice(start, start + 8).every((value) => Math.abs(value) > 1)),
  ]
  return fired.flatMap((match, index) => (match ? [{ test: index + 1, pattern: NELSON_PATTERNS[index] }] : []))
}

function overlapsIpcHeader(merge: MergeRange): boolean {
  return merge.r1 <= IPC_HEADER_ROWS - 1 && merge.r2 >= 0 && merge.c1 <= 2 && merge.c2 >= 0
}

function clearExtraIpcParameters(sheet: EquipmentSheet): EquipmentSheet {
  const cells = { ...sheet.cells }
  let changed = false
  for (const key of Object.keys(cells)) {
    const [row, column] = key.split(':').map(Number)
    if (column > 2 && row < 3) {
      delete cells[key]
      changed = true
    }
  }
  return changed ? { ...sheet, cells } : sheet
}

function trimBlankIpcSeries(sheet: EquipmentSheet): EquipmentSheet {
  let last = ipcSeriesLast(sheet)
  const cells = { ...sheet.cells }
  const styles = { ...(sheet.styles ?? {}) }
  let changed = false
  while (last > 2) {
    const name = String(cells[`${IPC_LEGEND_ROW}:${last}`] ?? '').trim()
    const hasValue = Object.entries(cells).some(([key, value]) => {
      const [row, column] = key.split(':').map(Number)
      return column === last && row >= IPC_HEADER_ROWS && String(value ?? '').trim()
    })
    if (name || hasValue) break
    for (const key of Object.keys(cells)) {
      if (Number(key.split(':')[1]) === last) delete cells[key]
    }
    for (const key of Object.keys(styles)) {
      if (Number(key.split(':')[1]) === last) delete styles[key]
    }
    last -= 1
    changed = true
  }
  if (!changed) return sheet
  const snippets = { ...(sheet.snippets ?? {}) }
  if (last <= 2) delete snippets[IPC_SERIES_LAST]
  else snippets[IPC_SERIES_LAST] = String(last)
  return {
    ...sheet,
    cells,
    styles,
    snippets,
    columnCount: Math.max(last + 1, 3),
    merges: (sheet.merges ?? []).flatMap((merge) => {
      if (!(merge.c1 === 2 && merge.r1 <= 2 && merge.r2 <= 2 && merge.r1 === merge.r2)) return [merge]
      return last > 2 ? [{ ...merge, c2: last }] : []
    }),
  }
}

function stampIpcHeader(sheet: EquipmentSheet, batches: ProfileBatchEntry[]): EquipmentSheet {
  sheet = trimBlankIpcSeries(clearExtraIpcParameters(sheet))
  const cells = { ...sheet.cells }
  const styles = { ...(sheet.styles ?? {}) }
  if (cells['1:1']?.trim() === 'Item Code') delete cells['1:1']
  if (cells['1:2']?.trim() === 'Control No.') delete cells['1:2']
  delete cells['1:0']
  cells['0:0'] = 'UNIQUE BATCH NO.'
  cells['0:1'] = 'CONTROL NO.'
  for (let row = 1; row < IPC_HEADER_ROWS; row += 1) {
    delete cells[`${row}:0`]
    delete cells[`${row}:1`]
  }
  for (const [key, value] of Object.entries(cells)) {
    const [row, column] = key.split(':').map(Number)
    if (row < IPC_HEADER_ROWS && column >= 2 && IPC_PARAMETER_LABELS.includes(String(value ?? '').trim())) delete cells[key]
  }
  const headerColumns = new Set<number>([2])
  for (const key of Object.keys(cells)) {
    const [row, column] = key.split(':').map(Number)
    if (row < IPC_HEADER_ROWS && column >= 2) headerColumns.add(column)
  }
  for (const column of headerColumns) {
    for (let row = 0; row < IPC_HEADER_ROWS; row += 1) {
      styles[`${row}:${column}`] = { ...styles[`${row}:${column}`], ...ipcHeaderStyle(row) }
    }
  }
  styles['0:0'] = { ...styles['0:0'], ...BOLD, wrap: true }
  styles['0:1'] = { ...styles['0:1'], ...BOLD, wrap: true }
  const carried = new Map<number, { unique: string; control: string; values: Record<string, string> }>()
  for (const [key, value] of Object.entries(cells)) {
    const text = String(value ?? '').trim()
    const [row, column] = key.split(':').map(Number)
    if (!text || row < IPC_HEADER_ROWS) continue
    const entry = carried.get(row) ?? { unique: '', control: '', values: {} }
    if (column === 0) entry.unique = text
    else if (column === 1) entry.control = text
    else {
      const number = ipcResultText(text)
      if (number) entry.values[String(column)] = number
    }
    carried.set(row, entry)
  }
  for (const key of Object.keys(cells)) {
    if (Number(key.split(':')[0]) >= IPC_HEADER_ROWS) delete cells[key]
  }
  const seen = new Set<string>()
  let row = IPC_HEADER_ROWS
  const writeRow = (unique: string, control: string, values: Record<string, string>) => {
    cells[`${row}:0`] = unique
    styles[`${row}:0`] = { ...styles[`${row}:0`], ...BOLD }
    if (control) cells[`${row}:1`] = control
    styles[`${row}:1`] = { ...styles[`${row}:1`], ...BOLD, wrap: control.includes('\n') }
    for (const [column, value] of Object.entries(values)) {
      cells[`${row}:${column}`] = value
      styles[`${row}:${column}`] = { ...styles[`${row}:${column}`], align: 'center', valign: 'middle', bold: false }
    }
    styles[`${row}:2`] = { ...styles[`${row}:2`], align: 'center', valign: 'middle', bold: false }
    for (const [key, places] of Object.entries(sheet.snippets ?? {})) {
      if (!key.startsWith(IPC_DECIMALS)) continue
      const column = key.slice(IPC_DECIMALS.length)
      const decimals = Number(places)
      if (!Number.isInteger(decimals)) continue
      styles[`${row}:${column}`] = { ...styles[`${row}:${column}`], format: 'number', decimals, align: 'center', valign: 'middle', bold: false }
    }
    row += 1
  }
  for (const batch of batches) {
    const unique = batch.uniqueBatchNo.trim()
    if (!unique) continue
    const key = unique.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const saved = [...carried.values()].find((entry) => entry.unique.toLowerCase() === key)
    writeRow(unique, ipcShownControl(batch, ipcSheetPackaging(cells)), saved?.values ?? {})
  }
  for (const entry of [...carried.values()].sort((a, b) => a.unique.localeCompare(b.unique))) {
    const key = entry.unique.toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    writeRow(entry.unique, entry.control, entry.values)
  }
  const columnWidths = sheet.columnWidths.slice()
  if ((columnWidths[0] ?? DEFAULT_COL_WIDTH) === DEFAULT_COL_WIDTH) columnWidths[0] = 160
  if ((columnWidths[1] ?? DEFAULT_COL_WIDTH) === DEFAULT_COL_WIDTH) columnWidths[1] = 140
  const snippets = { ...(sheet.snippets ?? {}), [SECTION_SNIPPET]: IPC_SECTION }
  const rowHeights = sheet.rowHeights.slice()
  for (const [key, value] of Object.entries(cells)) {
    const [dataRow, dataColumn] = key.split(':').map(Number)
    if (dataColumn !== 1 || dataRow < IPC_HEADER_ROWS || !String(value).includes('\n')) continue
    while (rowHeights.length <= dataRow) rowHeights.push(DEFAULT_ROW_HEIGHT)
    rowHeights[dataRow] = Math.max(rowHeights[dataRow] ?? DEFAULT_ROW_HEIGHT, 44)
  }
  const next = { ...sheet, cells, styles, columnWidths, rowHeights, snippets, freezeRows: IPC_HEADER_ROWS, freezeCols: 1 }
  return fitIpcHeaders({
    ...next,
    styles: borderProfile(next, cells, styles),
    merges: [
      ...(sheet.merges ?? []).filter((merge) => !overlapsIpcHeader(merge)),
      { r1: 0, c1: 0, r2: IPC_HEADER_ROWS - 1, c2: 0 },
      { r1: 0, c1: 1, r2: IPC_HEADER_ROWS - 1, c2: 1 },
      ...ipcSeriesMerges(ipcSeriesLast({ ...sheet, cells, snippets })),
    ],
  })
}

function adoptIpcCharts(workbook: EquipmentWorkbook): EquipmentWorkbook {
  const charts = workbook.sheets.filter((sheet) => sheet.snippets?.[IPC_CHART])
  if (!charts.length) return workbook
  let sheets = workbook.sheets.filter((sheet) => !sheet.snippets?.[IPC_CHART])
  if (!sheets.length) return workbook
  for (const chart of charts) {
    const sourceId = chart.snippets?.[IPC_CHART]
    sheets = sheets.map((sheet) => {
      if (sheet.id !== sourceId || sheet.snippets?.[IPC_RUN_COLUMN]) return sheet
      return {
        ...sheet,
        snippets: {
          ...(sheet.snippets ?? {}),
          [IPC_RUN_COLUMN]: chart.snippets?.['ipc-chart-column'] ?? '',
          [IPC_RUN_USL]: chart.snippets?.['ipc-chart-usl'] ?? '',
          [IPC_RUN_LSL]: chart.snippets?.['ipc-chart-lsl'] ?? '',
        },
      }
    })
  }
  const activeFromChart = charts.find((sheet) => sheet.id === workbook.activeSheetId)?.snippets?.[IPC_CHART]
  const activeSheetId = sheets.some((sheet) => sheet.id === workbook.activeSheetId)
    ? workbook.activeSheetId
    : sheets.some((sheet) => sheet.id === activeFromChart) ? activeFromChart! : sheets[0].id
  return { ...workbook, sheets, activeSheetId }
}

export function refreshIpcWorkbook(workbook: EquipmentWorkbook, productId: string): EquipmentWorkbook {
  const adopted = adoptIpcCharts(workbook)
  const batches = rawMaterialBatches(productId)
  return nameIpcSheets({
    ...adopted,
    sheets: adopted.sheets.map((sheet) => stampIpcHeader(sheet, batches)),
  })
}

export function attachIpcRunChart(workbook: EquipmentWorkbook, sheetId: string, column: number, usl: number, lsl: number): EquipmentWorkbook {
  const source = workbook.sheets.find((sheet) => sheet.id === sheetId)
  const parameter = source ? ipcParameters(source).find((item) => item.column === column) : undefined
  if (!source || !parameter) throw new Error('Choose a parameter from the sheet.')
  if (!Number.isFinite(usl) || !Number.isFinite(lsl)) throw new Error('Enter a number for USL and LSL.')
  const adopted = adoptIpcCharts(workbook)
  const targetId = adopted.sheets.some((sheet) => sheet.id === sheetId) ? sheetId : adopted.activeSheetId
  return {
    ...adopted,
    activeSheetId: targetId,
    sheets: adopted.sheets.map((sheet) => sheet.id === targetId ? {
      ...sheet,
      snippets: {
        ...(sheet.snippets ?? {}),
        [IPC_RUN_COLUMN]: String(column),
        [IPC_RUN_USL]: String(usl),
        [IPC_RUN_LSL]: String(lsl),
      },
    } : sheet),
  }
}

export function addIpcDataSheet(workbook: EquipmentWorkbook, productId: string): EquipmentWorkbook {
  const next = addSheet(workbook)
  return refreshIpcWorkbook(next, productId)
}

export function addIpcChartSheet(workbook: EquipmentWorkbook, sourceId: string, column: number, usl: number, lsl: number): EquipmentWorkbook {
  const source = workbook.sheets.find((sheet) => sheet.id === sourceId)
  const parameter = source ? ipcParameters(source).find((item) => item.column === column) : undefined
  if (!source || !parameter) throw new Error('Choose a parameter from the sheet.')
  if (!Number.isFinite(usl) || !Number.isFinite(lsl)) throw new Error('Enter a number for USL and LSL.')
  const suffix = ' chart'
  const base = ipcSheetTitle(parameter.name).slice(0, SHEET_NAME_MAX - suffix.length).trim()
  const title = uniqueSheetTitle(workbook, '', `${base}${suffix}`)
  if (!title) throw new Error('A worksheet with that name already exists.')
  const next = addSheet(workbook, title)
  return {
    ...next,
    sheets: next.sheets.map((sheet) => sheet.id === next.activeSheetId ? {
      ...sheet,
      snippets: {
        [SECTION_SNIPPET]: IPC_SECTION,
        [IPC_CHART]: sourceId,
        'ipc-chart-column': String(column),
        'ipc-chart-usl': String(usl),
        'ipc-chart-lsl': String(lsl),
      },
    } : sheet),
  }
}

function withProfileHeader(workbook: EquipmentWorkbook, section: string, productId = ''): EquipmentWorkbook {
  if (section === PACKAGING_SECTION) return refreshPackagingWorkbook(workbook, productId)
  if (section === EQUIPMENT_SECTION) return { ...workbook, sheets: workbook.sheets.map((sheet) => stampEquipmentHeader(sheet, rawMaterialBatches(productId))) }
  if (section === IPC_SECTION) return refreshIpcWorkbook(workbook, productId)
  if (section === 'raw-material') {
    const synced = ensureProfileSkuSheets(workbook, collectWorkbookBatches(workbook))
    return { ...synced, sheets: synced.sheets.map((sheet) => stampProfileHeader(sheet)) }
  }
  return { ...workbook, sheets: workbook.sheets.map((sheet) => stampProfileHeader(sheet)) }
}

function cellText(sheet: EquipmentSheet, row: number, column: number): string {
  return String(sheet.cells[`${row}:${column}`] ?? '').trim()
}

export function profileGridLimits(sheet: EquipmentSheet): { rows: number; columns: number } {
  if (sheet.snippets?.[SECTION_SNIPPET] === EQUIPMENT_SECTION) {
    const header = equipmentHeaderRows(sheet.name)
    let rows = header + equipmentBodyRows(sheet)
    let columns = 2
    for (const [key, value] of Object.entries(sheet.cells ?? {})) {
      if (!String(value ?? '').trim()) continue
      const [row, column] = key.split(':').map(Number)
      if (!Number.isInteger(row) || !Number.isInteger(column)) continue
      rows = Math.max(rows, row + 1)
      columns = Math.max(columns, column + 1)
    }
    return { rows, columns }
  }
  if (sheet.snippets?.[SECTION_SNIPPET] === IPC_SECTION) {
    if (sheet.snippets?.[IPC_CHART]) return { rows: 1, columns: 1 }
    let rows = IPC_HEADER_ROWS
    let columns = 3
    const seriesLast = Number(sheet.snippets?.[IPC_SERIES_LAST])
    if (Number.isInteger(seriesLast) && seriesLast >= 2) columns = Math.max(columns, seriesLast + 1)
    for (const [key, value] of Object.entries(sheet.cells ?? {})) {
      if (!String(value ?? '').trim()) continue
      const [row, column] = key.split(':').map(Number)
      if (!Number.isInteger(row) || !Number.isInteger(column)) continue
      rows = Math.max(rows, row + 1)
      columns = Math.max(columns, column + 1)
    }
    return { rows, columns }
  }
  if (sheet.snippets?.[SECTION_SNIPPET] === PACKAGING_SECTION) {
    let rows = PACKAGING_HEADER_ROWS
    let columns = 3
    for (const [key, value] of Object.entries(sheet.cells ?? {})) {
      if (!String(value ?? '').trim()) continue
      const [row, column] = key.split(':').map(Number)
      if (!Number.isInteger(row) || !Number.isInteger(column)) continue
      if (column === 0 && row >= PACKAGING_HEADER_ROWS) rows = Math.max(rows, row + 1)
      if (column >= 1 && row < PACKAGING_HEADER_ROWS) columns = Math.max(columns, column + 1)
    }
    if (columns > 3) columns = 3 + Math.ceil((columns - 3) / 2) * 2
    return { rows, columns }
  }
  let rows = FIRST_BATCH_ROW + 1
  let columns = 3
  for (const [key, value] of Object.entries(sheet.cells ?? {})) {
    if (!String(value ?? '').trim()) continue
    const [row, column] = key.split(':').map(Number)
    if (!Number.isInteger(row) || !Number.isInteger(column)) continue
    if (column === 0 && row >= FIRST_BATCH_ROW) rows = Math.max(rows, row + 1)
    if (column >= 3 && row <= 1) columns = Math.max(columns, column + 1)
  }
  for (const key of Object.keys(sheet.snippets ?? {})) {
    const batch = new RegExp(`^${BATCH_SNIPPET}(\\d+)$`).exec(key)
    if (batch) rows = Math.max(rows, Number(batch[1]) + 1)
    const material = new RegExp(`^${MATERIAL_SNIPPET}(\\d+)$`).exec(key)
    if (material) columns = Math.max(columns, Number(material[1]) + 2)
  }
  if (columns > 3) columns = 3 + Math.ceil((columns - 3) / 2) * 2
  return { rows, columns }
}

function borderProfile(sheet: EquipmentSheet, cells: Record<string, string>, styles: Record<string, CellStyle>): Record<string, CellStyle> {
  const limits = profileGridLimits({ ...sheet, cells })
  const next = { ...styles }
  for (let row = 0; row < limits.rows; row += 1) {
    for (let column = 0; column < limits.columns; column += 1) {
      const key = `${row}:${column}`
      next[key] = { ...next[key], ...BOX }
    }
  }
  return next
}

function materialItemColumns(cells: Record<string, string>, snippets: Record<string, string> | undefined): { column: number; itemCode: string }[] {
  const columns = new Map<number, string>()
  for (const [key, raw] of Object.entries(snippets ?? {})) {
    const match = new RegExp(`^${MATERIAL_SNIPPET}(\\d+)$`).exec(key)
    if (!match) continue
    columns.set(Number(match[1]), readStoredMaterial(raw)?.itemCode.trim() ?? '')
  }
  for (const [key, value] of Object.entries(cells)) {
    const [row, column] = key.split(':').map(Number)
    if (row !== 1 || column < 3 || (column - 3) % 2 !== 0) continue
    const text = String(value ?? '').trim()
    if (!text || text === 'Item Code' || columns.get(column)) continue
    columns.set(column, text)
  }
  return [...columns.entries()].map(([column, itemCode]) => ({ column, itemCode })).sort((a, b) => a.column - b.column)
}

function applyMaterialItemCodes(sheet: EquipmentSheet, cells: Record<string, string>, styles: Record<string, CellStyle>, onlyRow?: number): { cells: Record<string, string>; styles: Record<string, CellStyle> } {
  const nextCells = { ...cells }
  const nextStyles = { ...styles }
  const rows = profileBatchRows(sheet, nextCells).filter((row) => onlyRow === undefined || row === onlyRow)
  for (const { column, itemCode } of materialItemColumns(nextCells, sheet.snippets)) {
    if (itemCode) {
      for (const row of rows) {
        const key = `${row}:${column}`
        if (isNotApplicable(sheet.snippets, row, column) || String(nextCells[key] ?? '').trim()) continue
        nextCells[key] = itemCode
        nextStyles[key] = { ...nextStyles[key], ...CENTERED }
      }
    }
    if (onlyRow !== undefined) continue
    nextCells[`1:${column}`] = 'Item Code'
    nextCells[`1:${column + 1}`] = 'Control No.'
    nextStyles[`1:${column}`] = { ...nextStyles[`1:${column}`], ...BOLD }
    nextStyles[`1:${column + 1}`] = { ...nextStyles[`1:${column + 1}`], ...BOLD }
  }
  return { cells: nextCells, styles: nextStyles }
}

export function profileSuppliers(sheet: EquipmentSheet): { name: string; address: string }[] {
  const found = new Map<string, { name: string; address: string }>()
  const consider = (raw?: string) => {
    const entry = readStoredMaterial(raw)
    const name = entry?.supplierName.trim() ?? ''
    if (!name || removedSupplierNames(sheet).has(name.toLowerCase())) return
    const address = entry.supplierAddress.trim()
    const current = found.get(name.toLowerCase())
    if (!current || (!current.address && address)) found.set(name.toLowerCase(), { name, address })
  }
  consider(sheet.snippets?.[HEADER_SNIPPET])
  for (const [key, value] of Object.entries(sheet.snippets ?? {})) {
    if (key.startsWith(MATERIAL_SNIPPET)) consider(value)
    if (key.startsWith(PACKAGING_ROW_SNIPPET)) {
      const stored = readStoredPackaging(value)
      if (stored) consider(JSON.stringify({ description: stored.name, supplierName: stored.supplierName, supplierAddress: stored.supplierAddress, itemCode: '', controlNos: [] }))
    }
  }
  return [...found.values()]
}

function sheetNameForSku(sku: string): string {
  const name = sku.trim().replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '').trim()
  return name.length > 31 ? name.slice(0, 31).trim() : name
}

function orderLines(entry: ProfileBatchEntry): ProfilePoEntry[] {
  if (Array.isArray(entry.orders)) {
    return entry.orders.map((line) => ({
      poControlNo: String(line?.poControlNo ?? '').trim(),
      productCode: String(line?.productCode ?? '').trim(),
      sku: String(line?.sku ?? '').trim(),
    })).filter((line) => line.poControlNo || line.productCode || line.sku)
  }
  if (entry.poControlNo.trim() || entry.productCode.trim() || entry.sku.trim()) {
    return [{ poControlNo: entry.poControlNo.trim(), productCode: entry.productCode.trim(), sku: entry.sku.trim() }]
  }
  return []
}

function withOrders(entry: ProfileBatchEntry): ProfileBatchEntry {
  const orders = orderLines(entry)
  const first = orders[0]
  return {
    ...entry,
    uniqueBatchNo: entry.uniqueBatchNo.trim(),
    moControlNo: entry.moControlNo ?? '',
    orders,
    poControlNo: first?.poControlNo ?? '',
    productCode: first?.productCode ?? '',
    sku: first?.sku ?? '',
    mfgDate: entry.mfgDate ?? '',
    expDate: entry.expDate ?? '',
    fgReleasedDate: entry.fgReleasedDate ?? '',
  }
}

function orderKey(line: ProfilePoEntry): string {
  return `${line.poControlNo.trim().toLowerCase()}|${line.sku.trim().toLowerCase()}|${line.productCode.trim().toLowerCase()}`
}

function mergeBatch(current: ProfileBatchEntry, incoming: ProfileBatchEntry): ProfileBatchEntry {
  const orders = orderLines(current)
  for (const line of orderLines(incoming)) {
    if (orders.some((item) => orderKey(item) === orderKey(line))) continue
    orders.push(line)
  }
  return withOrders({
    ...current,
    ...incoming,
    uniqueBatchNo: incoming.uniqueBatchNo.trim() || current.uniqueBatchNo,
    moControlNo: incoming.moControlNo || current.moControlNo,
    mfgDate: incoming.mfgDate || current.mfgDate,
    expDate: incoming.expDate || current.expDate,
    fgReleasedDate: incoming.fgReleasedDate || current.fgReleasedDate,
    orders,
  })
}

function skuNames(batches: ProfileBatchEntry[]): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const batch of batches) {
    for (const line of orderLines(batch)) {
      const name = sheetNameForSku(line.sku)
      const key = name.toLowerCase()
      if (!name || seen.has(key)) continue
      seen.add(key)
      names.push(name)
    }
  }
  return names
}

function batchForSheet(batch: ProfileBatchEntry, sheetName: string, primary: string): ProfileBatchEntry {
  const orders = orderLines(batch)
  const named = orders.filter((line) => sheetNameForSku(line.sku))
  const match = orders.find((line) => sheetNameForSku(line.sku).toLowerCase() === sheetName.trim().toLowerCase())
  if (match) return withOrders({ ...batch, orders: [match] })
  if (!named.length) return withOrders(batch)
  if (sheetName.trim().toLowerCase() === primary.toLowerCase()) {
    const unscoped = orders.find((line) => !sheetNameForSku(line.sku))
    if (unscoped) return withOrders({ ...batch, orders: [unscoped] })
  }
  return withOrders({ ...batch, orders: [], poControlNo: '', productCode: '', sku: '' })
}

function batchesForSheet(batches: ProfileBatchEntry[], sheetName: string): ProfileBatchEntry[] {
  const names = skuNames(batches)
  if (!names.length) return batches.map((batch) => withOrders(batch))
  return batches.map((batch) => batchForSheet(batch, sheetName, names[0]))
}

function findBatchRow(sheet: EquipmentSheet, uniqueBatchNo: string): number | undefined {
  const wanted = uniqueBatchNo.trim().toLowerCase()
  if (!wanted) return undefined
  return profileBatchRows(sheet, sheet.cells).find((row) => (
    cellText(sheet, row, 0).toLowerCase() === wanted || readProfileBatch(sheet, row).uniqueBatchNo.trim().toLowerCase() === wanted
  ))
}

function collectWorkbookBatches(workbook: EquipmentWorkbook): ProfileBatchEntry[] {
  const order: string[] = []
  const byName = new Map<string, ProfileBatchEntry>()
  for (const sheet of workbook.sheets) {
    for (const row of profileBatchRows(sheet, sheet.cells)) {
      const entry = readProfileBatch(sheet, row)
      const key = entry.uniqueBatchNo.trim().toLowerCase()
      if (!key) continue
      const existing = byName.get(key)
      if (!existing) {
        order.push(key)
        byName.set(key, entry)
        continue
      }
      byName.set(key, mergeBatch(existing, entry))
    }
  }
  return order.map((key) => byName.get(key) as ProfileBatchEntry)
}

export function ensureProfileSkuSheets(workbook: EquipmentWorkbook, batches: ProfileBatchEntry[]): EquipmentWorkbook {
  const names = skuNames(batches)
  if (!names.length) return workbook
  let next = workbook
  const activeId = workbook.activeSheetId
  const first = next.sheets[0]
  if (first && /^sheet\d+$/i.test(first.name) && first.name.toLowerCase() !== names[0].toLowerCase() && !sheetNameError(next, first.id, names[0])) {
    next = renameSheet(next, first.id, names[0])
  }
  for (const name of names) {
    if (next.sheets.some((sheet) => sheet.name.toLowerCase() === name.toLowerCase())) continue
    const source = next.sheets.find((sheet) => sheet.name.toLowerCase() === names[0].toLowerCase()) ?? next.sheets[0]
    if (!source || sheetNameError(next, '', name)) continue
    const copied = copySheet(next, source.id, null)
    const created = copied.sheets.find((sheet) => sheet.id === copied.activeSheetId)
    if (!created) continue
    next = renameSheet(copied, created.id, name)
  }
  return next.sheets.some((sheet) => sheet.id === activeId) ? { ...next, activeSheetId: activeId } : next
}

export function commitProfileBatch(workbook: EquipmentWorkbook, entry: ProfileBatchEntry, row: number | null, previousUniqueBatchNo = ''): EquipmentWorkbook {
  const normalized = withOrders(entry)
  const previous = previousUniqueBatchNo.trim()
    const next = {
      ...workbook,
      sheets: workbook.sheets.map((sheet) => {
        if (row !== null && sheet.id === workbook.activeSheetId) return writeProfileBatch(sheet, row, normalized)
        if (row === null) return addProfileBatch(sheet, normalized)
        const match = findBatchRow(sheet, normalized.uniqueBatchNo) ?? (previous ? findBatchRow(sheet, previous) : undefined)
        return match === undefined ? sheet : writeProfileBatch(sheet, match, normalized)
      }),
    }
  return ensureProfileSkuSheets(next, collectWorkbookBatches(next))
}

export function readProfileBatch(sheet: EquipmentSheet, row: number): ProfileBatchEntry {
  let parsed: Partial<ProfileBatchEntry> = {}
  try {
    const raw = sheet.snippets?.[`${BATCH_SNIPPET}${row}`]
    if (raw) parsed = JSON.parse(raw) as Partial<ProfileBatchEntry>
  } catch {
    parsed = {}
  }
  const storedOrders = Array.isArray(parsed.orders)
    ? parsed.orders.map((line) => ({
      poControlNo: String(line?.poControlNo ?? ''),
      productCode: String(line?.productCode ?? ''),
      sku: String(line?.sku ?? ''),
    }))
    : undefined
  return withOrders({
    uniqueBatchNo: String(parsed.uniqueBatchNo ?? cellText(sheet, row, 0)),
    moControlNo: String(parsed.moControlNo ?? ''),
    poControlNo: String(parsed.poControlNo ?? ''),
    productCode: String(parsed.productCode ?? ''),
    sku: String(parsed.sku ?? ''),
    orders: storedOrders,
    mfgDate: String(parsed.mfgDate ?? ''),
    expDate: String(parsed.expDate ?? ''),
    fgReleasedDate: String(parsed.fgReleasedDate ?? ''),
  })
}

function profileBatchRows(sheet: EquipmentSheet, cells: Record<string, string>): number[] {
  const rows = new Set<number>()
  for (const [key, value] of Object.entries(cells)) {
    const [row, column] = key.split(':').map(Number)
    if (column === 0 && row >= FIRST_BATCH_ROW && String(value ?? '').trim()) rows.add(row)
  }
  for (const key of Object.keys(sheet.snippets ?? {})) {
    const match = new RegExp(`^${BATCH_SNIPPET}(\\d+)$`).exec(key)
    if (!match) continue
    const row = Number(match[1])
    if (row >= FIRST_BATCH_ROW) rows.add(row)
  }
  return [...rows].sort((a, b) => a - b)
}

function storedSectionSheet(productId: string, section: string): EquipmentSheet | null {
  if (!productId.trim()) return null
  const key = storageKey(productId, section)
  const workbook = held?.key === key ? held.workbook : normalizeWorkbook(readAll()[key])
  return workbook?.sheets[0] ?? null
}

function rawMaterialBatches(productId: string): ProfileBatchEntry[] {
  const sheet = storedSectionSheet(productId, 'raw-material')
  if (!sheet) return []
  return profileBatchRows(sheet, sheet.cells).map((row) => readProfileBatch(sheet, row))
}

function readStoredPackaging(raw: string | undefined): ProfilePackagingEntry | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ProfilePackagingEntry>
    const name = String(parsed.name ?? '').trim()
    if (!name) return null
    return {
      name,
      description: String(parsed.description ?? ''),
      itemNo: String(parsed.itemNo ?? ''),
      subItemNo: String(parsed.subItemNo ?? ''),
      supplierName: String(parsed.supplierName ?? ''),
      supplierAddress: String(parsed.supplierAddress ?? ''),
    }
  } catch {
    return null
  }
}

function packagingTextWidth(text: string): number {
  const longest = text.split('\n').reduce((max, line) => Math.max(max, line.trim().length), 0)
  const fitted = Math.ceil(Math.min(longest, 42) * 7.2) + 28
  return Math.max(PACKAGING_NAME_WIDTH, Math.min(520, fitted))
}

function packagingLineCount(text: string, width: number): number {
  const maxChars = Math.max(10, Math.floor((width - 16) / 7.2))
  let lines = 0
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (!words.length) {
      lines += 1
      continue
    }
    let used = 0
    let count = 1
    for (const word of words) {
      if (word.length > maxChars) {
        if (used > 0) count += 1
        count += Math.ceil(word.length / maxChars) - 1
        used = word.length % maxChars || maxChars
        continue
      }
      if (used === 0) used = word.length
      else if (used + 1 + word.length <= maxChars) used += 1 + word.length
      else {
        count += 1
        used = word.length
      }
    }
    lines += count
  }
  return Math.max(1, lines)
}

function packagingItemColumns(sheet: EquipmentSheet): number[] {
  const columns = new Set<number>([1])
  for (const [key, value] of Object.entries(sheet.cells)) {
    const [row, column] = key.split(':').map(Number)
    if (row === 0 && column >= 1 && column % 2 === 1 && String(value ?? '').trim()) columns.add(column)
  }
  return [...columns].sort((a, b) => a - b)
}

export function readProfilePackaging(sheet: EquipmentSheet, row: number): ProfilePackagingEntry | null {
  return readStoredPackaging(sheet.snippets?.[`${PACKAGING_ROW_SNIPPET}${row}`])
}

export function packagingSupplierChoices(productId: string, sheet: EquipmentSheet): { name: string; address: string }[] {
  const found = new Map<string, { name: string; address: string }>()
  const add = (items: { name: string; address: string }[]) => {
    for (const item of items) {
      const key = item.name.toLowerCase()
      const current = found.get(key)
      if (!current || (!current.address && item.address)) found.set(key, item)
    }
  }
  const raw = storedSectionSheet(productId, 'raw-material')
  if (raw) add(profileSuppliers(raw))
  add(profileSuppliers(sheet))
  const removed = removedSupplierNames(sheet)
  return [...found.values()].filter((item) => !removed.has(item.name.toLowerCase()))
}

export function writeProfilePackaging(sheet: EquipmentSheet, row: number, entry: ProfilePackagingEntry): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  if (row < PACKAGING_HEADER_ROWS) throw new Error('Choose a packaging material row.')
  const name = entry.name.trim().toUpperCase()
  if (!name) throw new Error('Packaging Material is required.')
  const description = entry.description.trim().toUpperCase()
  const itemNo = entry.itemNo.trim()
  const subItemNo = entry.subItemNo.trim()
  const shown = [name, description].filter(Boolean).join('\n')
  const itemText = [itemNo, subItemNo].filter(Boolean).join('\n')
  const width = packagingTextWidth(shown)
  const next = ensureSize(sheet, row + 1, sheet.columnCount)
  const cells = { ...next.cells, [`${row}:0`]: shown }
  const styles = { ...next.styles }
  styles[`${row}:0`] = { ...styles[`${row}:0`], ...BOLD, wrap: true }
  for (const column of packagingItemColumns(next)) {
    if (isNotApplicable(next.snippets, row, column)) continue
    const key = `${row}:${column}`
    if (itemText) {
      cells[key] = itemText
      styles[key] = { ...styles[key], ...CENTERED, wrap: true }
    } else delete cells[key]
  }
  const notes = { ...next.notes }
  const supplier = [entry.supplierName.trim(), entry.supplierAddress.trim()].filter(Boolean).join('\n')
  if (supplier) notes[`${row}:0`] = supplier
  else delete notes[`${row}:0`]
  const rowHeight = DEFAULT_ROW_HEIGHT * packagingLineCount(shown, width)
  const sizedRows = writeAxisSize(next.rowHeights, next.rowSizes, row, rowHeight, DEFAULT_ROW_HEIGHT)
  const sizedColumns = writeAxisSize(next.columnWidths, next.colSizes, 0, width, DEFAULT_COL_WIDTH)
  const snippets = {
    ...rememberSupplier(next.snippets, entry.supplierName),
    [`${PACKAGING_ROW_SNIPPET}${row}`]: JSON.stringify({ ...entry, name, description, itemNo, subItemNo }),
  }
  const drafted = { ...next, cells, styles, notes, snippets, columnWidths: sizedColumns.dense, colSizes: sizedColumns.extra }
  return {
    ...drafted,
    rowHeights: sizedRows.dense,
    rowSizes: sizedRows.extra,
    styles: borderProfile(drafted, cells, styles),
  }
}

export function markPackagingItemNotApplicable(sheet: EquipmentSheet, row: number, column: number): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  if (row < PACKAGING_HEADER_ROWS || !isItemCodeColumn(column)) throw new Error('Choose an item number cell.')
  const cells = { ...sheet.cells }
  delete cells[`${row}:${column}`]
  delete cells[`${row}:${column + 1}`]
  const styles = {
    ...sheet.styles,
    [`${row}:${column}`]: { ...sheet.styles[`${row}:${column}`], ...NOT_APPLICABLE },
    [`${row}:${column + 1}`]: { ...sheet.styles[`${row}:${column + 1}`], ...NOT_APPLICABLE },
  }
  return {
    ...sheet,
    cells,
    styles: borderProfile(sheet, cells, styles),
    snippets: { ...sheet.snippets, [notApplicableKey(row, column)]: '1' },
  }
}

export function restorePackagingItem(sheet: EquipmentSheet, row: number, column: number): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  if (row < PACKAGING_HEADER_ROWS || !isItemCodeColumn(column)) throw new Error('Choose an item number cell.')
  const snippets = { ...sheet.snippets }
  delete snippets[notApplicableKey(row, column)]
  const stored = readProfilePackaging(sheet, row)
  const itemText = [stored?.itemNo, stored?.subItemNo].map((item) => item?.trim() ?? '').filter(Boolean).join('\n')
  const cells = { ...sheet.cells }
  if (itemText) cells[`${row}:${column}`] = itemText
  else delete cells[`${row}:${column}`]
  const styles = {
    ...sheet.styles,
    [`${row}:${column}`]: { ...withoutFill(sheet.styles[`${row}:${column}`]), ...CENTERED, wrap: true },
    [`${row}:${column + 1}`]: withoutFill(sheet.styles[`${row}:${column + 1}`]),
  }
  return {
    ...sheet,
    cells,
    styles: borderProfile({ ...sheet, snippets }, cells, styles),
    snippets,
  }
}

export function writePackagingControlNos(sheet: EquipmentSheet, row: number, controlNos: string[], column: number): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  if (row < PACKAGING_HEADER_ROWS || column < 2 || column % 2 !== 0) throw new Error('Choose a control number cell.')
  const values = controlNos.map((item) => item.trim()).filter(Boolean)
  const cells = { ...sheet.cells }
  const key = `${row}:${column}`
  if (values.length) cells[key] = values.join('\n')
  else delete cells[key]
  return {
    ...sheet,
    cells,
    styles: borderProfile(sheet, cells, {
      ...sheet.styles,
      [key]: { ...sheet.styles[key], ...CENTERED, wrap: true },
    }),
  }
}

export function saveRawProfileBatch(productId: string, entry: ProfileBatchEntry, previousUniqueBatchNo = ''): void {
  const book = loadProductSectionWorkbook(productId, 'raw-material')
  const sheet = book.sheets.find((item) => item.id === book.activeSheetId) ?? book.sheets[0]
  const previous = previousUniqueBatchNo.trim()
  const row = previous && sheet ? findBatchRow(sheet, previous) ?? null : null
  saveProductSectionWorkbook(productId, 'raw-material', commitProfileBatch(book, entry, row, previous))
}

export function refreshPackagingSheet(sheet: EquipmentSheet, productId: string): EquipmentSheet {
  return stampPackagingHeader(sheet, batchesForSheet(rawMaterialBatches(productId), sheet.name))
}

export function refreshPackagingWorkbook(workbook: EquipmentWorkbook, productId: string): EquipmentWorkbook {
  const batches = rawMaterialBatches(productId)
  const synced = ensureProfileSkuSheets(workbook, batches)
  return {
    ...synced,
    sheets: synced.sheets.map((sheet) => stampPackagingHeader(sheet, batchesForSheet(batches, sheet.name))),
  }
}

function carryItemCodes(sheet: EquipmentSheet, cells: Record<string, string>, styles: Record<string, CellStyle>, onlyRow?: number): { cells: Record<string, string>; styles: Record<string, CellStyle> } {
  const nextCells = { ...cells }
  const nextStyles = { ...styles }
  for (const row of profileBatchRows(sheet, nextCells)) {
    if (row <= FIRST_BATCH_ROW || (onlyRow !== undefined && row !== onlyRow)) continue
    const key = `${row}:1`
    if (isNotApplicable(sheet.snippets, row, 1) || String(nextCells[key] ?? '').trim()) continue
    let itemCode = ''
    for (let above = row - 1; above >= FIRST_BATCH_ROW; above -= 1) {
      if (isNotApplicable(sheet.snippets, above, 1)) break
      itemCode = String(nextCells[`${above}:1`] ?? '').trim()
      if (itemCode) break
    }
    if (!itemCode) continue
    nextCells[key] = itemCode
    nextStyles[key] = { ...nextStyles[key], ...CENTERED }
  }
  return { cells: nextCells, styles: nextStyles }
}

function notApplicableKey(row: number, column: number): string {
  return `${NA_SNIPPET}${row}:${column}`
}

function isItemCodeColumn(column: number): boolean {
  return column >= 1 && column % 2 === 1
}

function isNotApplicable(snippets: Record<string, string> | undefined, row: number, column: number): boolean {
  return Boolean(snippets?.[notApplicableKey(row, column)])
}

function removedSupplierNames(sheet: EquipmentSheet): Set<string> {
  try {
    const parsed = JSON.parse(sheet.snippets?.[REMOVED_SUPPLIERS] ?? '[]') as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((item) => String(item).trim().toLowerCase()).filter(Boolean))
  } catch {
    return new Set()
  }
}

function rememberSupplier(snippets: Record<string, string> | undefined, name: string): Record<string, string> {
  const next = { ...(snippets ?? {}) }
  const trimmed = name.trim().toLowerCase()
  if (!trimmed || !next[REMOVED_SUPPLIERS]) return next
  try {
    const parsed = JSON.parse(next[REMOVED_SUPPLIERS]) as unknown
    if (!Array.isArray(parsed)) return next
    const kept = parsed.map((item) => String(item).trim().toLowerCase()).filter((item) => item && item !== trimmed)
    if (kept.length) next[REMOVED_SUPPLIERS] = JSON.stringify(kept)
    else delete next[REMOVED_SUPPLIERS]
  } catch {
    delete next[REMOVED_SUPPLIERS]
  }
  return next
}

function sourceItemCode(sheet: EquipmentSheet, column: number): string {
  if (column === 1) return readStoredMaterial(sheet.snippets?.[HEADER_SNIPPET])?.itemCode.trim() ?? ''
  return readStoredMaterial(sheet.snippets?.[`${MATERIAL_SNIPPET}${column}`])?.itemCode.trim() ?? ''
}

function withoutFill(style: CellStyle | undefined): CellStyle {
  const next = { ...(style ?? {}), ...CENTERED }
  delete next.fill
  return next
}

function fittedControlHeight(cells: Record<string, string>, row: number, columns: number): number {
  let lines = 1
  for (let column = 2; column < columns; column += 2) {
    const count = String(cells[`${row}:${column}`] ?? '').split('\n').filter((item) => item.trim()).length
    if (count > lines) lines = count
  }
  return DEFAULT_ROW_HEIGHT * lines
}

function paintNotApplicable(sheet: EquipmentSheet, cells: Record<string, string>, styles: Record<string, CellStyle>): { cells: Record<string, string>; styles: Record<string, CellStyle> } {
  const nextCells = { ...cells }
  const nextStyles = { ...styles }
  for (const key of Object.keys(sheet.snippets ?? {})) {
    const match = new RegExp(`^${NA_SNIPPET}(\\d+):(\\d+)$`).exec(key)
    if (!match) continue
    const row = Number(match[1])
    const column = Number(match[2])
    delete nextCells[`${row}:${column}`]
    delete nextCells[`${row}:${column + 1}`]
    nextStyles[`${row}:${column}`] = { ...nextStyles[`${row}:${column}`], ...NOT_APPLICABLE }
    nextStyles[`${row}:${column + 1}`] = { ...nextStyles[`${row}:${column + 1}`], ...NOT_APPLICABLE }
  }
  return { cells: nextCells, styles: nextStyles }
}

function inheritNotApplicable(sheet: EquipmentSheet, row: number, cells: Record<string, string>, styles: Record<string, CellStyle>, snippets: Record<string, string>): { cells: Record<string, string>; styles: Record<string, CellStyle>; snippets: Record<string, string> } {
  if (row <= FIRST_BATCH_ROW) return { cells, styles, snippets }
  const nextCells = { ...cells }
  const nextStyles = { ...styles }
  const nextSnippets = { ...snippets }
  const columns = [1, ...materialItemColumns(nextCells, nextSnippets).map((item) => item.column)]
  for (const column of columns) {
    if (nextSnippets[notApplicableKey(row, column)] || String(nextCells[`${row}:${column}`] ?? '').trim()) continue
    if (!nextSnippets[notApplicableKey(row - 1, column)]) continue
    nextSnippets[notApplicableKey(row, column)] = '1'
    delete nextCells[`${row}:${column}`]
    delete nextCells[`${row}:${column + 1}`]
    nextStyles[`${row}:${column}`] = { ...nextStyles[`${row}:${column}`], ...NOT_APPLICABLE }
    nextStyles[`${row}:${column + 1}`] = { ...nextStyles[`${row}:${column + 1}`], ...NOT_APPLICABLE }
  }
  return { cells: nextCells, styles: nextStyles, snippets: nextSnippets }
}

export function profileItemNotApplicable(sheet: EquipmentSheet, row: number, column: number): boolean {
  return isNotApplicable(sheet.snippets, row, column)
}

export function markProfileItemNotApplicable(sheet: EquipmentSheet, row: number, column: number): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  if (row < FIRST_BATCH_ROW || !isItemCodeColumn(column)) throw new Error('Choose an item code cell.')
  const cells = { ...sheet.cells }
  delete cells[`${row}:${column}`]
  delete cells[`${row}:${column + 1}`]
  const styles = {
    ...sheet.styles,
    [`${row}:${column}`]: { ...sheet.styles[`${row}:${column}`], ...NOT_APPLICABLE },
    [`${row}:${column + 1}`]: { ...sheet.styles[`${row}:${column + 1}`], ...NOT_APPLICABLE },
  }
  const height = fittedControlHeight(cells, row, profileGridLimits({ ...sheet, cells }).columns)
  const sized = writeAxisSize(sheet.rowHeights, sheet.rowSizes, row, height, DEFAULT_ROW_HEIGHT)
  return {
    ...sheet,
    cells,
    rowHeights: sized.dense,
    rowSizes: sized.extra,
    styles: borderProfile(sheet, cells, styles),
    snippets: { ...sheet.snippets, [notApplicableKey(row, column)]: '1' },
  }
}

export function restoreProfileItemCode(sheet: EquipmentSheet, row: number, column: number): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  if (row < FIRST_BATCH_ROW || !isItemCodeColumn(column)) throw new Error('Choose an item code cell.')
  const snippets = { ...sheet.snippets }
  delete snippets[notApplicableKey(row, column)]
  const cells = { ...sheet.cells }
  const itemCode = sourceItemCode(sheet, column)
  if (itemCode) cells[`${row}:${column}`] = itemCode
  else delete cells[`${row}:${column}`]
  const styles = {
    ...sheet.styles,
    [`${row}:${column}`]: withoutFill(sheet.styles[`${row}:${column}`]),
    [`${row}:${column + 1}`]: withoutFill(sheet.styles[`${row}:${column + 1}`]),
  }
  return {
    ...sheet,
    cells,
    styles: borderProfile({ ...sheet, snippets }, cells, styles),
    snippets,
  }
}

export function removeProfileSupplier(sheet: EquipmentSheet, name: string): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  const trimmed = name.trim().toLowerCase()
  if (!trimmed) throw new Error('Choose a supplier.')
  const removed = removedSupplierNames(sheet)
  removed.add(trimmed)
  return { ...sheet, snippets: { ...sheet.snippets, [REMOVED_SUPPLIERS]: JSON.stringify([...removed]) } }
}

export function writeProfileBatch(sheet: EquipmentSheet, row: number, entry: ProfileBatchEntry): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  if (row < FIRST_BATCH_ROW) throw new Error('Choose a batch row.')
  const uniqueBatchNo = entry.uniqueBatchNo.trim()
  if (!uniqueBatchNo) throw new Error('Unique Batch No. is required.')
  const next = ensureSize(sheet, row + 1, sheet.columnCount)
  const key = `${row}:0`
  const drafted = inheritNotApplicable(
    next,
    row,
    { ...next.cells, [key]: uniqueBatchNo },
    { ...next.styles, [key]: { ...next.styles[key], ...CENTERED } },
    { ...next.snippets, [`${BATCH_SNIPPET}${row}`]: JSON.stringify(withOrders({ ...entry, uniqueBatchNo })) },
  )
  const carried = carryItemCodes({ ...next, snippets: drafted.snippets }, drafted.cells, drafted.styles, row)
  const placed = applyMaterialItemCodes({ ...next, snippets: drafted.snippets }, carried.cells, carried.styles, row)
  const painted = paintNotApplicable({ ...next, snippets: drafted.snippets }, placed.cells, placed.styles)
  return {
    ...next,
    cells: painted.cells,
    styles: borderProfile({ ...next, snippets: drafted.snippets }, painted.cells, painted.styles),
    snippets: drafted.snippets,
  }
}

export function writeProfileControlNos(sheet: EquipmentSheet, row: number, controlNos: string[], column = 2): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  if (row < FIRST_BATCH_ROW || column < 2 || column % 2 !== 0) throw new Error('Choose a batch row.')
  const values = controlNos.map((item) => item.trim()).filter(Boolean)
  const next = ensureSize(sheet, row + 1, sheet.columnCount)
  const key = `${row}:${column}`
  const cells = { ...next.cells }
  if (values.length) cells[key] = values.join('\n')
  else delete cells[key]
  const height = DEFAULT_ROW_HEIGHT * Math.max(1, values.length)
  const sized = writeAxisSize(next.rowHeights, next.rowSizes, row, height, DEFAULT_ROW_HEIGHT)
  return {
    ...next,
    cells,
    rowHeights: sized.dense,
    rowSizes: sized.extra,
    styles: borderProfile(next, cells, {
      ...next.styles,
      [key]: { ...next.styles[key], ...CENTERED, wrap: true, valign: 'top' },
    }),
  }
}

export function addProfileBatch(sheet: EquipmentSheet, entry: ProfileBatchEntry): EquipmentSheet {
  const normalized = withOrders(entry)
  const existing = findBatchRow(sheet, normalized.uniqueBatchNo)
  if (existing !== undefined) return writeProfileBatch(sheet, existing, mergeBatch(readProfileBatch(sheet, existing), normalized))
  let row = FIRST_BATCH_ROW
  while (cellText(sheet, row, 0)) row += 1
  return writeProfileBatch(sheet, row, normalized)
}

export function readProfileHeader(sheet: EquipmentSheet): ProfileMaterialEntry | null {
  return readStoredMaterial(sheet.snippets?.[HEADER_SNIPPET])
}

export function writeProfileHeader(sheet: EquipmentSheet, entry: ProfileMaterialEntry): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  const description = entry.description.trim().toUpperCase()
  if (!description) throw new Error('Material Description is required.')
  const itemCode = entry.itemCode.trim()
  const cells = { ...sheet.cells, '0:1': description }
  const itemRows = new Set(profileBatchRows(sheet, cells))
  itemRows.add(FIRST_BATCH_ROW)
  for (const batchRow of itemRows) {
    if (isNotApplicable(sheet.snippets, batchRow, 1)) continue
    if (itemCode) cells[`${batchRow}:1`] = itemCode
    else delete cells[`${batchRow}:1`]
  }
  const notes = { ...sheet.notes }
  const supplier = [entry.supplierName.trim(), entry.supplierAddress.trim()].filter(Boolean).join('\n')
  if (supplier) notes['0:1'] = supplier
  else delete notes['0:1']
  return {
    ...sheet,
    cells,
    notes,
    styles: borderProfile(sheet, cells, {
      ...sheet.styles,
      '0:1': { ...sheet.styles['0:1'], ...BOLD, wrap: true },
      [`${FIRST_BATCH_ROW}:1`]: { ...sheet.styles[`${FIRST_BATCH_ROW}:1`], ...CENTERED },
      ...Object.fromEntries(profileBatchRows(sheet, cells).filter((batchRow) => batchRow > FIRST_BATCH_ROW).map((batchRow) => [`${batchRow}:1`, { ...sheet.styles[`${batchRow}:1`], ...CENTERED }])),
    }),
    snippets: {
      ...rememberSupplier(sheet.snippets, entry.supplierName),
      [HEADER_SNIPPET]: JSON.stringify({ ...entry, description, itemCode, controlNos: [] }),
    },
  }
}

export function addProfileMaterial(sheet: EquipmentSheet, entry: ProfileMaterialEntry): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  const description = entry.description.trim().toUpperCase()
  if (!description) throw new Error('Material Description is required.')
  let column = 3
  while (cellText(sheet, 0, column)) column += 2
  const controlNos = entry.controlNos.map((item) => item.trim()).filter(Boolean)
  const next = ensureSize(sheet, sheet.rowCount, column + 2)
  const cells = { ...next.cells }
  cells[`0:${column}`] = description
  delete cells[`0:${column + 1}`]
  const itemCode = entry.itemCode.trim()
  cells[`1:${column}`] = 'Item Code'
  cells[`1:${column + 1}`] = 'Control No.'
  const styles = { ...next.styles }
  styles[`0:${column}`] = { ...styles[`0:${column}`], ...BOLD, wrap: true }
  styles[`1:${column}`] = { ...styles[`1:${column}`], ...BOLD }
  styles[`1:${column + 1}`] = { ...styles[`1:${column + 1}`], ...BOLD }
  if (itemCode) {
    for (const batchRow of profileBatchRows(next, cells)) {
      if (isNotApplicable(next.snippets, batchRow, column)) continue
      cells[`${batchRow}:${column}`] = itemCode
      styles[`${batchRow}:${column}`] = { ...styles[`${batchRow}:${column}`], ...CENTERED }
    }
  }
  const notes = { ...next.notes }
  const supplier = [entry.supplierName.trim(), entry.supplierAddress.trim()].filter(Boolean).join('\n')
  if (supplier) notes[`0:${column}`] = supplier
  else delete notes[`0:${column}`]
  return {
    ...next,
    cells,
    styles: borderProfile({ ...next, snippets: { ...next.snippets, [`${MATERIAL_SNIPPET}${column}`]: JSON.stringify({ ...entry, description, controlNos }) } }, cells, styles),
    notes,
    merges: [
      ...(next.merges ?? []).filter((merge) => merge.c2 < column || merge.c1 > column + 1 || merge.r2 < 0 || merge.r1 > 1),
      { r1: 0, c1: column, r2: 0, c2: column + 1 },
    ],
    snippets: {
      ...rememberSupplier(next.snippets, entry.supplierName),
      [`${MATERIAL_SNIPPET}${column}`]: JSON.stringify({ ...entry, description, controlNos }),
    },
  }
}

function materialSetStart(column: number): number {
  return 3 + Math.floor((column - 3) / 2) * 2
}

function shiftCellMap<T>(record: Record<string, T> | undefined, start: number): Record<string, T> {
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(record ?? {})) {
    const [rowText, columnText] = key.split(':')
    const row = Number(rowText)
    const column = Number(columnText)
    if (!Number.isInteger(row) || !Number.isInteger(column)) {
      next[key] = value
      continue
    }
    if (column === start || column === start + 1) continue
    next[`${row}:${column > start ? column - 2 : column}`] = value
  }
  return next
}

export function removeProfileMaterial(sheet: EquipmentSheet, column: number): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  const start = materialSetStart(column)
  if (column < 3 || start !== column) throw new Error('Choose a material column set.')
  const occupied = cellText(sheet, 0, start) || cellText(sheet, 1, start) || cellText(sheet, 1, start + 1) || sheet.snippets?.[`${MATERIAL_SNIPPET}${start}`]
  if (!occupied) throw new Error('Choose a material column set.')
  const snippets: Record<string, string> = {}
  for (const [key, value] of Object.entries(sheet.snippets ?? {})) {
    const retired = new RegExp(`^${NA_SNIPPET}(\\d+):(\\d+)$`).exec(key)
    if (retired) {
      const retiredColumn = Number(retired[2])
      if (retiredColumn === start || retiredColumn === start + 1) continue
      snippets[`${NA_SNIPPET}${retired[1]}:${retiredColumn > start ? retiredColumn - 2 : retiredColumn}`] = value
      continue
    }
    const match = new RegExp(`^${MATERIAL_SNIPPET}(\\d+)$`).exec(key)
    if (!match) {
      snippets[key] = value
      continue
    }
    const at = Number(match[1])
    if (at === start) continue
    snippets[at > start ? `${MATERIAL_SNIPPET}${at - 2}` : key] = value
  }
  const columnWidths = sheet.columnWidths.slice()
  const removed = Math.min(2, Math.max(0, columnWidths.length - start))
  if (removed > 0) {
    columnWidths.splice(start, removed)
    for (let index = 0; index < removed; index += 1) columnWidths.push(DEFAULT_COL_WIDTH)
  }
  const colSizes: Record<string, number> = {}
  for (const [key, value] of Object.entries(sheet.colSizes ?? {})) {
    const at = Number(key)
    if (!Number.isInteger(at) || at === start || at === start + 1) continue
    colSizes[String(at > start ? at - 2 : at)] = value
  }
  return {
    ...sheet,
    cells: shiftCellMap(sheet.cells, start),
    styles: borderProfile({ ...sheet, snippets }, shiftCellMap(sheet.cells, start), shiftCellMap(sheet.styles, start)),
    notes: shiftCellMap(sheet.notes, start),
    links: shiftCellMap(sheet.links, start),
    comments: shiftCellMap(sheet.comments, start),
    checkboxes: shiftCellMap(sheet.checkboxes, start),
    lockedCells: shiftCellMap(sheet.lockedCells, start),
    lists: shiftCellMap(sheet.lists, start),
    columnWidths,
    colSizes: Object.keys(colSizes).length ? colSizes : undefined,
    merges: (sheet.merges ?? []).flatMap((merge) => {
      if (merge.c2 < start) return [merge]
      if (merge.c1 > start + 1) return [{ ...merge, c1: merge.c1 - 2, c2: merge.c2 - 2 }]
      if (merge.c1 >= start) return []
      const c2 = merge.c2 > start + 1 ? merge.c2 - 2 : start - 1
      return c2 >= merge.c1 ? [{ ...merge, c2 }] : []
    }),
    snippets,
  }
}

let held: { key: string; workbook: EquipmentWorkbook } | null = null

function readAll(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function storageKey(productId: string, section: string): string {
  return `${productId}:${section}`
}

export function productSectionHeld(productId: string, section: string): boolean {
  return held?.key === storageKey(productId, section)
}

function requestedFixtureSize(): 'small' | 'medium' | 'large' {
  if (typeof window === 'undefined') return 'small'
  const size = new URLSearchParams(window.location.search).get('sheetSize')
  if (size === 'medium' || size === 'large') return size
  return 'small'
}

export function loadProductSectionWorkbook(productId: string, section: string): EquipmentWorkbook {
  const key = storageKey(productId, section)
  if (held?.key === key) return withProfileHeader(held.workbook, section, productId)
  const workbook = normalizeWorkbook(readAll()[key])
  if (workbook) return withProfileHeader(workbook, section, productId)
  if (spreadsheetFixtureEnabled() && productId.trim().toUpperCase() === SPREADSHEET_FIXTURE_CODE) return fixtureWorkbook(requestedFixtureSize())
  return withProfileHeader(createWorkbook(), section, productId)
}

export function writeProfileEquipmentCell(productId: string, sheetId: string, row: number, column: number, value: string): void {
  const workbook = loadProductSectionWorkbook(productId, EQUIPMENT_SECTION)
  const target = workbook.sheets.find((sheet) => sheet.id === sheetId) ?? workbook.sheets[0]
  if (!target) return
  saveProductSectionWorkbook(productId, EQUIPMENT_SECTION, {
    ...workbook,
    sheets: workbook.sheets.map((sheet) => sheet.id === target.id ? writeEquipmentName(sheet, row, value) : presentEquipmentSheet(sheet)),
  })
}

export function saveProductSectionWorkbook(productId: string, section: string, workbook: EquipmentWorkbook): void {
  const key = storageKey(productId, section)
  const all = readAll()
  all[key] = workbook
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch (error) {
    held = { key, workbook }
    throw error
  }
  if (held?.key === key) held = null
}
