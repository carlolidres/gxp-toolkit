import { describe, expect, it } from 'vitest'

import {
  addSheet,
  applyCellStyle,
  cellContentLayout,
  columnLabel,
  copySheet,
  createSheet,
  createWorkbook,
  DEFAULT_ROW_HEIGHT,
  deleteSheet,
  displayCell,
  EXCEL_COLS,
  EXCEL_ROWS,
  formulaForRange,
  hideSheet,
  axisIndexes,
  clampScroll,
  importCsvText,
  indexAt,
  insertRow,
  insertSheetBefore,
  mergeCells,
  mergeDiscardCount,
  mergeMenuState,
  normalizeWorkbook,
  offsetAt,
  parseA1,
  paintedFill,
  pasteText,
  removeDuplicateRows,
  renameSheet,
  offsetForThumb,
  replaceSheet,
  setCellValue,
  setSheetProtection,
  setSheetTabColor,
  sheetToCsv,
  sortRowRange,
  thumbMetrics,
  trimCells,
  unhideSheets,
  unmergeCells,
  visibleIndexes,
  visibleSheets,
  writeAxisSize,
} from './equipmentWorkbook'
import { loadEquipmentWorkbook, saveEquipmentWorkbook } from './equipmentWorkbookStorage'

describe('equipment workbook', () => {
  it('keeps a fill color on a selected cell', () => {
    let sheet = createSheet('Sheet1', 4, 4)
    sheet = applyCellStyle(sheet, 0, 0, 0, 0, { fill: '#e53935' })
    expect(sheet.styles?.['0:0']?.fill).toBe('#e53935')
    expect(paintedFill('#e53935', true)).toBe('#e53935')
    expect(paintedFill('#e53935', false)).toBe('#e53935')
    expect(paintedFill('', true)).toBeUndefined()
  })

  it('aligns cell text left, center, and right', () => {
    expect(cellContentLayout().textAlign).toBe('left')
    expect(cellContentLayout({ align: 'center' }).textAlign).toBe('center')
    expect(cellContentLayout({ align: 'right' }).textAlign).toBe('right')
    expect(cellContentLayout({ valign: 'top' }).justifyContent).toBe('flex-start')
    expect(cellContentLayout({ valign: 'bottom' }).justifyContent).toBe('flex-end')
    expect(cellContentLayout({ wrapMode: 'wrap' }).whiteSpace).toBe('pre-wrap')
    expect(cellContentLayout({ wrapMode: 'overflow' }).overflow).toBe('visible')
    expect(cellContentLayout({ rotate: 90 }).writingMode).toBe('vertical-rl')
  })

  it('builds a formula for the selected cells', () => {
    expect(formulaForRange('AVERAGE', 0, 0, 2, 0)).toBe('=AVERAGE(A1:A3)')
    expect(formulaForRange('ROUND', 1, 1, 1, 1)).toBe('=ROUND(B2,2)')
  })

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
    expect(displayCell(sheet, 3, 0)).toBe('7')
    expect(displayCell(setCellValue(sheet, 0, 0, '4'), 3, 0)).toBe('9')
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

  it('keeps formulas when a worksheet is renamed, inserted, or copied', () => {
    let workbook = createWorkbook()
    const id = workbook.sheets[0].id
    workbook = replaceSheet(workbook, setCellValue(workbook.sheets[0], 0, 0, '=A2+1'))
    workbook = renameSheet(workbook, id, 'Batch')
    expect(workbook.sheets[0].cells['0:0']).toBe('=A2+1')
    workbook = insertSheetBefore(workbook, id, 'Cover')
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(['Cover', 'Batch'])
    const copied = copySheet(workbook, id, null)
    expect(copied.sheets.at(-1)?.name).toBe('Batch (2)')
    expect(copied.sheets.at(-1)?.cells['0:0']).toBe('=A2+1')
    expect(copied.sheets.at(-1)?.id).not.toBe(id)
  })

  it('rejects an illegal name and a protected cell edit', () => {
    const workbook = createWorkbook()
    expect(() => renameSheet(workbook, workbook.sheets[0].id, 'A/B')).toThrow(/cannot contain/)
    const locked = setSheetProtection(workbook, workbook.sheets[0].id, {
      locked: true,
      allowEditCells: false,
      allowFormat: false,
      allowInsert: false,
      allowDelete: false,
    })
    expect(() => setCellValue(locked.sheets[0], 0, 0, 'x')).toThrow(/protected/)
  })

  it('hides a worksheet without deleting its cells and keeps one visible sheet', () => {
    let workbook = addSheet(createWorkbook(), 'Sheet2')
    workbook = replaceSheet(workbook, setCellValue(workbook.sheets[0], 0, 0, 'keep'))
    const hidden = hideSheet(workbook, workbook.sheets[0].id)
    expect(hidden.sheets[0].hidden).toBe(true)
    expect(hidden.sheets[0].cells['0:0']).toBe('keep')
    expect(visibleSheets(hidden)).toHaveLength(1)
    expect(() => hideSheet(hidden, hidden.sheets[1].id)).toThrow(/visible/)
    expect(unhideSheets(hidden, [hidden.sheets[0].id]).sheets[0].hidden).toBe(false)
  })

  it('keeps tab color and protection when a workbook is reloaded', () => {
    const base = createWorkbook()
    const id = base.sheets[0].id
    const workbook = setSheetTabColor(
      setSheetProtection(base, id, {
        locked: true,
        allowEditCells: true,
        allowFormat: false,
        allowInsert: false,
        allowDelete: false,
      }),
      id,
      '#ff0000',
    )
    const normalized = normalizeWorkbook(JSON.parse(JSON.stringify(workbook)))
    expect(normalized?.sheets[0].tabColor).toBe('#ff0000')
    expect(normalized?.sheets[0].protection?.allowEditCells).toBe(true)
    expect(normalized?.sheets[0].hidden).toBe(false)
  })

  it('keeps identifiers as text and moves an entire row when sorting', () => {
    let sheet = setCellValue(createSheet('Data'), 1, 0, '00188835')
    sheet = setCellValue(sheet, 1, 1, 'Batch A')
    sheet = setCellValue(sheet, 2, 0, '10')
    sheet = setCellValue(sheet, 2, 1, 'Batch B')
    expect(displayCell(sheet, 1, 0)).toBe('00188835')
    const sorted = sortRowRange(sheet, 1, 2, 0, 'desc')
    expect(sorted.cells['1:0']).toBe('00188835')
    expect(sorted.cells['1:1']).toBe('Batch A')
    expect(sorted.cells['2:0']).toBe('10')
    expect(sorted.cells['2:1']).toBe('Batch B')
    expect(displayCell(setCellValue(sheet, 3, 0, "'00188835"), 3, 0)).toBe('00188835')
  })

  it('formats a percent for display and imports formulas as text', () => {
    const styled = {
      ...setCellValue(createSheet('Data'), 0, 0, '0.25'),
      styles: { '0:0': { format: 'percent' as const } },
    }
    expect(displayCell(styled, 0, 0)).toBe('25%')
    expect(styled.cells['0:0']).toBe('0.25')
    const imported = importCsvText(createSheet('Data'), '=1+1,kept')
    expect(imported.cells['0:0']).toBe("'=1+1")
    expect(sheetToCsv(imported)).toContain("'=1+1")
    expect(displayCell(setCellValue(createSheet('Data'), 0, 0, '=ROUND(1.236,2)'), 0, 0)).toBe('1.24')
    expect(displayCell(setCellValue(createSheet('Data'), 0, 0, '=STDEV.S(1,2,3)'), 0, 0)).toBe('1')
  })

  it('evaluates each implemented formula and rejects a dollar absolute reference', () => {
    let sheet = setCellValue(createSheet('Data'), 0, 0, '2')
    sheet = setCellValue(sheet, 1, 0, '4')
    sheet = setCellValue(sheet, 2, 0, '6')
    const shown = (formula: string) => displayCell(setCellValue(sheet, 3, 0, formula), 3, 0)
    expect(shown('=SUM(A1:A3)')).toBe('12')
    expect(shown('=$A$1')).toBe('#ERROR!')
    expect(shown('=AVERAGE(A1:A3)')).toBe('4')
    expect(shown('=MIN(A1:A3)')).toBe('2')
    expect(shown('=MAX(A1:A3)')).toBe('6')
    expect(shown('=COUNT(A1:A3)')).toBe('3')
    expect(shown('=COUNTA(A1:A3)')).toBe('3')
    expect(shown('=ABS(-8)')).toBe('8')
    expect(shown('=ROUND(1.236,2)')).toBe('1.24')
    expect(shown('=STDEV(1,2,3)')).toBe('1')
    expect(shown('=STDEV.S(1,2,3)')).toBe('1')
    expect(shown('=VAR(1,2,3)')).toBe('1')
    expect(shown('=VAR.S(1,2,3)')).toBe('1')
    expect(shown('=A1+A2*2')).toBe('10')
  })

  it('shows currency without changing the stored value or a leading-zero identifier', () => {
    const amount = setCellValue(createSheet('Data'), 0, 0, '12.5')
    const styled = { ...amount, styles: { '0:0': { format: 'currency' as const, decimals: 2 } } }
    expect(displayCell(styled, 0, 0)).toBe('$12.50')
    expect(styled.cells['0:0']).toBe('12.5')
    const identifier = setCellValue(createSheet('Data'), 0, 0, '00188835')
    expect(displayCell({ ...identifier, styles: { '0:0': { format: 'number' as const } } }, 0, 0)).toBe('00188835')
  })

  it('enables merge only for several unmerged cells and keeps the top-left value', () => {
    let sheet = setCellValue(createSheet('Data'), 0, 0, 'Keep')
    sheet = setCellValue(sheet, 0, 1, 'Drop')
    sheet = { ...sheet, styles: { '0:0': { bold: true }, '0:1': { italic: true } } }
    expect(mergeMenuState([], 0, 0, 0, 0)).toMatchObject({ canMerge: false, canUnmerge: false })
    expect(mergeMenuState([], 0, 0, 0, 1).canMerge).toBe(true)
    expect(mergeDiscardCount(sheet, 0, 0, 0, 1, 'all')).toBe(1)
    const merged = mergeCells(sheet, 0, 0, 0, 1, 'all')
    expect(merged.cells['0:0']).toBe('Keep')
    expect(merged.cells['0:1']).toBeUndefined()
    expect(merged.styles['0:0']).toEqual({ bold: true })
    expect(merged.styles['0:1']).toEqual({ italic: true })
    expect(mergeMenuState(merged.merges ?? [], 0, 0, 0, 1)).toMatchObject({ canMerge: false, canUnmerge: true })
    expect(mergeCells(merged, 0, 0, 0, 1, 'all').merges).toHaveLength(1)
    const opened = unmergeCells(merged, 0, 0, 0, 0)
    expect(opened.merges).toEqual([])
    expect(opened.cells['0:0']).toBe('Keep')
    expect(opened.styles['0:1']).toEqual({ italic: true })
    expect(mergeMenuState([], 0, 0, 1, 0).canUnmerge).toBe(false)
  })

  it('addresses the Excel grid without storing empty rows', () => {
    expect(columnLabel(EXCEL_COLS - 1)).toBe('XFD')
    expect(parseA1('A100000')).toMatchObject({ row: 99999, column: 0 })
    expect(parseA1('XFD1048576')).toMatchObject({ row: EXCEL_ROWS - 1, column: EXCEL_COLS - 1 })
    expect(parseA1('A1048577')).toBeNull()
    expect(parseA1('XFE1')).toBeNull()
    expect(offsetAt([], 100000, DEFAULT_ROW_HEIGHT)).toBe(100000 * DEFAULT_ROW_HEIGHT)
    expect(indexAt([], 100000 * DEFAULT_ROW_HEIGHT, DEFAULT_ROW_HEIGHT, EXCEL_ROWS)).toBe(100000)
    const marks: Array<[number, number]> = [[1, 48]]
    expect(offsetAt(marks, 2, DEFAULT_ROW_HEIGHT)).toBe(72)
    expect(indexAt(marks, 72, DEFAULT_ROW_HEIGHT, 100)).toBe(2)
    const sized = writeAxisSize([DEFAULT_ROW_HEIGHT, DEFAULT_ROW_HEIGHT], undefined, 500, 40, DEFAULT_ROW_HEIGHT)
    expect(sized.dense).toHaveLength(2)
    expect(sized.extra[500]).toBe(40)
    const far = setCellValue(createSheet('Data'), 1000, 0, 'Far')
    expect(far.cells['1000:0']).toBe('Far')
    expect(far.rowHeights.length).toBeLessThan(200)
    const total = offsetAt([], EXCEL_ROWS, DEFAULT_ROW_HEIGHT)
    const view = 600
    expect(clampScroll(-10, total, view)).toBe(0)
    expect(clampScroll(total, total, view)).toBe(total - view)
    const mid = clampScroll(total / 2, total, view)
    const thumb = thumbMetrics(total, view, mid, 400)
    expect(thumb).not.toBeNull()
    expect(Math.abs(offsetForThumb(thumb!.pos, total, view, 400) - mid)).toBeLessThan(1)
    const row = 99999
    const top = offsetAt([], row, DEFAULT_ROW_HEIGHT)
    const scrolled = clampScroll(top, total, view)
    expect(top - scrolled).toBeGreaterThanOrEqual(0)
    expect(top - scrolled).toBeLessThan(view)
    expect(axisIndexes({ start: 4, end: 8 }, 1, [{ r1: 0, c1: 0, r2: 6, c2: 1 }], 'row', 0, 2)).toContain(0)
    const started = performance.now()
    for (let step = 0; step < 2000; step += 1) visibleIndexes([], clampScroll(step * 10000, total, view), view, DEFAULT_ROW_HEIGHT, EXCEL_ROWS)
    expect(performance.now() - started).toBeLessThan(500)
  })

  it('trims text and drops a duplicate row without losing the kept record', () => {
    let sheet = setCellValue(createSheet('Data'), 1, 0, '  ABES  ')
    sheet = setCellValue(sheet, 1, 1, 'Kept')
    sheet = setCellValue(sheet, 2, 0, 'ABES')
    sheet = setCellValue(sheet, 2, 1, 'Drop')
    const trimmed = trimCells(sheet, 1, 0, 1, 0)
    expect(trimmed.cells['1:0']).toBe('ABES')
    const unique = removeDuplicateRows(trimmed, 1, 2, 0)
    expect(unique.cells['1:0']).toBe('ABES')
    expect(unique.cells['1:1']).toBe('Kept')
    expect(unique.cells['2:1']).toBeUndefined()
  })
})
