import seed from './equipmentMasterlistSeed.json'
import {
  createSheet,
  createWorkbook,
  DEFAULT_ROW_HEIGHT,
  normalizeWorkbook,
  type CellStyle,
  type EquipmentSheet,
  type EquipmentWorkbook,
} from './equipmentWorkbook'

export const MASTERLIST_COLUMNS = [
  'No.',
  'Equipment',
  'IL Tag No.',
  'Section',
  'Protocol Tracer',
  'Report Tracer',
  'Report Approval Date',
  'Next Review Date',
] as const

const COLUMN_WIDTHS = [56, 340, 120, 140, 230, 230, 160, 180]
const HEADER_FILL = '#d9d2e9'
const BOX: CellStyle = {
  borderTop: true,
  borderRight: true,
  borderBottom: true,
  borderLeft: true,
  borderColor: '#1d2430',
  borderStyle: 'solid',
}
const STORAGE_KEY = 'gxp.vmp.equipment-masterlist.v1'
const APPROVAL_DATE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/
const VMP_REF = /^VMP-EQ-(\d{2})-(\d{3})-(\d{3})([PR])(?:-(\d+(?:\.\d+)?))?$/
const BLANK_TAG = /^(na|no il tag|no tag)$/i

type SeedRow = { [key: string]: string | undefined }
type SeedDepartment = { title: string; sheetName: string; rows: SeedRow[] }

export type MasterlistFlag = {
  department: string
  no: string
  equipment: string
  issue: string
}

const departments = seed as SeedDepartment[]
const OLD_CREAMS = 'CREAMS AND OINTMENT/ COSMETICS DEPARTMENT'
const CREAMS = 'CREAMS AND OINTMENT DEPARTMENT'
const COSMETICS = 'COSMETICS DEPARTMENT'
export const MASTERLIST_SHEET = 'Main Equipment'
export const AUXILIARY_SHEET = 'Auxiliary'
const LEGACY_MAIN_SHEET = 'All Departments'
const LEGACY_AUXILIARY_SHEETS = ['Auxilliary', 'Auxiliary Equipment']
export const AUXILIARY_DEPARTMENTS = [
  'LIQUIDS PRODUCTS MANUFACTURING DEPARTMENT',
  'LIQUIDS PRODUCTS PACKAGING DEPARTMENT',
  'DRY PRODUCTS MANUFACTURING DEPARTMENT',
  'DRY PRODUCTS PACKAGING DEPARTMENT',
  'CREAMS AND OINTMENT DEPARTMENT',
  'COSMETICS DEPARTMENT',
  'TOPICAL SOLUTION FACILITY',
  'SOFTGEL FACILITY',
  'STEROIDS FACILITY',
  'CEPHALOSPHORIN MANUFACTURING PLANT 2',
] as const
const QC_PLANT_2 = 'QUALITY CONTROL Plant 2'
const COSMETIC_EQUIPMENT = new Set(['Gasti 1 Filling Machine', 'Gasti 2 Filling Machine'])
const MOVABLE_DEPARTMENTS = new Set([
  'LIQUIDS PRODUCTS MANUFACTURING DEPARTMENT',
  'DRY PRODUCTS MANUFACTURING DEPARTMENT',
])

export const QC_PLANT_2_SECTIONS = ['Micro', 'Retention/Stab', 'QC']

export type EquipmentRecord = {
  department: string
  equipment: string
  ilTag: string
  section: string
  protocol: string
  report: string
  approval: string
  nextReview: string
  sourceDepartment: string
  sourceNo: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const MONTH_INDEX: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}

export function parseMasterlistDate(value: string): { iso: string; dayKnown: boolean } | null {
  const text = value.trim()
  const full = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(text)
  const monthYear = /^([A-Za-z]+) (\d{4})$/.exec(text)
  const match = full ?? monthYear
  if (!match) return null
  const day = full ? Number(full[1]) : 1
  const month = MONTH_INDEX[(full ? full[2] : monthYear?.[1] ?? '').toLowerCase()]
  const year = Number(full ? full[3] : monthYear?.[2])
  if (month == null || !year || day < 1 || day > 31) return null
  return { iso: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, dayKnown: Boolean(full) }
}

export function formatMasterlistDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const name = MONTHS[(month ?? 1) - 1]
  if (!name || !year || !day) return ''
  return `${String(day).padStart(2, '0')} ${name} ${year}`
}

export function displayMasterlistDate(value: string): string {
  const parsed = parseMasterlistDate(value)
  if (!parsed) return value.trim()
  return formatMasterlistDate(parsed.iso)
}

export function reviewOneYearAfter(approval: string): string {
  const parsed = parseMasterlistDate(approval)
  if (!parsed) return ''
  const [year, month, day] = parsed.iso.split('-').map(Number)
  const next = new Date(Date.UTC(year + 1, month - 1, day))
  return formatMasterlistDate(next.toISOString().slice(0, 10))
}

export function sectionHint(department: string): string {
  if (department === 'LIQUIDS PRODUCTS MANUFACTURING DEPARTMENT') return 'Cubicle number. Use Movable when the equipment does not stay in one cubicle.'
  if (department === 'LIQUIDS PRODUCTS PACKAGING DEPARTMENT' || department === 'DRY PRODUCTS PACKAGING DEPARTMENT') return 'Line number.'
  if (department === 'DRY PRODUCTS MANUFACTURING DEPARTMENT') return 'Room where the equipment stays. Use Movable when it does not stay in one room.'
  if (department === CREAMS || department === COSMETICS) return 'Room and/or packaging line.'
  if (['TOPICAL SOLUTION FACILITY', 'SOFTGEL FACILITY', 'STEROIDS FACILITY', 'CEPHALOSPHORIN MANUFACTURING PLANT 2'].includes(department)) {
    return 'Line for a packaging line, or Room for manufacturing equipment.'
  }
  if (department === QC_PLANT_2) return 'Micro, Retention/Stab, or QC.'
  return 'Section used for this department.'
}

export function sectionUsesMovable(department: string): boolean {
  return MOVABLE_DEPARTMENTS.has(department)
}

export function equipmentMasterlistDepartments(): { title: string; sheetName: string; count: number }[] {
  return departments.map((department) => ({
    title: department.title,
    sheetName: department.sheetName,
    count: department.rows.length,
  }))
}

export function equipmentSheetDepartments(sheetName: string): string[] {
  if (isAuxiliarySheet(sheetName)) return [...AUXILIARY_DEPARTMENTS]
  return departments.map((department) => department.title)
}

const EQUIPMENT_RETURN_KEY = 'gxp.vmp.equipment-return.v1'

export type EquipmentReturnTicket = {
  returnTo: string
  productCode: string
  sheetId: string
  row: number
  column: number
}

export function saveEquipmentReturn(ticket: EquipmentReturnTicket): void {
  sessionStorage.setItem(EQUIPMENT_RETURN_KEY, JSON.stringify(ticket))
}

export function readEquipmentReturn(): EquipmentReturnTicket | null {
  try {
    const raw = sessionStorage.getItem(EQUIPMENT_RETURN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as EquipmentReturnTicket
    if (!parsed?.returnTo || !parsed.productCode || !parsed.sheetId) return null
    return parsed
  } catch {
    return null
  }
}

export function clearEquipmentReturn(): void {
  sessionStorage.removeItem(EQUIPMENT_RETURN_KEY)
}

export function isMainEquipmentSheet(sheetName: string): boolean {
  return sheetName === MASTERLIST_SHEET || sheetName === LEGACY_MAIN_SHEET
}

export function isAuxiliarySheet(sheetName: string): boolean {
  return sheetName === AUXILIARY_SHEET || LEGACY_AUXILIARY_SHEETS.includes(sheetName)
}

export function equipmentMasterlistFlags(): MasterlistFlag[] {
  const flags: MasterlistFlag[] = []
  const tags = new Map<string, { department: string; no: string; equipment: string }[]>()
  for (const department of departments) {
    const reports = new Map<string, { no: string; equipment: string }[]>()
    for (const row of department.rows) {
      const no = row['No.']?.trim() ?? ''
      const equipment = row.Equipment?.trim() ?? ''
      const tag = row['IL Tag No.']?.trim() ?? ''
      const protocol = row['Protocol Tracer']?.trim() ?? ''
      const report = row['Report Tracer']?.trim() ?? ''
      const approval = row['Report Approval Date']?.trim() ?? ''
      const year = row['Revalidation Year']?.trim() ?? ''
      if (approval && !APPROVAL_DATE.test(approval)) {
        flags.push({ department: department.title, no, equipment, issue: `Report approval date needs review: ${approval}` })
      }
      if (year && !/^\d{4}$/.test(year)) {
        flags.push({ department: department.title, no, equipment, issue: `Revalidation year needs review: ${year}` })
      }
      if (protocol && !VMP_REF.test(protocol)) {
        flags.push({ department: department.title, no, equipment, issue: `Protocol tracer needs review: ${protocol}` })
      }
      if (report && !VMP_REF.test(report) && !report.startsWith('ER-EQ-')) {
        flags.push({ department: department.title, no, equipment, issue: `Report tracer needs review: ${report}` })
      }
      const protocolKey = vmpKey(protocol)
      const reportKey = vmpKey(report)
      if (protocolKey && reportKey && protocolKey !== reportKey) {
        flags.push({ department: department.title, no, equipment, issue: `Protocol ${protocol} does not match report ${report}` })
      }
      if (tag && !BLANK_TAG.test(tag.replace(/\n/g, ' '))) {
        const key = tag.replace(/\s+/g, '').toUpperCase()
        const found = tags.get(key) ?? []
        found.push({ department: department.title, no, equipment })
        tags.set(key, found)
      }
      if (report) {
        const found = reports.get(report) ?? []
        found.push({ no, equipment })
        reports.set(report, found)
      }
    }
    for (const [report, rows] of reports) {
      if (rows.length < 2) continue
      flags.push({
        department: department.title,
        no: rows[0]?.no ?? '',
        equipment: rows[0]?.equipment ?? '',
        issue: `Report tracer ${report} is shared by ${rows.length} records`,
      })
    }
  }
  for (const [tag, rows] of tags) {
    if (rows.length < 2) continue
    flags.push({
      department: rows.map((row) => row.department).join('; '),
      no: rows.map((row) => row.no).join(', '),
      equipment: rows.map((row) => row.equipment).join('; '),
      issue: `IL Tag ${tag} is used ${rows.length} times`,
    })
  }
  return flags
}

export function buildEquipmentMasterlist(): EquipmentWorkbook {
  const workbook = createWorkbook()
  workbook.name = 'Equipment Masterlist'
  const sheet = blankSheet(MASTERLIST_SHEET, departments.map((department) => ({ title: department.title, rows: department.rows.map((row) => ({ ...row })) })))
  const auxiliary = blankSheet(AUXILIARY_SHEET, AUXILIARY_DEPARTMENTS.map((title) => ({ title, rows: [] })))
  workbook.sheets = [sheet, auxiliary]
  workbook.activeSheetId = sheet.id
  return workbook
}

export function loadEquipmentMasterlist(): EquipmentWorkbook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const stored = raw ? normalizeWorkbook(JSON.parse(raw)) : null
    if (stored) return presentMasterlist(stored)
  } catch {
    return buildEquipmentMasterlist()
  }
  return buildEquipmentMasterlist()
}

export function equipmentRecordFromSheet(sheet: EquipmentSheet, row: number): EquipmentRecord {
  let department = departments[0]?.title ?? ''
  for (let index = row; index >= 0; index -= 1) {
    const head = sheet.cells[`${index}:0`]?.trim() ?? ''
    const equipment = sheet.cells[`${index}:1`]?.trim() ?? ''
    if (head && head !== 'No.' && !equipment) {
      department = head === OLD_CREAMS ? CREAMS : head
      break
    }
  }
  const equipment = sheet.cells[`${row}:1`]?.trim() ?? ''
  const no = sheet.cells[`${row}:0`]?.trim() ?? ''
  const isData = Boolean(equipment) && no !== 'No.'
  return {
    department,
    equipment: isData ? equipment : '',
    ilTag: isData ? sheet.cells[`${row}:2`] ?? '' : '',
    section: isData ? sheet.cells[`${row}:3`] ?? '' : '',
    protocol: isData ? sheet.cells[`${row}:4`] ?? '' : '',
    report: isData ? sheet.cells[`${row}:5`] ?? '' : '',
    approval: isData ? sheet.cells[`${row}:6`] ?? '' : '',
    nextReview: isData ? reviewText(sheet.cells[`${row}:7`] ?? '', sheet.cells[`${row}:8`] ?? '') : '',
    sourceDepartment: isData ? department : '',
    sourceNo: isData ? no : '',
  }
}

export function applyEquipmentRecord(workbook: EquipmentWorkbook, record: EquipmentRecord, asNew: boolean, sheetName = MASTERLIST_SHEET, fromSheet = sheetName): EquipmentWorkbook {
  const department = record.department.trim()
  const equipment = record.equipment.trim()
  const ilTag = record.ilTag.trim()
  if (!department) throw new Error('Choose a department.')
  if (!equipment) throw new Error('Enter the equipment name.')
  if (!ilTag) throw new Error('Enter the IL Tag No., or the Equipment ID when no IL tag is assigned yet.')
  if (department === QC_PLANT_2 && !QC_PLANT_2_SECTIONS.includes(record.section.trim()) && record.section.trim() !== 'Plant 2') {
    throw new Error('Section for Quality Control Plant 2 must be Micro, Retention/Stab, or QC.')
  }
  let working = workbook
  const moved = !asNew && Boolean(record.sourceNo) && !sameEquipmentSheet(fromSheet, sheetName)
  if (moved) {
    const origin = findNamedSheet(working, fromSheet)
    if (origin) {
      const originBlocks = blocksFor(origin)
      const originBlock = originBlocks.find((block) => block.title === record.sourceDepartment)
      const originIndex = originBlock?.rows.findIndex((row) => row['No.'] === record.sourceNo) ?? -1
      if (originBlock && originIndex >= 0) {
        originBlock.rows.splice(originIndex, 1)
        renumber(originBlock.rows)
        working = putSheet(working, origin, originBlocks)
      }
    }
  }
  const current = findNamedSheet(working, sheetName) ?? working.sheets[0]
  if (!current) throw new Error('The equipment sheet is missing.')
  const blocks = blocksFor(current)
  const target = blocks.find((block) => block.title === department)
  if (!target) throw new Error('Choose a department.')
  const nextRow: SeedRow = {
    Equipment: equipment,
    'IL Tag No.': ilTag,
    Section: record.section.trim(),
    'Protocol Tracer': record.protocol.trim(),
    'Report Tracer': record.report.trim(),
    'Report Approval Date': record.approval.trim(),
    'Next Review Date': record.nextReview.trim(),
  }
  const source = blocks.find((block) => block.title === record.sourceDepartment)
  const sourceIndex = source?.rows.findIndex((row) => row['No.'] === record.sourceNo) ?? -1
  if (!moved && !asNew && source && sourceIndex >= 0) {
    if (source === target) source.rows[sourceIndex] = nextRow
    else {
      source.rows.splice(sourceIndex, 1)
      target.rows.push(nextRow)
      renumber(source.rows)
    }
  } else target.rows.push(nextRow)
  renumber(target.rows)
  return putSheet(working, current, blocks)
}

export function deleteEquipmentRecord(workbook: EquipmentWorkbook, record: EquipmentRecord, reason: string, sheetName = MASTERLIST_SHEET): EquipmentWorkbook {
  if (!reason.trim()) throw new Error('Enter the reason for deletion.')
  const current = findNamedSheet(workbook, sheetName) ?? workbook.sheets[0]
  if (!current) throw new Error('The equipment sheet is missing.')
  const blocks = blocksFor(current)
  const source = blocks.find((block) => block.title === record.sourceDepartment)
  const sourceIndex = source?.rows.findIndex((row) => row['No.'] === record.sourceNo) ?? -1
  if (!source || sourceIndex < 0) throw new Error('Choose an equipment record to delete.')
  source.rows.splice(sourceIndex, 1)
  renumber(source.rows)
  return putSheet(workbook, current, blocks)
}

export function filterEquipmentMasterlist(workbook: EquipmentWorkbook, query: string): EquipmentWorkbook {
  const needle = query.trim().toLowerCase()
  const current = workbook.sheets.find((sheet) => sheet.id === workbook.activeSheetId) ?? workbook.sheets[0]
  if (!needle || !current) return workbook
  const blocks = readBlocks(current).map((block) => ({
    title: block.title,
    rows: block.rows
      .filter((row) => (row.Equipment ?? '').toLowerCase().includes(needle) || (row['IL Tag No.'] ?? '').toLowerCase().includes(needle))
      .sort((a, b) => (a.Equipment ?? '').localeCompare(b.Equipment ?? '', undefined, { numeric: true })),
  })).filter((block) => block.rows.length)
  return putSheet(workbook, current, blocks)
}

export function isEquipmentEntryRow(sheet: EquipmentSheet, row: number): boolean {
  const head = sheet.cells[`${row}:0`]?.trim() ?? ''
  const equipment = sheet.cells[`${row}:1`]?.trim() ?? ''
  if (departments.some((department) => department.title === head) || head === OLD_CREAMS) return true
  return Boolean(equipment) && head !== 'No.'
}

function putSheet(workbook: EquipmentWorkbook, current: EquipmentSheet, blocks: Array<{ title: string; rows: SeedRow[] }>): EquipmentWorkbook {
  const sheet = blankSheet(isAuxiliarySheet(current.name) ? AUXILIARY_SHEET : isMainEquipmentSheet(current.name) ? MASTERLIST_SHEET : current.name, blocks)
  sheet.id = current.id
  const sheets = workbook.sheets.map((item) => item.id === current.id ? sheet : item)
  return { ...workbook, name: 'Equipment Masterlist', sheets, activeSheetId: current.id }
}

function blankSheet(name: string, blocks: Array<{ title: string; rows: SeedRow[] }>, rows = 120): EquipmentSheet {
  const sheet = createSheet(name, rows, MASTERLIST_COLUMNS.length)
  sheet.showFormulaBar = false
  writeBlocks(sheet, blocks)
  return sheet
}

function blocksFor(sheet: EquipmentSheet): Array<{ title: string; rows: SeedRow[] }> {
  const titles = isAuxiliarySheet(sheet.name) ? AUXILIARY_DEPARTMENTS : departments.map((department) => department.title)
  const blocks = readBlocks(sheet)
  return ensureDepartments(isAuxiliarySheet(sheet.name) ? blocks : migrateCosmetics(blocks), titles)
}

export function saveEquipmentMasterlist(workbook: EquipmentWorkbook): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workbook))
}

function writeDepartment(sheet: EquipmentSheet, row: number, department: SeedDepartment, single: boolean): number {
  writeCell(sheet, row, 0, department.title, { ...BOX, bold: true, align: 'center', fontSize: 14 })
  for (let column = 1; column < MASTERLIST_COLUMNS.length; column += 1) {
    writeCell(sheet, row, column, '', { ...BOX, bold: true, align: 'center' })
  }
  sheet.merges = [...(sheet.merges ?? []), { r1: row, c1: 0, r2: row, c2: MASTERLIST_COLUMNS.length - 1 }]
  sheet.rowHeights[row] = 28
  const header = row + 1
  MASTERLIST_COLUMNS.forEach((label, column) => {
    writeCell(sheet, header, column, label, { ...BOX, bold: true, align: 'center', fill: HEADER_FILL })
  })
  department.rows.forEach((record, index) => {
    const at = header + 1 + index
    MASTERLIST_COLUMNS.forEach((label, column) => {
      const value = cellValue(record, label)
      writeCell(sheet, at, column, value, {
        ...BOX,
        align: column === 1 ? 'left' : 'center',
        wrap: value.includes('\n'),
        valign: 'middle',
      })
      if (value.includes('\n')) sheet.rowHeights[at] = Math.max(sheet.rowHeights[at] ?? 24, 22 * value.split('\n').length)
    })
  })
  sheet.columnWidths = COLUMN_WIDTHS.slice()
  const next = header + 1 + department.rows.length + (single ? 0 : 1)
  while (sheet.rowHeights.length < next) sheet.rowHeights.push(DEFAULT_ROW_HEIGHT)
  return next
}

function presentMasterlist(stored: EquipmentWorkbook): EquipmentWorkbook {
  const current = stored.sheets.find((sheet) => isMainEquipmentSheet(sheet.name)) ?? stored.sheets.find((sheet) => !isAuxiliarySheet(sheet.name)) ?? stored.sheets[0]
  if (!current) return buildEquipmentMasterlist()
  const blocks = ensureDepartments(migrateCosmetics(readBlocks(current)), departments.map((department) => department.title))
  if (!blocks.some((block) => block.rows.length)) return buildEquipmentMasterlist()
  const sheet = blankSheet(MASTERLIST_SHEET, blocks)
  sheet.id = current.id
  const storedAuxiliary = stored.sheets.find((item) => isAuxiliarySheet(item.name))
  const auxiliary = blankSheet(AUXILIARY_SHEET, ensureDepartments(storedAuxiliary ? readBlocks(storedAuxiliary) : [], AUXILIARY_DEPARTMENTS))
  if (storedAuxiliary) auxiliary.id = storedAuxiliary.id
  const activeSheetId = stored.activeSheetId === auxiliary.id ? auxiliary.id : sheet.id
  return { ...stored, name: 'Equipment Masterlist', sheets: [sheet, auxiliary], activeSheetId }
}

function readBlocks(sheet: EquipmentSheet): Array<{ title: string; rows: SeedRow[] }> {
  const known = new Set([...departments.map((department) => department.title), OLD_CREAMS])
  const blocks: Array<{ title: string; rows: SeedRow[] }> = []
  let current: { title: string; rows: SeedRow[] } | null = null
  for (let row = 0; row < sheet.rowCount; row += 1) {
    const head = sheet.cells[`${row}:0`]?.trim() ?? ''
    const equipment = sheet.cells[`${row}:1`]?.trim() ?? ''
    if (known.has(head)) {
      current = { title: head === OLD_CREAMS ? CREAMS : head, rows: [] }
      blocks.push(current)
      continue
    }
    if (!current || head === 'No.' || !equipment) continue
    current.rows.push({
      'No.': head,
      Equipment: sheet.cells[`${row}:1`] ?? '',
      'IL Tag No.': sheet.cells[`${row}:2`] ?? '',
      Section: sheet.cells[`${row}:3`] ?? '',
      'Protocol Tracer': sheet.cells[`${row}:4`] ?? '',
      'Report Tracer': sheet.cells[`${row}:5`] ?? '',
      'Report Approval Date': sheet.cells[`${row}:6`] ?? '',
      'Next Review Date': reviewText(sheet.cells[`${row}:7`] ?? '', sheet.cells[`${row}:8`] ?? ''),
    })
  }
  return blocks
}

function migrateCosmetics(blocks: Array<{ title: string; rows: SeedRow[] }>): Array<{ title: string; rows: SeedRow[] }> {
  const creams = blocks.find((block) => block.title === CREAMS)
  if (!creams) return blocks
  const moved = creams.rows.filter((row) => COSMETIC_EQUIPMENT.has(row.Equipment?.trim() ?? ''))
  if (!moved.length) return blocks
  creams.rows = creams.rows.filter((row) => !COSMETIC_EQUIPMENT.has(row.Equipment?.trim() ?? ''))
  renumber(creams.rows)
  const cosmetics = blocks.find((block) => block.title === COSMETICS) ?? { title: COSMETICS, rows: [] }
  if (!blocks.includes(cosmetics)) blocks.splice(blocks.indexOf(creams) + 1, 0, cosmetics)
  for (const row of moved) {
    if (!cosmetics.rows.some((item) => item.Equipment === row.Equipment && item['IL Tag No.'] === row['IL Tag No.'])) cosmetics.rows.push(row)
  }
  renumber(cosmetics.rows)
  return blocks
}

function ensureDepartments(blocks: Array<{ title: string; rows: SeedRow[] }>, titles: readonly string[]): Array<{ title: string; rows: SeedRow[] }> {
  const byTitle = new Map(blocks.map((block) => [block.title, block]))
  return titles.map((title) => byTitle.get(title) ?? { title, rows: [] })
}

function renumber(rows: SeedRow[]): void {
  rows.forEach((row, index) => {
    row['No.'] = String(index + 1)
  })
}

function writeBlocks(sheet: EquipmentSheet, blocks: Array<{ title: string; rows: SeedRow[] }>): void {
  let row = 0
  blocks.forEach((block, index) => {
    row = writeDepartment(sheet, row, { title: block.title, sheetName: '', rows: block.rows }, index === blocks.length - 1)
  })
  sheet.rowCount = row
  sheet.rowHeights = sheet.rowHeights.slice(0, row)
}

function writeCell(sheet: EquipmentSheet, row: number, column: number, value: string, style: CellStyle): void {
  if (value) sheet.cells[`${row}:${column}`] = value
  sheet.styles[`${row}:${column}`] = style
}

function cellValue(record: SeedRow, label: string): string {
  if (label === 'Next Review Date') return displayMasterlistDate(record['Next Review Date'] || reviewText(record['Revalidation Month'] ?? '', record['Revalidation Year'] ?? ''))
  if (label === 'Report Approval Date') return displayMasterlistDate(record[label] ?? '')
  return record[label]?.trim() ?? ''
}

function reviewText(month: string, year: string): string {
  const nextMonth = month.trim()
  const nextYear = year.trim()
  if (/^\d{4}$/.test(nextYear)) return `${nextMonth} ${nextYear}`.trim()
  return nextMonth
}

function findNamedSheet(workbook: EquipmentWorkbook, name: string): EquipmentSheet | undefined {
  return workbook.sheets.find((sheet) => sameEquipmentSheet(sheet.name, name))
}

function sameEquipmentSheet(left: string, right: string): boolean {
  if (isAuxiliarySheet(left) && isAuxiliarySheet(right)) return true
  if (isMainEquipmentSheet(left) && isMainEquipmentSheet(right)) return true
  return left === right
}

function vmpKey(value: string): string | null {
  const match = VMP_REF.exec(value.trim())
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}
