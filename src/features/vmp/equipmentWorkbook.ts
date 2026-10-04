export const DEFAULT_ROWS = 100
export const DEFAULT_COLS = 26
export const MIN_ROWS = 20
export const MIN_COLS = 8
export const MAX_ROWS = 2000
export const MAX_COLS = 100
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

export type EquipmentSheet = {
  id: string
  name: string
  rowCount: number
  columnCount: number
  cells: Record<string, string>
  columnWidths: number[]
  rowHeights: number[]
}

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

export function activeSheet(workbook: EquipmentWorkbook): EquipmentSheet {
  return workbook.sheets.find((sheet) => sheet.id === workbook.activeSheetId) ?? workbook.sheets[0]
}

export function replaceSheet(workbook: EquipmentWorkbook, sheet: EquipmentSheet): EquipmentWorkbook {
  return { ...workbook, sheets: workbook.sheets.map((row) => (row.id === sheet.id ? sheet : row)) }
}

function padSizes(sheet: EquipmentSheet): EquipmentSheet {
  const columnWidths = sheet.columnWidths.slice(0, sheet.columnCount)
  const rowHeights = sheet.rowHeights.slice(0, sheet.rowCount)
  while (columnWidths.length < sheet.columnCount) columnWidths.push(DEFAULT_COL_WIDTH)
  while (rowHeights.length < sheet.rowCount) rowHeights.push(DEFAULT_ROW_HEIGHT)
  return { ...sheet, columnWidths, rowHeights }
}

export function ensureSize(sheet: EquipmentSheet, rows: number, cols: number): EquipmentSheet {
  const rowCount = Math.min(MAX_ROWS, Math.max(sheet.rowCount, rows))
  const columnCount = Math.min(MAX_COLS, Math.max(sheet.columnCount, cols))
  return padSizes({ ...sheet, rowCount, columnCount })
}

export function setCellValue(sheet: EquipmentSheet, row: number, column: number, value: string): EquipmentSheet {
  const next = ensureSize(sheet, row + 1, column + 1)
  const cells = { ...next.cells }
  const key = cellKey(row, column)
  const trimmed = value
  if (!trimmed) delete cells[key]
  else cells[key] = trimmed
  return { ...next, cells }
}

export function clearRange(sheet: EquipmentSheet, row1: number, col1: number, row2: number, col2: number): EquipmentSheet {
  const r1 = Math.min(row1, row2)
  const r2 = Math.max(row1, row2)
  const c1 = Math.min(col1, col2)
  const c2 = Math.max(col1, col2)
  const cells = { ...sheet.cells }
  for (let row = r1; row <= r2; row += 1) {
    for (let column = c1; column <= c2; column += 1) delete cells[cellKey(row, column)]
  }
  return { ...sheet, cells }
}

export function pasteText(sheet: EquipmentSheet, row: number, column: number, text: string): EquipmentSheet {
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
  if (sheet.rowCount >= MAX_ROWS) throw new Error('This worksheet has reached the row limit.')
  const cells: Record<string, string> = {}
  for (const [key, value] of Object.entries(sheet.cells)) {
    const [row, column] = key.split(':').map(Number)
    cells[cellKey(row >= index ? row + 1 : row, column)] = value
  }
  const rowHeights = sheet.rowHeights.slice()
  rowHeights.splice(index, 0, DEFAULT_ROW_HEIGHT)
  return { ...sheet, cells, rowHeights, rowCount: sheet.rowCount + 1 }
}

export function deleteRow(sheet: EquipmentSheet, index: number): EquipmentSheet {
  if (sheet.rowCount <= MIN_ROWS) throw new Error('Keep at least 20 rows on the worksheet.')
  const cells: Record<string, string> = {}
  for (const [key, value] of Object.entries(sheet.cells)) {
    const [row, column] = key.split(':').map(Number)
    if (row === index) continue
    cells[cellKey(row > index ? row - 1 : row, column)] = value
  }
  const rowHeights = sheet.rowHeights.slice()
  rowHeights.splice(index, 1)
  return { ...sheet, cells, rowHeights, rowCount: sheet.rowCount - 1 }
}

export function insertColumn(sheet: EquipmentSheet, index: number): EquipmentSheet {
  if (sheet.columnCount >= MAX_COLS) throw new Error('This worksheet has reached the column limit.')
  const cells: Record<string, string> = {}
  for (const [key, value] of Object.entries(sheet.cells)) {
    const [row, column] = key.split(':').map(Number)
    cells[cellKey(row, column >= index ? column + 1 : column)] = value
  }
  const columnWidths = sheet.columnWidths.slice()
  columnWidths.splice(index, 0, DEFAULT_COL_WIDTH)
  return { ...sheet, cells, columnWidths, columnCount: sheet.columnCount + 1 }
}

export function deleteColumn(sheet: EquipmentSheet, index: number): EquipmentSheet {
  if (sheet.columnCount <= MIN_COLS) throw new Error('Keep at least 8 columns on the worksheet.')
  const cells: Record<string, string> = {}
  for (const [key, value] of Object.entries(sheet.cells)) {
    const [row, column] = key.split(':').map(Number)
    if (column === index) continue
    cells[cellKey(row, column > index ? column - 1 : column)] = value
  }
  const columnWidths = sheet.columnWidths.slice()
  columnWidths.splice(index, 1)
  return { ...sheet, cells, columnWidths, columnCount: sheet.columnCount - 1 }
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

export function renameSheet(workbook: EquipmentWorkbook, sheetId: string, name: string): EquipmentWorkbook {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Worksheet name is required.')
  if (workbook.sheets.some((sheet) => sheet.id !== sheetId && sheet.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('A worksheet with that name already exists.')
  }
  return {
    ...workbook,
    sheets: workbook.sheets.map((sheet) => (sheet.id === sheetId ? { ...sheet, name: trimmed } : sheet)),
  }
}

export function deleteSheet(workbook: EquipmentWorkbook, sheetId: string): EquipmentWorkbook {
  if (workbook.sheets.length <= 1) throw new Error('The workbook must keep at least one worksheet.')
  const sheets = workbook.sheets.filter((sheet) => sheet.id !== sheetId)
  const activeSheetId = workbook.activeSheetId === sheetId ? sheets[0].id : workbook.activeSheetId
  return { ...workbook, sheets, activeSheetId }
}

export function duplicateSheet(workbook: EquipmentWorkbook, sheetId: string): EquipmentWorkbook {
  const source = workbook.sheets.find((sheet) => sheet.id === sheetId)
  if (!source) throw new Error('Worksheet not found.')
  const copy = createSheet(nextSheetName(workbook), source.rowCount, source.columnCount)
  copy.cells = { ...source.cells }
  copy.columnWidths = source.columnWidths.slice()
  copy.rowHeights = source.rowHeights.slice()
  const index = workbook.sheets.findIndex((sheet) => sheet.id === sheetId)
  const sheets = workbook.sheets.slice()
  sheets.splice(index + 1, 0, copy)
  return { ...workbook, sheets, activeSheetId: copy.id }
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
      while (end < source.length && /[A-Za-z]/.test(source[end])) end += 1
      tokens.push({ kind: 'name', value: source.slice(i, end).toUpperCase() })
      i = end
      continue
    }
    throw new Error('#ERROR!')
  }
  return tokens
}

function cellNumber(sheet: EquipmentSheet, row: number, column: number, stack: Set<string>): number {
  const key = cellKey(row, column)
  if (stack.has(key)) throw new Error('#CYCLE!')
  const raw = sheet.cells[key]?.trim() ?? ''
  if (!raw) return 0
  if (raw.startsWith('=')) return evaluateFormula(sheet, raw.slice(1), new Set(stack).add(key))
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error('#VALUE!')
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

export function displayCell(sheet: EquipmentSheet, row: number, column: number): string {
  const raw = sheet.cells[cellKey(row, column)] ?? ''
  if (!raw.startsWith('=')) return raw
  try {
    const value = evaluateFormula(sheet, raw.slice(1), new Set([cellKey(row, column)]))
    return String(Math.round(value * 1e10) / 1e10)
  } catch (err) {
    return err instanceof Error && err.message.startsWith('#') ? err.message : '#ERROR!'
  }
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
  }))
  const activeSheetId = sheets.some((sheet) => sheet.id === workbook.activeSheetId) ? workbook.activeSheetId : sheets[0].id
  return { id: String(workbook.id || newId('wb')), name: String(workbook.name || 'Equipment Profile'), activeSheetId, sheets }
}
