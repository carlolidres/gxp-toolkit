export const DEFAULT_ROWS = 100
export const DEFAULT_COLS = 26
export const MIN_ROWS = 20
export const MIN_COLS = 8
export const EXCEL_ROWS = 1_048_576
export const EXCEL_COLS = 16_384
export const MAX_ROWS = EXCEL_ROWS
export const MAX_COLS = EXCEL_COLS
export const DEFAULT_COL_WIDTH = 104
export const DEFAULT_ROW_HEIGHT = 24

export type EquipmentAuditAction =
  | 'CELL_UPDATED'
  | 'ROW_INSERTED'
  | 'ROW_DELETED'
  | 'COLUMN_INSERTED'
  | 'COLUMN_DELETED'
  | 'SHEET_CREATED'
  | 'SHEET_RENAMED'
  | 'SHEET_DELETED'
  | 'SHEET_DUPLICATED'
  | 'SHEET_MOVED'
  | 'SHEET_HIDDEN'
  | 'SHEET_UNHIDDEN'
  | 'SHEET_COLOR'
  | 'SHEET_PROTECTED'

export type EquipmentAuditEvent = {
  id: string
  at: string
  actor: string
  action: EquipmentAuditAction
  sheetId: string
  sheetName: string
  range: string | null
  oldValue: string | null
  newValue: string | null
}

export type SheetProtection = {
  locked: boolean
  allowEditCells: boolean
  allowFormat: boolean
  allowInsert: boolean
  allowDelete: boolean
}

export type CellNumberFormat = 'general' | 'text' | 'number' | 'percent' | 'currency' | 'date' | 'time' | 'scientific'
export type CellStyle = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  align?: 'left' | 'center' | 'right'
  valign?: 'top' | 'middle' | 'bottom'
  wrap?: boolean
  wrapMode?: 'overflow' | 'wrap' | 'clip'
  fill?: string
  format?: CellNumberFormat
  decimals?: number
  currency?: string
  fontFamily?: string
  fontSize?: number
  color?: string
  rotate?: number
  borderTop?: boolean
  borderRight?: boolean
  borderBottom?: boolean
  borderLeft?: boolean
  borderColor?: string
  borderStyle?: 'solid' | 'dashed' | 'dotted'
}
export type SheetFilter = {
  column: number
  headerRow: number
  values: string[] | null
  fill?: string | null
  fontColor?: string | null
}
export type MergeRange = { r1: number; c1: number; r2: number; c2: number }

export function mergesTouching(merges: MergeRange[], row1: number, col1: number, row2: number, col2: number): MergeRange[] {
  const r1 = Math.min(row1, row2)
  const r2 = Math.max(row1, row2)
  const c1 = Math.min(col1, col2)
  const c2 = Math.max(col1, col2)
  return merges.filter((merge) => !(merge.r2 < r1 || merge.r1 > r2 || merge.c2 < c1 || merge.c1 > c2))
}

export type MergeMode = 'all' | 'h' | 'v'

function orderedBox(row1: number, col1: number, row2: number, col2: number) {
  return {
    r1: Math.min(row1, row2),
    r2: Math.max(row1, row2),
    c1: Math.min(col1, col2),
    c2: Math.max(col1, col2),
  }
}

function mergePieces(row1: number, col1: number, row2: number, col2: number, mode: MergeMode): MergeRange[] {
  const { r1, r2, c1, c2 } = orderedBox(row1, col1, row2, col2)
  if (mode === 'h') {
    if (c1 === c2) return []
    const pieces: MergeRange[] = []
    for (let row = r1; row <= r2; row += 1) pieces.push({ r1: row, c1, r2: row, c2 })
    return pieces
  }
  if (mode === 'v') {
    if (r1 === r2) return []
    const pieces: MergeRange[] = []
    for (let column = c1; column <= c2; column += 1) pieces.push({ r1, c1: column, r2, c2: column })
    return pieces
  }
  if (r1 === r2 && c1 === c2) return []
  return [{ r1, c1, r2, c2 }]
}

export function mergeMenuState(merges: MergeRange[], row1: number, col1: number, row2: number, col2: number) {
  const { r1, r2, c1, c2 } = orderedBox(row1, col1, row2, col2)
  const merged = mergesTouching(merges, r1, c1, r2, c2).length > 0
  return {
    canMerge: (r1 !== r2 || c1 !== c2) && !merged,
    canMergeHorizontal: c1 !== c2 && !merged,
    canMergeVertical: r1 !== r2 && !merged,
    canUnmerge: merged,
  }
}

export function mergeDiscardCount(sheet: EquipmentSheet, row1: number, col1: number, row2: number, col2: number, mode: MergeMode): number {
  let count = 0
  for (const piece of mergePieces(row1, col1, row2, col2, mode)) {
    for (let row = piece.r1; row <= piece.r2; row += 1) {
      for (let column = piece.c1; column <= piece.c2; column += 1) {
        if (row === piece.r1 && column === piece.c1) continue
        if ((sheet.cells[cellKey(row, column)] ?? '').trim()) count += 1
      }
    }
  }
  return count
}

export function mergeCells(sheet: EquipmentSheet, row1: number, col1: number, row2: number, col2: number, mode: MergeMode): EquipmentSheet {
  const state = mergeMenuState(sheet.merges ?? [], row1, col1, row2, col2)
  const allowed = mode === 'h' ? state.canMergeHorizontal : mode === 'v' ? state.canMergeVertical : state.canMerge
  if (!allowed) return sheet
  let next = sheet
  for (const piece of mergePieces(row1, col1, row2, col2, mode)) {
    for (let row = piece.r1; row <= piece.r2; row += 1) {
      for (let column = piece.c1; column <= piece.c2; column += 1) {
        if (row === piece.r1 && column === piece.c1) continue
        if (next.cells[cellKey(row, column)]) next = setCellValue(next, row, column, '')
      }
    }
  }
  return { ...next, merges: [...(next.merges ?? []), ...mergePieces(row1, col1, row2, col2, mode)] }
}

export function unmergeCells(sheet: EquipmentSheet, row1: number, col1: number, row2: number, col2: number): EquipmentSheet {
  const { r1, r2, c1, c2 } = orderedBox(row1, col1, row2, col2)
  if (!mergeMenuState(sheet.merges ?? [], r1, c1, r2, c2).canUnmerge) return sheet
  return {
    ...sheet,
    merges: (sheet.merges ?? []).filter((merge) => merge.r2 < r1 || merge.r1 > r2 || merge.c2 < c1 || merge.c1 > c2),
  }
}

export type FilterView = { name: string; filter: SheetFilter }

export type EquipmentSheet = {
  id: string
  name: string
  rowCount: number
  columnCount: number
  cells: Record<string, string>
  columnWidths: number[]
  rowHeights: number[]
  colSizes?: Record<string, number>
  rowSizes?: Record<string, number>
  hidden: boolean
  tabColor: string | null
  protection: SheetProtection | null
  styles: Record<string, CellStyle>
  notes: Record<string, string>
  links: Record<string, string>
  freezeRows: number
  freezeCols: number
  showGridlines: boolean
  showHeadings: boolean
  showFormulaBar: boolean
  filter: SheetFilter | null
  comments: Record<string, string>
  namedRanges: Record<string, string>
  lists: Record<string, string[]>
  checkboxes: Record<string, boolean>
  merges: MergeRange[]
  filterViews: FilterView[]
  snippets: Record<string, string>
  lockedCells: Record<string, boolean>
}

export const SHEET_NAME_MAX = 31
export const SHEET_TAB_COLORS = [
  '#c00000',
  '#ff0000',
  '#ffc000',
  '#ffff00',
  '#92d050',
  '#00b050',
  '#00b0f0',
  '#0070c0',
  '#002060',
  '#7030a0',
] as const

export type EquipmentWorkbook = {
  id: string
  name: string
  activeSheetId: string
  sheets: EquipmentSheet[]
}

export function cellKey(row: number, column: number): string {
  return `${row}:${column}`
}

export function columnLabel(index: number): string {
  let n = index + 1
  let label = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    label = String.fromCharCode(65 + rem) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

export function parseColumnLabel(label: string): number {
  let n = 0
  for (const ch of label.toUpperCase()) {
    if (ch < 'A' || ch > 'Z') return -1
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

export function addressLabel(row: number, column: number): string {
  return `${columnLabel(column)}${row + 1}`
}

export type SizeMark = [number, number]

export function sizeMarks(dense: number[] | undefined, extra: Record<string, number> | undefined, fallback: number, count: number): SizeMark[] {
  const marks: SizeMark[] = []
  const listed = dense ?? []
  const limit = Math.min(listed.length, count)
  for (let index = 0; index < limit; index += 1) {
    const size = listed[index]
    if (typeof size === 'number' && size !== fallback) marks.push([index, size])
  }
  if (extra) {
    for (const [key, size] of Object.entries(extra)) {
      const index = Number(key)
      if (!Number.isInteger(index) || index < listed.length || index < 0 || index >= count) continue
      if (typeof size === 'number' && size !== fallback) marks.push([index, size])
    }
  }
  marks.sort((left, right) => left[0] - right[0])
  return marks
}

export function axisSize(dense: number[] | undefined, extra: Record<string, number> | undefined, index: number, fallback: number): number {
  if ((dense?.length ?? 0) <= index && extra && typeof extra[index] === 'number') return extra[index]
  const listed = dense?.[index]
  return typeof listed === 'number' ? listed : fallback
}

export function writeAxisSize(
  dense: number[],
  extra: Record<string, number> | undefined,
  index: number,
  value: number,
  fallback: number,
): { dense: number[]; extra: Record<string, number> } {
  if (index < dense.length) {
    const next = dense.slice()
    next[index] = value
    return { dense: next, extra: { ...(extra ?? {}) } }
  }
  const map = { ...(extra ?? {}) }
  if (value === fallback) delete map[index]
  else map[index] = value
  return { dense, extra: map }
}

export function offsetAt(marks: SizeMark[], index: number, fallback: number): number {
  let extra = 0
  for (const [at, size] of marks) {
    if (at >= index) break
    extra += size - fallback
  }
  return index * fallback + extra
}

export function indexAt(marks: SizeMark[], offset: number, fallback: number, count: number): number {
  if (count <= 1) return 0
  const target = Math.max(0, offset)
  let cursor = 0
  let previous = 0
  for (const [at, size] of marks) {
    const gap = (at - previous) * fallback
    if (cursor + gap > target) return Math.min(count - 1, previous + Math.floor((target - cursor) / fallback))
    cursor += gap
    if (cursor + size > target) return Math.min(count - 1, at)
    cursor += size
    previous = at + 1
  }
  return Math.min(count - 1, previous + Math.floor(Math.max(0, target - cursor) / fallback))
}

export function visibleIndexes(marks: SizeMark[], scroll: number, viewport: number, fallback: number, count: number, buffer = 8) {
  const start = Math.max(0, indexAt(marks, scroll, fallback, count) - buffer)
  const end = Math.min(count - 1, indexAt(marks, scroll + Math.max(0, viewport), fallback, count) + buffer)
  return { start, end }
}

export function clampScroll(offset: number, total: number, view: number): number {
  const max = Math.max(0, total - Math.max(0, view))
  return Math.min(max, Math.max(0, offset))
}

function thumbSize(total: number, view: number, track: number): number {
  return Math.max(18, Math.min(track, (view / total) * track))
}

export function thumbMetrics(total: number, view: number, offset: number, track: number): { size: number; pos: number } | null {
  if (!(total > view) || track <= 0 || view <= 0) return null
  const size = thumbSize(total, view, track)
  const travel = Math.max(1, track - size)
  const range = Math.max(1, total - view)
  return { size, pos: (clampScroll(offset, total, view) / range) * travel }
}

export function offsetForThumb(pos: number, total: number, view: number, track: number): number {
  if (!(total > view) || track <= 0 || view <= 0) return 0
  const travel = Math.max(1, track - thumbSize(total, view, track))
  const range = Math.max(0, total - view)
  return clampScroll((Math.max(0, pos) / travel) * range, total, view)
}

export function axisIndexes(
  span: { start: number; end: number },
  frozen: number,
  merges: Array<{ r1: number; c1: number; r2: number; c2: number }> | undefined,
  axis: 'row' | 'column',
  otherStart: number,
  otherEnd: number,
): number[] {
  const indexes: number[] = []
  const seen = new Set<number>()
  const add = (index: number) => {
    if (index < 0 || seen.has(index)) return
    seen.add(index)
    indexes.push(index)
  }
  for (let index = 0; index < frozen; index += 1) add(index)
  for (let index = span.start; index <= span.end; index += 1) {
    if (index >= frozen) add(index)
  }
  for (const merge of merges ?? []) {
    const start = axis === 'row' ? merge.r1 : merge.c1
    const end = axis === 'row' ? merge.r2 : merge.c2
    const other1 = axis === 'row' ? merge.c1 : merge.r1
    const other2 = axis === 'row' ? merge.c2 : merge.r2
    if (end < span.start || start > span.end || other2 < otherStart || other1 > otherEnd) continue
    add(start)
  }
  indexes.sort((left, right) => left - right)
  return indexes
}

export function usedCorner(sheet: { cells: Record<string, string>; styles?: Record<string, unknown>; notes?: Record<string, string>; comments?: Record<string, string>; merges?: Array<{ r2: number; c2: number }> }): { row: number; column: number } {
  let row = 0
  let column = 0
  const consider = (key: string) => {
    const [itemRow, itemColumn] = key.split(':').map(Number)
    if (Number.isFinite(itemRow)) row = Math.max(row, itemRow)
    if (Number.isFinite(itemColumn)) column = Math.max(column, itemColumn)
  }
  Object.keys(sheet.cells).forEach(consider)
  Object.keys(sheet.styles ?? {}).forEach(consider)
  Object.keys(sheet.notes ?? {}).forEach(consider)
  Object.keys(sheet.comments ?? {}).forEach(consider)
  for (const merge of sheet.merges ?? []) {
    row = Math.max(row, merge.r2)
    column = Math.max(column, merge.c2)
  }
  return { row: Math.min(MAX_ROWS - 1, Math.max(0, row)), column: Math.min(MAX_COLS - 1, Math.max(0, column)) }
}

function shiftSizeMap(map: Record<string, number> | undefined, index: number, delta: number): Record<string, number> | undefined {
  if (!map) return map
  const next: Record<string, number> = {}
  for (const [key, value] of Object.entries(map)) {
    const at = Number(key)
    if (delta < 0 && at === index) continue
    const moved = at >= index ? at + delta : at
    if (moved >= 0) next[String(moved)] = value
  }
  return Object.keys(next).length ? next : undefined
}

function newId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${uuid}`
}

function widths(count: number, fallback = DEFAULT_COL_WIDTH): number[] {
  return Array.from({ length: count }, () => fallback)
}

export function createSheet(name: string, rowCount = DEFAULT_ROWS, columnCount = DEFAULT_COLS): EquipmentSheet {
  return {
    id: newId('sheet'),
    name,
    rowCount,
    columnCount,
    cells: {},
    columnWidths: widths(columnCount),
    rowHeights: widths(rowCount, DEFAULT_ROW_HEIGHT),
    hidden: false,
    tabColor: null,
    protection: null,
    styles: {},
    notes: {},
    links: {},
    freezeRows: 0,
    freezeCols: 0,
    showGridlines: true,
    showHeadings: true,
    showFormulaBar: true,
    filter: null,
    comments: {},
    namedRanges: {},
    lists: {},
    checkboxes: {},
    merges: [],
    filterViews: [],
    snippets: {},
    lockedCells: {},
  }
}

export function createWorkbook(): EquipmentWorkbook {
  const sheet = createSheet('Sheet1')
  return {
    id: newId('wb'),
    name: 'Equipment Profile',
    activeSheetId: sheet.id,
    sheets: [sheet],
  }
}

export function visibleSheets(workbook: EquipmentWorkbook): EquipmentSheet[] {
  return workbook.sheets.filter((sheet) => !sheet.hidden)
}

export function activeSheet(workbook: EquipmentWorkbook): EquipmentSheet {
  return (
    workbook.sheets.find((sheet) => sheet.id === workbook.activeSheetId && !sheet.hidden) ??
    visibleSheets(workbook)[0] ??
    workbook.sheets[0]
  )
}

export function replaceSheet(workbook: EquipmentWorkbook, sheet: EquipmentSheet): EquipmentWorkbook {
  return { ...workbook, sheets: workbook.sheets.map((row) => (row.id === sheet.id ? sheet : row)) }
}

function padSizes(sheet: EquipmentSheet): EquipmentSheet {
  const columnWidths = sheet.columnWidths.length > sheet.columnCount ? sheet.columnWidths.slice(0, sheet.columnCount) : sheet.columnWidths.slice()
  const rowHeights = sheet.rowHeights.length > sheet.rowCount ? sheet.rowHeights.slice(0, sheet.rowCount) : sheet.rowHeights.slice()
  return { ...sheet, columnWidths, rowHeights }
}

export function ensureSize(sheet: EquipmentSheet, rows: number, cols: number): EquipmentSheet {
  const rowCount = Math.min(MAX_ROWS, Math.max(sheet.rowCount, rows))
  const columnCount = Math.min(MAX_COLS, Math.max(sheet.columnCount, cols))
  return padSizes({ ...sheet, rowCount, columnCount })
}

export function assertSheetAction(sheet: EquipmentSheet, action: 'edit' | 'format' | 'insert' | 'delete') {
  const guard = sheet.protection?.locked ? sheet.protection : null
  if (!guard) return
  const allowed =
    action === 'edit'
      ? guard.allowEditCells
      : action === 'format'
        ? guard.allowFormat
        : action === 'insert'
          ? guard.allowInsert
          : guard.allowDelete
  if (!allowed) throw new Error(`'${sheet.name}' is protected. This change is not allowed.`)
}

export function setCellValue(sheet: EquipmentSheet, row: number, column: number, value: string): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  if (sheet.lockedCells?.[cellKey(row, column)]) throw new Error('This cell is protected.')
  const next = ensureSize(sheet, row + 1, column + 1)
  const cells = { ...next.cells }
  const key = cellKey(row, column)
  const trimmed = value
  if (!trimmed) delete cells[key]
  else cells[key] = trimmed
  return { ...next, cells }
}

export function clearRange(sheet: EquipmentSheet, row1: number, col1: number, row2: number, col2: number): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  const r1 = Math.min(row1, row2)
  const r2 = Math.max(row1, row2)
  const c1 = Math.min(col1, col2)
  const c2 = Math.max(col1, col2)
  for (let row = r1; row <= r2; row += 1) {
    for (let column = c1; column <= c2; column += 1) {
      if (sheet.lockedCells?.[cellKey(row, column)]) throw new Error('This cell is protected.')
    }
  }
  const cells = { ...sheet.cells }
  for (let row = r1; row <= r2; row += 1) {
    for (let column = c1; column <= c2; column += 1) delete cells[cellKey(row, column)]
  }
  return { ...sheet, cells }
}

export function pasteText(sheet: EquipmentSheet, row: number, column: number, text: string): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  const grid = lines.map((line) => line.split('\t'))
  let next = sheet
  grid.forEach((line, r) => {
    line.forEach((value, c) => {
      next = setCellValue(next, row + r, column + c, value)
    })
  })
  return next
}

export function insertRow(sheet: EquipmentSheet, index: number): EquipmentSheet {
  assertSheetAction(sheet, 'insert')
  if (sheet.rowCount >= MAX_ROWS) throw new Error('This worksheet has reached the row limit.')
  const cells: Record<string, string> = {}
  for (const [key, value] of Object.entries(sheet.cells)) {
    const [row, column] = key.split(':').map(Number)
    cells[cellKey(row >= index ? row + 1 : row, column)] = value
  }
  const rowHeights = sheet.rowHeights.slice()
  rowHeights.splice(index, 0, DEFAULT_ROW_HEIGHT)
  return { ...sheet, cells, rowHeights, rowSizes: shiftSizeMap(sheet.rowSizes, index, 1), rowCount: sheet.rowCount + 1 }
}

export function deleteRow(sheet: EquipmentSheet, index: number): EquipmentSheet {
  assertSheetAction(sheet, 'delete')
  if (sheet.rowCount <= MIN_ROWS) throw new Error('Keep at least 20 rows on the worksheet.')
  const cells: Record<string, string> = {}
  for (const [key, value] of Object.entries(sheet.cells)) {
    const [row, column] = key.split(':').map(Number)
    if (row === index) continue
    cells[cellKey(row > index ? row - 1 : row, column)] = value
  }
  const rowHeights = sheet.rowHeights.slice()
  rowHeights.splice(index, 1)
  return { ...sheet, cells, rowHeights, rowSizes: shiftSizeMap(sheet.rowSizes, index, -1), rowCount: sheet.rowCount - 1 }
}

export function insertColumn(sheet: EquipmentSheet, index: number): EquipmentSheet {
  assertSheetAction(sheet, 'insert')
  if (sheet.columnCount >= MAX_COLS) throw new Error('This worksheet has reached the column limit.')
  const cells: Record<string, string> = {}
  for (const [key, value] of Object.entries(sheet.cells)) {
    const [row, column] = key.split(':').map(Number)
    cells[cellKey(row, column >= index ? column + 1 : column)] = value
  }
  const columnWidths = sheet.columnWidths.slice()
  columnWidths.splice(index, 0, DEFAULT_COL_WIDTH)
  return { ...sheet, cells, columnWidths, colSizes: shiftSizeMap(sheet.colSizes, index, 1), columnCount: sheet.columnCount + 1 }
}

export function deleteColumn(sheet: EquipmentSheet, index: number): EquipmentSheet {
  assertSheetAction(sheet, 'delete')
  if (sheet.columnCount <= MIN_COLS) throw new Error('Keep at least 8 columns on the worksheet.')
  const cells: Record<string, string> = {}
  for (const [key, value] of Object.entries(sheet.cells)) {
    const [row, column] = key.split(':').map(Number)
    if (column === index) continue
    cells[cellKey(row, column > index ? column - 1 : column)] = value
  }
  const columnWidths = sheet.columnWidths.slice()
  columnWidths.splice(index, 1)
  return { ...sheet, cells, columnWidths, colSizes: shiftSizeMap(sheet.colSizes, index, -1), columnCount: sheet.columnCount - 1 }
}

export function nextSheetName(workbook: EquipmentWorkbook): string {
  const names = new Set(workbook.sheets.map((sheet) => sheet.name.toLowerCase()))
  let n = workbook.sheets.length + 1
  while (names.has(`sheet${n}`)) n += 1
  return `Sheet${n}`
}

export function addSheet(workbook: EquipmentWorkbook, name = nextSheetName(workbook)): EquipmentWorkbook {
  if (workbook.sheets.some((sheet) => sheet.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A worksheet with that name already exists.')
  }
  const sheet = createSheet(name)
  return { ...workbook, activeSheetId: sheet.id, sheets: [...workbook.sheets, sheet] }
}

const SHEET_NAME_INVALID = /[\\/?*[\]:]/

export function sheetNameError(workbook: EquipmentWorkbook, sheetId: string, name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Worksheet name is required.'
  if (trimmed.length > SHEET_NAME_MAX) return 'Worksheet names can be at most 31 characters.'
  if (SHEET_NAME_INVALID.test(trimmed) || trimmed.startsWith("'") || trimmed.endsWith("'")) {
    return 'A worksheet name cannot contain \\ / ? * [ ] : or start or end with an apostrophe.'
  }
  if (workbook.sheets.some((sheet) => sheet.id !== sheetId && sheet.name.toLowerCase() === trimmed.toLowerCase())) {
    return 'A worksheet with that name already exists.'
  }
  return null
}

export function renameSheet(workbook: EquipmentWorkbook, sheetId: string, name: string): EquipmentWorkbook {
  const error = sheetNameError(workbook, sheetId, name)
  if (error) throw new Error(error)
  const trimmed = name.trim()
  return {
    ...workbook,
    sheets: workbook.sheets.map((sheet) => (sheet.id === sheetId ? { ...sheet, name: trimmed } : sheet)),
  }
}

function withActiveVisible(workbook: EquipmentWorkbook, sheets: EquipmentSheet[], preferId?: string): EquipmentWorkbook {
  const visible = sheets.filter((sheet) => !sheet.hidden)
  const activeSheetId =
    (preferId && visible.some((sheet) => sheet.id === preferId) ? preferId : null) ??
    (visible.some((sheet) => sheet.id === workbook.activeSheetId) ? workbook.activeSheetId : visible[0]?.id) ??
    sheets[0].id
  return { ...workbook, sheets, activeSheetId }
}

export function deleteSheet(workbook: EquipmentWorkbook, sheetId: string): EquipmentWorkbook {
  const target = workbook.sheets.find((sheet) => sheet.id === sheetId)
  if (!target) throw new Error('Worksheet not found.')
  if (!target.hidden && visibleSheets(workbook).length <= 1) {
    throw new Error('The workbook must keep at least one visible worksheet.')
  }
  const sheets = workbook.sheets.filter((sheet) => sheet.id !== sheetId)
  return withActiveVisible(workbook, sheets)
}

export function duplicateSheet(workbook: EquipmentWorkbook, sheetId: string): EquipmentWorkbook {
  return copySheet(workbook, sheetId, sheetId)
}

function copyLabel(workbook: EquipmentWorkbook, base: string): string {
  const names = new Set(workbook.sheets.map((sheet) => sheet.name.toLowerCase()))
  const stem = base.replace(/ \(\d+\)$/, '').trim() || 'Sheet'
  let n = 2
  let name = `${stem} (${n})`
  while (names.has(name.toLowerCase()) || name.length > SHEET_NAME_MAX) {
    n += 1
    const suffix = ` (${n})`
    const room = Math.max(1, SHEET_NAME_MAX - suffix.length)
    name = `${stem.slice(0, room).trim()}${suffix}`
    if (n > workbook.sheets.length + 50) break
  }
  return name
}

function cloneSheet(source: EquipmentSheet, name: string): EquipmentSheet {
  const copy = createSheet(name, source.rowCount, source.columnCount)
  copy.cells = { ...source.cells }
  copy.columnWidths = source.columnWidths.slice()
  copy.rowHeights = source.rowHeights.slice()
  copy.colSizes = source.colSizes ? { ...source.colSizes } : undefined
  copy.rowSizes = source.rowSizes ? { ...source.rowSizes } : undefined
  copy.tabColor = source.tabColor
  copy.protection = source.protection ? { ...source.protection } : null
  copy.hidden = false
  copy.styles = { ...source.styles }
  copy.notes = { ...source.notes }
  copy.links = { ...source.links }
  copy.freezeRows = source.freezeRows
  copy.freezeCols = source.freezeCols
  copy.showGridlines = source.showGridlines
  copy.showHeadings = source.showHeadings
  copy.showFormulaBar = source.showFormulaBar
  copy.filter = source.filter
    ? { ...source.filter, values: source.filter.values ? source.filter.values.slice() : null }
    : null
  copy.comments = { ...(source.comments ?? {}) }
  copy.namedRanges = { ...(source.namedRanges ?? {}) }
  copy.lists = Object.fromEntries(Object.entries(source.lists ?? {}).map(([key, values]) => [key, values.slice()]))
  copy.checkboxes = { ...(source.checkboxes ?? {}) }
  copy.merges = (source.merges ?? []).map((merge) => ({ ...merge }))
  copy.filterViews = (source.filterViews ?? []).map((view) => ({
    name: view.name,
    filter: { ...view.filter, values: view.filter.values ? view.filter.values.slice() : null },
  }))
  copy.snippets = { ...(source.snippets ?? {}) }
  copy.lockedCells = { ...(source.lockedCells ?? {}) }
  return copy
}

/** Inserts a blank sheet before `beforeId`. `beforeId` null appends it. */
export function insertSheetBefore(workbook: EquipmentWorkbook, beforeId: string | null, name = nextSheetName(workbook)): EquipmentWorkbook {
  const error = sheetNameError(workbook, '', name)
  if (error) throw new Error(error)
  const sheet = createSheet(name.trim())
  const sheets = workbook.sheets.slice()
  const index = beforeId ? sheets.findIndex((item) => item.id === beforeId) : -1
  sheets.splice(index < 0 ? sheets.length : index, 0, sheet)
  return { ...workbook, sheets, activeSheetId: sheet.id }
}

export function moveSheet(workbook: EquipmentWorkbook, sheetId: string, beforeId: string | null): EquipmentWorkbook {
  const source = workbook.sheets.find((sheet) => sheet.id === sheetId)
  if (!source) throw new Error('Worksheet not found.')
  if (beforeId === sheetId) return workbook
  const rest = workbook.sheets.filter((sheet) => sheet.id !== sheetId)
  const index = beforeId ? rest.findIndex((sheet) => sheet.id === beforeId) : -1
  const sheets = rest.slice()
  sheets.splice(index < 0 ? sheets.length : index, 0, source)
  return withActiveVisible(workbook, sheets, sheetId)
}

export function copySheet(workbook: EquipmentWorkbook, sheetId: string, beforeId: string | null): EquipmentWorkbook {
  const source = workbook.sheets.find((sheet) => sheet.id === sheetId)
  if (!source) throw new Error('Worksheet not found.')
  const copy = cloneSheet(source, copyLabel(workbook, source.name))
  const sheets = workbook.sheets.slice()
  const index = beforeId ? sheets.findIndex((sheet) => sheet.id === beforeId) : -1
  sheets.splice(index < 0 ? sheets.length : index, 0, copy)
  return { ...workbook, sheets, activeSheetId: copy.id }
}

export function hideSheet(workbook: EquipmentWorkbook, sheetId: string): EquipmentWorkbook {
  const target = workbook.sheets.find((sheet) => sheet.id === sheetId)
  if (!target) throw new Error('Worksheet not found.')
  if (!target.hidden && visibleSheets(workbook).length <= 1) {
    throw new Error('The workbook must keep at least one visible worksheet.')
  }
  const sheets = workbook.sheets.map((sheet) => (sheet.id === sheetId ? { ...sheet, hidden: true } : sheet))
  return withActiveVisible(workbook, sheets)
}

export function unhideSheets(workbook: EquipmentWorkbook, sheetIds: string[]): EquipmentWorkbook {
  const ids = new Set(sheetIds)
  if (!ids.size) throw new Error('Choose a worksheet to unhide.')
  const sheets = workbook.sheets.map((sheet) => (ids.has(sheet.id) ? { ...sheet, hidden: false } : sheet))
  const first = sheetIds.find((id) => sheets.some((sheet) => sheet.id === id))
  return withActiveVisible(workbook, sheets, first)
}

export function setSheetTabColor(workbook: EquipmentWorkbook, sheetId: string, tabColor: string | null): EquipmentWorkbook {
  if (!workbook.sheets.some((sheet) => sheet.id === sheetId)) throw new Error('Worksheet not found.')
  return {
    ...workbook,
    sheets: workbook.sheets.map((sheet) => (sheet.id === sheetId ? { ...sheet, tabColor } : sheet)),
  }
}

export function setSheetProtection(workbook: EquipmentWorkbook, sheetId: string, protection: SheetProtection | null): EquipmentWorkbook {
  if (!workbook.sheets.some((sheet) => sheet.id === sheetId)) throw new Error('Worksheet not found.')
  const next = protection?.locked ? protection : null
  return {
    ...workbook,
    sheets: workbook.sheets.map((sheet) => (sheet.id === sheetId ? { ...sheet, protection: next } : sheet)),
  }
}

export function mapVisibleSelection(
  workbook: EquipmentWorkbook,
  sheetIds: string[],
  mutate: (sheet: EquipmentSheet) => EquipmentSheet,
): EquipmentWorkbook {
  const ids = new Set(sheetIds)
  const targets = workbook.sheets.filter((sheet) => ids.has(sheet.id) && !sheet.hidden)
  const chosen = targets.length ? targets : [activeSheet(workbook)]
  const drafts = chosen.map(mutate)
  let sheets = workbook.sheets
  for (const draft of drafts) sheets = sheets.map((sheet) => (sheet.id === draft.id ? draft : sheet))
  return { ...workbook, sheets }
}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'op'; value: string }
  | { kind: 'lp' }
  | { kind: 'rp' }
  | { kind: 'comma' }
  | { kind: 'ref'; row: number; column: number }
  | { kind: 'range'; r1: number; c1: number; r2: number; c2: number }
  | { kind: 'name'; value: string }

const REF = /^\$?([A-Z]+)\$?(\d+)/i

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const source = input.trim()
  while (i < source.length) {
    const ch = source[i]
    if (ch === ' ' || ch === '\t') {
      i += 1
      continue
    }
    if ('+-*/'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch })
      i += 1
      continue
    }
    if (ch === '(') {
      tokens.push({ kind: 'lp' })
      i += 1
      continue
    }
    if (ch === ')') {
      tokens.push({ kind: 'rp' })
      i += 1
      continue
    }
    if (ch === ',') {
      tokens.push({ kind: 'comma' })
      i += 1
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let end = i + 1
      while (end < source.length && /[0-9.]/.test(source[end])) end += 1
      const value = Number(source.slice(i, end))
      if (!Number.isFinite(value)) throw new Error('#NUM!')
      tokens.push({ kind: 'num', value })
      i = end
      continue
    }
    if (/[A-Za-z]/.test(ch)) {
      const ref = source.slice(i).match(REF)
      const afterRef = ref ? i + ref[0].length : i
      const rangeSep = ref && source[afterRef] === ':'
      if (ref && rangeSep) {
        const right = source.slice(afterRef + 1).match(REF)
        if (!right) throw new Error('#REF!')
        tokens.push({
          kind: 'range',
          c1: parseColumnLabel(ref[1]),
          r1: Number(ref[2]) - 1,
          c2: parseColumnLabel(right[1]),
          r2: Number(right[2]) - 1,
        })
        i = afterRef + 1 + right[0].length
        continue
      }
      if (ref && (afterRef >= source.length || !/[A-Za-z]/.test(source[afterRef]))) {
        tokens.push({ kind: 'ref', column: parseColumnLabel(ref[1]), row: Number(ref[2]) - 1 })
        i = afterRef
        continue
      }
      let end = i + 1
      while (end < source.length && /[A-Za-z.]/.test(source[end])) end += 1
      tokens.push({ kind: 'name', value: source.slice(i, end).toUpperCase() })
      i = end
      continue
    }
    throw new Error('#ERROR!')
  }
  return tokens
}

const numberCache = new WeakMap<EquipmentSheet, Map<string, number>>()

function cellNumber(sheet: EquipmentSheet, row: number, column: number, stack: Set<string>): number {
  const key = cellKey(row, column)
  if (stack.has(key)) throw new Error('#CYCLE!')
  const cached = numberCache.get(sheet)?.get(key)
  if (cached !== undefined) return cached
  const raw = sheet.cells[key]?.trim() ?? ''
  if (!raw) return 0
  let value: number
  if (raw.startsWith('=')) value = evaluateFormula(sheet, raw.slice(1), new Set(stack).add(key))
  else {
    value = Number(raw)
    if (!Number.isFinite(value)) throw new Error('#VALUE!')
  }
  let cache = numberCache.get(sheet)
  if (!cache) {
    cache = new Map()
    numberCache.set(sheet, cache)
  }
  cache.set(key, value)
  return value
}

function rangeNumbers(sheet: EquipmentSheet, token: Extract<Token, { kind: 'range' }>, stack: Set<string>): number[] {
  const r1 = Math.min(token.r1, token.r2)
  const r2 = Math.max(token.r1, token.r2)
  const c1 = Math.min(token.c1, token.c2)
  const c2 = Math.max(token.c1, token.c2)
  const values: number[] = []
  for (let row = r1; row <= r2; row += 1) {
    for (let column = c1; column <= c2; column += 1) {
      const raw = sheet.cells[cellKey(row, column)]?.trim() ?? ''
      if (!raw) continue
      values.push(cellNumber(sheet, row, column, stack))
    }
  }
  return values
}

function evaluateFormula(sheet: EquipmentSheet, expression: string, stack: Set<string>): number {
  const tokens = tokenize(expression)
  let index = 0

  function peek(): Token | undefined {
    return tokens[index]
  }
  function take(): Token {
    const token = tokens[index]
    if (!token) throw new Error('#ERROR!')
    index += 1
    return token
  }

  function parseExpr(): number {
    let value = parseTerm()
    while (peek()?.kind === 'op' && (peek() as { value: string }).value.match(/[+-]/)) {
      const op = (take() as { value: string }).value
      const right = parseTerm()
      value = op === '+' ? value + right : value - right
    }
    return value
  }

  function parseTerm(): number {
    let value = parseFactor()
    while (peek()?.kind === 'op' && (peek() as { value: string }).value.match(/[*/]/)) {
      const op = (take() as { value: string }).value
      const right = parseFactor()
      value = op === '*' ? value * right : right === 0 ? Number.NaN : value / right
    }
    if (!Number.isFinite(value)) throw new Error('#DIV/0!')
    return value
  }

  function parseFactor(): number {
    const token = peek()
    if (!token) throw new Error('#ERROR!')
    if (token.kind === 'op' && token.value === '-') {
      take()
      return -parseFactor()
    }
    if (token.kind === 'num') {
      take()
      return token.value
    }
    if (token.kind === 'ref') {
      take()
      return cellNumber(sheet, token.row, token.column, stack)
    }
    if (token.kind === 'lp') {
      take()
      const value = parseExpr()
      if (take().kind !== 'rp') throw new Error('#ERROR!')
      return value
    }
    if (token.kind === 'name') {
      take()
      if (take().kind !== 'lp') throw new Error('#NAME?')
      const args: number[][] = []
      if (peek()?.kind !== 'rp') {
        args.push(parseArg())
        while (peek()?.kind === 'comma') {
          take()
          args.push(parseArg())
        }
      }
      if (take().kind !== 'rp') throw new Error('#ERROR!')
      const flat = args.flat()
      if (token.value === 'SUM') return flat.reduce((sum, item) => sum + item, 0)
      if (token.value === 'AVERAGE') return flat.length ? flat.reduce((sum, item) => sum + item, 0) / flat.length : 0
      if (token.value === 'MIN') return flat.length ? Math.min(...flat) : 0
      if (token.value === 'MAX') return flat.length ? Math.max(...flat) : 0
      if (token.value === 'COUNT') return flat.length
      if (token.value === 'COUNTA') return flat.length
      if (token.value === 'ABS') return Math.abs(flat[0] ?? 0)
      if (token.value === 'ROUND') {
        const digits = flat[1] ?? 0
        const factor = 10 ** Math.trunc(digits)
        return Math.round((flat[0] ?? 0) * factor) / factor
      }
      if (token.value === 'STDEV' || token.value === 'STDEV.S' || token.value === 'VAR' || token.value === 'VAR.S') {
        if (flat.length < 2) return 0
        const mean = flat.reduce((sum, item) => sum + item, 0) / flat.length
        const variance = flat.reduce((sum, item) => sum + (item - mean) ** 2, 0) / (flat.length - 1)
        return token.value.startsWith('VAR') ? variance : Math.sqrt(variance)
      }
      throw new Error('#NAME?')
    }
    throw new Error('#ERROR!')
  }

  function parseArg(): number[] {
    const token = peek()
    if (token?.kind === 'range') {
      take()
      return rangeNumbers(sheet, token, stack)
    }
    return [parseExpr()]
  }

  const value = parseExpr()
  if (index !== tokens.length) throw new Error('#ERROR!')
  return value
}

export function storedText(raw: string): string {
  return raw.startsWith("'") ? raw.slice(1) : raw
}

function keepsIdentifier(text: string): boolean {
  return /^0\d/.test(text.trim())
}

export function formatNumber(value: number, style?: CellStyle): string {
  const format = style?.format ?? 'general'
  const decimals = style?.decimals
  if (format === 'percent') {
    const shown = decimals == null ? Math.round(value * 10000) / 100 : (value * 100).toFixed(Math.max(0, decimals))
    return `${shown}%`
  }
  if (format === 'currency') {
    const places = decimals ?? 2
    return `${style?.currency ?? '$'}${value.toFixed(Math.max(0, places))}`
  }
  if (format === 'scientific') return value.toExponential(decimals ?? 2)
  if (format === 'number') {
    if (decimals == null) return String(value)
    return value.toFixed(Math.max(0, decimals))
  }
  return String(Math.round(value * 1e10) / 1e10)
}

export function displayCell(sheet: EquipmentSheet, row: number, column: number): string {
  const raw = sheet.cells[cellKey(row, column)] ?? ''
  const style = sheet.styles?.[cellKey(row, column)]
  const format = style?.format ?? 'general'
  if (raw.startsWith('=')) {
    try {
      const value = cellNumber(sheet, row, column, new Set())
      const rounded = Math.round(value * 1e10) / 1e10
      if (format === 'date' || format === 'time' || format === 'text' || format === 'general') return String(rounded)
      return formatNumber(rounded, style)
    } catch (err) {
      return err instanceof Error && err.message.startsWith('#') ? err.message : '#ERROR!'
    }
  }
  const text = storedText(raw)
  if (format === 'general' || format === 'text' || keepsIdentifier(text)) return text
  if (format === 'date' || format === 'time') {
    const date = new Date(text)
    if (Number.isNaN(date.getTime())) return text
    return format === 'date' ? date.toLocaleDateString() : date.toLocaleTimeString()
  }
  if (text.trim() === '') return ''
  const value = Number(text)
  if (!Number.isFinite(value)) return text
  return formatNumber(value, style)
}

export function isRowFilteredOut(sheet: EquipmentSheet, row: number): boolean {
  const filter = sheet.filter
  if (!filter || row <= filter.headerRow) return false
  if (filter.values && !filter.values.includes(displayCell(sheet, row, filter.column))) return true
  const style = sheet.styles?.[cellKey(row, filter.column)]
  if (filter.fill && (style?.fill ?? '') !== filter.fill) return true
  if (filter.fontColor && (style?.color ?? '') !== filter.fontColor) return true
  return false
}

function packRows(sheet: EquipmentSheet, row1: number, row2: number) {
  const packed = []
  for (let row = row1; row <= row2; row += 1) {
    const cells: Record<number, string> = {}
    const styles: Record<number, CellStyle> = {}
    for (let col = 0; col < sheet.columnCount; col += 1) {
      const key = cellKey(row, col)
      if (sheet.cells[key] != null) cells[col] = sheet.cells[key]
      if (sheet.styles?.[key]) styles[col] = sheet.styles[key]
    }
    packed.push({ row, cells, styles, height: axisSize(sheet.rowHeights, sheet.rowSizes, row, DEFAULT_ROW_HEIGHT) })
  }
  return packed
}

function writePacked(sheet: EquipmentSheet, row1: number, packed: ReturnType<typeof packRows>): EquipmentSheet {
  const cells = { ...sheet.cells }
  const styles = { ...(sheet.styles ?? {}) }
  let rowHeights = sheet.rowHeights.slice()
  let rowSizes = sheet.rowSizes ? { ...sheet.rowSizes } : undefined
  for (let row = row1; row < row1 + packed.length; row += 1) {
    for (let col = 0; col < sheet.columnCount; col += 1) {
      delete cells[cellKey(row, col)]
      delete styles[cellKey(row, col)]
    }
  }
  packed.forEach((entry, offset) => {
    const row = row1 + offset
    const written = writeAxisSize(rowHeights, rowSizes, row, entry.height ?? DEFAULT_ROW_HEIGHT, DEFAULT_ROW_HEIGHT)
    rowHeights = written.dense
    rowSizes = written.extra
    for (const [col, value] of Object.entries(entry.cells)) cells[cellKey(row, Number(col))] = value
    for (const [col, style] of Object.entries(entry.styles)) styles[cellKey(row, Number(col))] = style
  })
  return { ...sheet, cells, styles, rowHeights, rowSizes }
}

export function rearrangeRows(sheet: EquipmentSheet, row1: number, row2: number, compare: (left: number, right: number) => number): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  const r1 = Math.min(row1, row2)
  const r2 = Math.max(row1, row2)
  const packed = packRows(sheet, r1, r2)
  packed.sort((left, right) => compare(left.row, right.row) || left.row - right.row)
  return writePacked(sheet, r1, packed)
}

export function trimCells(sheet: EquipmentSheet, row1: number, col1: number, row2: number, col2: number): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  let next = sheet
  for (let row = Math.min(row1, row2); row <= Math.max(row1, row2); row += 1) {
    for (let column = Math.min(col1, col2); column <= Math.max(col1, col2); column += 1) {
      const raw = next.cells[cellKey(row, column)] ?? ''
      if (!raw || raw.startsWith('=') || raw.startsWith("'")) continue
      if (raw.trim() !== raw) next = setCellValue(next, row, column, raw.trim())
    }
  }
  return next
}

export function removeDuplicateRows(sheet: EquipmentSheet, row1: number, row2: number, column: number): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  const r1 = Math.min(row1, row2)
  const r2 = Math.max(row1, row2)
  const seen = new Set<string>()
  const kept = packRows(sheet, r1, r2).filter((entry) => {
    const label = displayCell(sheet, entry.row, column)
    if (seen.has(label)) return false
    seen.add(label)
    return true
  })
  while (kept.length < r2 - r1 + 1) kept.push({ row: -1, cells: {}, styles: {}, height: sheet.rowHeights[r1] ?? 24 })
  return writePacked(sheet, r1, kept)
}

export function shuffleRows(sheet: EquipmentSheet, row1: number, row2: number): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  const r1 = Math.min(row1, row2)
  const r2 = Math.max(row1, row2)
  const packed = packRows(sheet, r1, r2)
  for (let index = packed.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = packed[index]
    packed[index] = packed[swap]
    packed[swap] = current
  }
  return writePacked(sheet, r1, packed)
}

export function extractUnique(sheet: EquipmentSheet, column: number, row1: number, row2: number): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  const seen = new Set<string>()
  const values: string[] = []
  for (let row = Math.min(row1, row2); row <= Math.max(row1, row2); row += 1) {
    const text = displayCell(sheet, row, column)
    if (!text || seen.has(text)) continue
    seen.add(text)
    values.push(text)
  }
  let next = sheet
  values.forEach((value, index) => {
    next = setCellValue(next, Math.min(row1, row2) + index, column + 1, value)
  })
  return next
}

export function columnStats(sheet: EquipmentSheet, column: number, row1: number, row2: number) {
  let count = 0
  let blanks = 0
  let numeric = 0
  let sum = 0
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let row = Math.min(row1, row2); row <= Math.max(row1, row2); row += 1) {
    if (isRowFilteredOut(sheet, row)) continue
    const text = displayCell(sheet, row, column)
    if (!text.trim()) {
      blanks += 1
      continue
    }
    count += 1
    const value = Number(text.replace(/%$/, ''))
    if (Number.isFinite(value)) {
      numeric += 1
      sum += value
      min = Math.min(min, value)
      max = Math.max(max, value)
    }
  }
  return { count, blanks, numeric, sum, min: numeric ? min : 0, max: numeric ? max : 0, average: numeric ? sum / numeric : 0 }
}

export function highlightMatches(sheet: EquipmentSheet, column: number, row1: number, row2: number, op: 'gt' | 'contains', value: string, fill: string): EquipmentSheet {
  let next = sheet
  for (let row = Math.min(row1, row2); row <= Math.max(row1, row2); row += 1) {
    const text = displayCell(next, row, column)
    const match = op === 'gt' ? Number(text) > Number(value) : text.toLowerCase().includes(value.toLowerCase())
    if (match) next = applyCellStyle(next, row, column, row, column, { fill })
  }
  return next
}

export function blankFilter(column: number, headerRow = 0): SheetFilter {
  return { column, headerRow, values: null, fill: null, fontColor: null }
}

/** Selection keeps the fill. The outline shows the selection. */
export function paintedFill(fill: string | undefined, selected: boolean): string | undefined {
  void selected
  return fill || undefined
}

export function cellContentLayout(style?: CellStyle): {
  textAlign: 'left' | 'center' | 'right'
  justifyContent: 'flex-start' | 'center' | 'flex-end'
  whiteSpace: 'pre-wrap' | 'nowrap'
  overflow: 'visible' | 'hidden'
  textOverflow: 'clip' | 'ellipsis'
  writingMode?: 'vertical-rl'
  transform?: string
} {
  const angle = style?.rotate ?? 0
  const wrap = style?.wrapMode === 'wrap' || Boolean(style?.wrap)
  return {
    textAlign: style?.align === 'center' || style?.align === 'right' ? style.align : 'left',
    justifyContent: style?.valign === 'top' ? 'flex-start' : style?.valign === 'bottom' ? 'flex-end' : 'center',
    whiteSpace: wrap ? 'pre-wrap' : 'nowrap',
    overflow: style?.wrapMode === 'overflow' ? 'visible' : 'hidden',
    textOverflow: wrap || style?.wrapMode === 'overflow' || style?.wrapMode === 'clip' ? 'clip' : 'ellipsis',
    writingMode: angle === 90 || angle === -90 ? 'vertical-rl' : undefined,
    transform: angle && Math.abs(angle) !== 90 ? `rotate(${angle}deg)` : undefined,
  }
}

function cellStyleVisible(style: CellStyle): boolean {
  return Boolean(
    style.bold || style.italic || style.underline || style.strike || style.align || style.valign || style.wrap || style.wrapMode ||
    style.fill || style.color || style.fontSize || style.fontFamily || style.rotate || style.decimals != null || style.currency ||
    style.borderTop || style.borderRight || style.borderBottom || style.borderLeft ||
    (style.format && style.format !== 'general'),
  )
}

export function applyBorders(
  sheet: EquipmentSheet,
  row1: number,
  col1: number,
  row2: number,
  col2: number,
  mode: 'all' | 'outer' | 'inner' | 'top' | 'bottom' | 'left' | 'right' | 'none',
  color = '#202124',
  line: 'solid' | 'dashed' | 'dotted' = 'solid',
): EquipmentSheet {
  const r1 = Math.min(row1, row2)
  const r2 = Math.max(row1, row2)
  const c1 = Math.min(col1, col2)
  const c2 = Math.max(col1, col2)
  let next = sheet
  for (let row = r1; row <= r2; row += 1) {
    for (let column = c1; column <= c2; column += 1) {
      const clear = mode === 'none'
      const patch: Partial<CellStyle> = clear
        ? { borderTop: false, borderRight: false, borderBottom: false, borderLeft: false }
        : {
            borderColor: color,
            borderStyle: line,
            borderTop: mode === 'all' || mode === 'top' || (mode === 'outer' && row === r1) || (mode === 'inner' && row !== r1),
            borderRight: mode === 'all' || mode === 'right' || (mode === 'outer' && column === c2) || (mode === 'inner' && column !== c2),
            borderBottom: mode === 'all' || mode === 'bottom' || (mode === 'outer' && row === r2) || (mode === 'inner' && row !== r2),
            borderLeft: mode === 'all' || mode === 'left' || (mode === 'outer' && column === c1) || (mode === 'inner' && column !== c1),
          }
      next = applyCellStyle(next, row, column, row, column, patch)
    }
  }
  return next
}

export function applyCellStyle(
  sheet: EquipmentSheet,
  row1: number,
  col1: number,
  row2: number,
  col2: number,
  patch: Partial<CellStyle> | null,
): EquipmentSheet {
  assertSheetAction(sheet, 'format')
  const styles = { ...(sheet.styles ?? {}) }
  const r1 = Math.min(row1, row2)
  const r2 = Math.max(row1, row2)
  const c1 = Math.min(col1, col2)
  const c2 = Math.max(col1, col2)
  for (let row = r1; row <= r2; row += 1) {
    for (let column = c1; column <= c2; column += 1) {
      const key = cellKey(row, column)
      if (!patch) {
        delete styles[key]
        continue
      }
      const next = { ...styles[key], ...patch }
      if (!cellStyleVisible(next)) delete styles[key]
      else styles[key] = next
    }
  }
  return { ...sheet, styles }
}

export function clearFormats(sheet: EquipmentSheet, row1: number, col1: number, row2: number, col2: number): EquipmentSheet {
  return applyCellStyle(sheet, row1, col1, row2, col2, null)
}

export function sortRowRange(sheet: EquipmentSheet, row1: number, row2: number, column: number, direction: 'asc' | 'desc'): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  const r1 = Math.min(row1, row2)
  const r2 = Math.max(row1, row2)
  const packed = []
  for (let row = r1; row <= r2; row += 1) {
    const cells: Record<number, string> = {}
    const styles: Record<number, CellStyle> = {}
    for (let col = 0; col < sheet.columnCount; col += 1) {
      const key = cellKey(row, col)
      if (sheet.cells[key] != null) cells[col] = sheet.cells[key]
      if (sheet.styles?.[key]) styles[col] = sheet.styles[key]
    }
    packed.push({ cells, styles, height: axisSize(sheet.rowHeights, sheet.rowSizes, row, DEFAULT_ROW_HEIGHT), label: displayCell(sheet, row, column) })
  }
  packed.sort((left, right) => {
    const delta = left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: 'base' })
    return direction === 'asc' ? delta : -delta
  })
  const cells = { ...sheet.cells }
  const styles = { ...(sheet.styles ?? {}) }
  let rowHeights = sheet.rowHeights.slice()
  let rowSizes = sheet.rowSizes ? { ...sheet.rowSizes } : undefined
  for (let row = r1; row <= r2; row += 1) {
    for (let col = 0; col < sheet.columnCount; col += 1) {
      delete cells[cellKey(row, col)]
      delete styles[cellKey(row, col)]
    }
  }
  packed.forEach((entry, offset) => {
    const row = r1 + offset
    const written = writeAxisSize(rowHeights, rowSizes, row, entry.height ?? DEFAULT_ROW_HEIGHT, DEFAULT_ROW_HEIGHT)
    rowHeights = written.dense
    rowSizes = written.extra
    for (const [col, value] of Object.entries(entry.cells)) cells[cellKey(row, Number(col))] = value
    for (const [col, style] of Object.entries(entry.styles)) styles[cellKey(row, Number(col))] = style
  })
  return { ...sheet, cells, styles, rowHeights, rowSizes }
}

export function setSheetFilter(sheet: EquipmentSheet, filter: SheetFilter | null): EquipmentSheet {
  return { ...sheet, filter }
}

export function findNextCell(sheet: EquipmentSheet, query: string, row: number, column: number, matchCase: boolean): { row: number; column: number } | null {
  const needle = matchCase ? query : query.toLowerCase()
  if (!needle) return null
  const spots = Object.keys(sheet.cells)
    .map((key) => {
      const [row, column] = key.split(':').map(Number)
      return { row, column }
    })
    .filter((spot) => {
      const text = displayCell(sheet, spot.row, spot.column)
      const hay = matchCase ? text : text.toLowerCase()
      return hay.includes(needle)
    })
    .sort((left, right) => left.row - right.row || left.column - right.column)
  if (!spots.length) return null
  return spots.find((spot) => spot.row > row || (spot.row === row && spot.column > column)) ?? spots[0]
}

export function formulaForRange(name: string, row1: number, col1: number, row2: number, col2: number): string {
  const start = addressLabel(Math.min(row1, row2), Math.min(col1, col2))
  const end = addressLabel(Math.max(row1, row2), Math.max(col1, col2))
  const ref = start === end ? start : `${start}:${end}`
  return name === 'ROUND' ? `=ROUND(${ref},2)` : `=${name}(${ref})`
}

export function autoSumFormula(sheet: EquipmentSheet, row: number, column: number): string {
  let start = row - 1
  while (start > 0 && !(sheet.cells[cellKey(start, column)] ?? '').trim()) start -= 1
  let end = start
  while (end > 0 && (sheet.cells[cellKey(end - 1, column)] ?? '').trim()) end -= 1
  if (start < 0 || end > start) {
    let left = column - 1
    while (left > 0 && !(sheet.cells[cellKey(row, left)] ?? '').trim()) left -= 1
    let leftEnd = left
    while (leftEnd > 0 && (sheet.cells[cellKey(row, leftEnd - 1)] ?? '').trim()) leftEnd -= 1
    if (left < 0 || leftEnd > left) return '=SUM()'
    return `=SUM(${addressLabel(row, leftEnd)}:${addressLabel(row, left)})`
  }
  return `=SUM(${addressLabel(end, column)}:${addressLabel(start, column)})`
}

export function splitTextToColumns(sheet: EquipmentSheet, column: number, row1: number, row2: number, delimiter: string): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  let next = sheet
  for (let row = Math.min(row1, row2); row <= Math.max(row1, row2); row += 1) {
    const raw = storedText(next.cells[cellKey(row, column)] ?? '')
    if (!raw || raw.startsWith('=')) continue
    const parts = raw.split(delimiter)
    parts.forEach((part, offset) => {
      next = setCellValue(next, row, column + offset, part)
    })
  }
  return next
}

export function sheetToCsv(sheet: EquipmentSheet): string {
  let lastRow = 0
  let lastCol = 0
  for (const key of Object.keys(sheet.cells)) {
    const [row, column] = key.split(':').map(Number)
    lastRow = Math.max(lastRow, row)
    lastCol = Math.max(lastCol, column)
  }
  const lines: string[] = []
  for (let row = 0; row <= lastRow; row += 1) {
    const fields: string[] = []
    for (let column = 0; column <= lastCol; column += 1) {
      const raw = sheet.cells[cellKey(row, column)] ?? ''
      fields.push(/[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw)
    }
    lines.push(fields.join(','))
  }
  return lines.join('\n')
}

export function importCsvText(sheet: EquipmentSheet, text: string): EquipmentSheet {
  assertSheetAction(sheet, 'edit')
  const rows = parseCsv(text)
  let next = clearRange(sheet, 0, 0, Math.max(sheet.rowCount - 1, rows.length - 1), Math.max(sheet.columnCount - 1, (rows[0]?.length ?? 1) - 1))
  rows.forEach((line, row) => {
    line.forEach((value, column) => {
      const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
      next = setCellValue(next, row, column, safe)
    })
  })
  return next
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index += 1) {
    const ch = source[index]
    if (quoted && ch === '"' && source[index + 1] === '"') {
      field += '"'
      index += 1
    } else if (ch === '"') quoted = !quoted
    else if (!quoted && ch === ',') {
      row.push(field)
      field = ''
    } else if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && source[index + 1] === '\n') index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((line) => line.some((value) => value.length))
}

export function parseA1(input: string): { row: number; column: number; row2: number; column2: number } | null {
  const match = input.trim().match(/^(\$?[A-Z]+)(\$?\d+)(?::(\$?[A-Z]+)(\$?\d+))?$/i)
  if (!match) return null
  const column = parseColumnLabel(match[1].replace('$', ''))
  const row = Number(match[2].replace('$', '')) - 1
  const column2 = match[3] ? parseColumnLabel(match[3].replace('$', '')) : column
  const row2 = match[4] ? Number(match[4].replace('$', '')) - 1 : row
  if (column < 0 || column2 < 0 || row < 0 || row2 < 0) return null
  if (column >= MAX_COLS || column2 >= MAX_COLS || row >= MAX_ROWS || row2 >= MAX_ROWS) return null
  return { row, column, row2, column2 }
}

function normalizeFilter(value: unknown): SheetFilter | null {
  if (!value || typeof value !== 'object') return null
  const filter = value as SheetFilter
  if (!Array.isArray(filter.values) && filter.values != null && !filter.fill && !filter.fontColor) return null
  return {
    column: Math.max(0, Number(filter.column) || 0),
    headerRow: Math.max(0, Number(filter.headerRow) || 0),
    values: Array.isArray(filter.values) ? filter.values.map((item) => String(item)) : null,
    fill: typeof filter.fill === 'string' ? filter.fill : null,
    fontColor: typeof filter.fontColor === 'string' ? filter.fontColor : null,
  }
}

function normalizeProtection(value: unknown): SheetProtection | null {
  if (!value || typeof value !== 'object') return null
  const protection = value as SheetProtection
  if (!protection.locked) return null
  return {
    locked: true,
    allowEditCells: Boolean(protection.allowEditCells),
    allowFormat: Boolean(protection.allowFormat),
    allowInsert: Boolean(protection.allowInsert),
    allowDelete: Boolean(protection.allowDelete),
  }
}

function normalizeSizeMap(value: unknown, limit: number): Record<string, number> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const next: Record<string, number> = {}
  for (const [key, size] of Object.entries(value as Record<string, unknown>)) {
    const index = Number(key)
    const pixels = Number(size)
    if (!Number.isInteger(index) || index < 0 || index >= limit || !Number.isFinite(pixels) || pixels < 0 || pixels > 2000) continue
    next[String(index)] = pixels
  }
  return Object.keys(next).length ? next : undefined
}

export function normalizeWorkbook(value: unknown): EquipmentWorkbook | null {
  if (!value || typeof value !== 'object') return null
  const workbook = value as EquipmentWorkbook
  if (!Array.isArray(workbook.sheets) || workbook.sheets.length === 0) return null
  const sheets = workbook.sheets.map((sheet) => padSizes({
    id: String(sheet.id || newId('sheet')),
    name: String(sheet.name || 'Sheet'),
    rowCount: Math.min(MAX_ROWS, Math.max(MIN_ROWS, Number(sheet.rowCount) || DEFAULT_ROWS)),
    columnCount: Math.min(MAX_COLS, Math.max(MIN_COLS, Number(sheet.columnCount) || DEFAULT_COLS)),
    cells: sheet.cells && typeof sheet.cells === 'object' ? { ...sheet.cells } : {},
    columnWidths: Array.isArray(sheet.columnWidths) ? sheet.columnWidths.map((item) => Number(item) || DEFAULT_COL_WIDTH) : [],
    rowHeights: Array.isArray(sheet.rowHeights) ? sheet.rowHeights.map((item) => Number(item) || DEFAULT_ROW_HEIGHT) : [],
    colSizes: normalizeSizeMap(sheet.colSizes, MAX_COLS),
    rowSizes: normalizeSizeMap(sheet.rowSizes, MAX_ROWS),
    hidden: Boolean(sheet.hidden),
    tabColor: typeof sheet.tabColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(sheet.tabColor) ? sheet.tabColor : null,
    protection: normalizeProtection(sheet.protection),
    styles: sheet.styles && typeof sheet.styles === 'object' ? { ...sheet.styles } : {},
    notes: sheet.notes && typeof sheet.notes === 'object' ? { ...sheet.notes } : {},
    links: sheet.links && typeof sheet.links === 'object' ? { ...sheet.links } : {},
    freezeRows: Math.max(0, Number(sheet.freezeRows) || 0),
    freezeCols: Math.max(0, Number(sheet.freezeCols) || 0),
    showGridlines: sheet.showGridlines !== false,
    showHeadings: sheet.showHeadings !== false,
    showFormulaBar: sheet.showFormulaBar !== false,
    filter: normalizeFilter(sheet.filter),
    comments: sheet.comments && typeof sheet.comments === 'object' ? { ...sheet.comments } : {},
    namedRanges: sheet.namedRanges && typeof sheet.namedRanges === 'object' ? { ...sheet.namedRanges } : {},
    lists: sheet.lists && typeof sheet.lists === 'object' ? { ...sheet.lists } : {},
    checkboxes: sheet.checkboxes && typeof sheet.checkboxes === 'object' ? { ...sheet.checkboxes } : {},
    merges: Array.isArray(sheet.merges) ? sheet.merges.map((merge) => ({ ...merge })) : [],
    filterViews: Array.isArray(sheet.filterViews) ? sheet.filterViews.map((view) => ({ name: String(view.name), filter: normalizeFilter(view.filter) ?? { column: 0, headerRow: 0, values: null, fill: null, fontColor: null } })) : [],
    snippets: sheet.snippets && typeof sheet.snippets === 'object' ? { ...sheet.snippets } : {},
    lockedCells: sheet.lockedCells && typeof sheet.lockedCells === 'object' ? { ...sheet.lockedCells } : {},
  }))
  if (!sheets.some((sheet) => !sheet.hidden)) sheets[0].hidden = false
  const visible = sheets.filter((sheet) => !sheet.hidden)
  const activeSheetId = visible.some((sheet) => sheet.id === workbook.activeSheetId)
    ? workbook.activeSheetId
    : visible[0].id
  return { id: String(workbook.id || newId('wb')), name: String(workbook.name || 'Equipment Profile'), activeSheetId, sheets }
}
