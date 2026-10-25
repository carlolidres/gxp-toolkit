import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

import {
  activeSheet,
  addSheet,
  addressLabel,
  applyBorders,
  applyCellStyle,
  assertSheetAction,
  autoSumFormula,
  axisIndexes,
  cellKey,
  clearRange,
  clampScroll,
  columnLabel,
  columnStats,
  deleteColumn,
  deleteRow,
  displayCell,
  extractUnique,
  EXCEL_COLS,
  EXCEL_ROWS,
  findNextCell,
  highlightMatches,
  importCsvText,
  insertColumn,
  insertRow,
  isRowFilteredOut,
  mapVisibleSelection,
  mergeCells,
  mergeDiscardCount,
  mergeMenuState,
  offsetAt,
  offsetForThumb,
  parseA1,
  pasteText,
  rearrangeRows,
  removeDuplicateRows,
  renameSheet,
  setCellValue,
  setSheetFilter,
  sheetToCsv,
  shuffleRows,
  sizeMarks,
  sortRowRange,
  splitTextToColumns,
  trimCells,
  unmergeCells,
  usedCorner,
  thumbMetrics,
  visibleIndexes,
  visibleSheets,
  writeAxisSize,
  axisSize,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  type CellStyle,
  type EquipmentAuditAction,
  type EquipmentSheet,
  type EquipmentWorkbook,
} from '../../features/vmp/equipmentWorkbook'
import { SheetTabDialogs, SheetTabMenu, type SheetDialogKind, type SheetMenuAudit } from './SheetTabMenu'
import { SheetRibbon } from './SheetRibbon'
import { CellContextMenu, SheetMenuBar } from './SheetMenus'

type Selection = { anchorRow: number; anchorCol: number; focusRow: number; focusCol: number }
type Audit = { action: EquipmentAuditAction; range: string | null; oldValue: string | null; newValue: string | null }
type MenuState = { x: number; y: number; row: number; column: number; target: 'cell' | 'row' | 'column' | 'sheet'; sheetId?: string }

function bounds(selection: Selection) {
  return {
    r1: Math.min(selection.anchorRow, selection.focusRow),
    r2: Math.max(selection.anchorRow, selection.focusRow),
    c1: Math.min(selection.anchorCol, selection.focusCol),
    c2: Math.max(selection.anchorCol, selection.focusCol),
  }
}

function covers(selection: Selection, row: number, column: number) {
  const box = bounds(selection)
  return row >= box.r1 && row <= box.r2 && column >= box.c1 && column <= box.c2
}

function selectionSummary(sheet: EquipmentSheet, selection: Selection) {
  const box = bounds(selection)
  const span = (box.r2 - box.r1 + 1) * (box.c2 - box.c1 + 1)
  if (span > 5000) return `${span} cells selected`
  let count = 0
  let numeric = 0
  let sum = 0
  for (let row = box.r1; row <= box.r2; row += 1) {
    if (isRowFilteredOut(sheet, row)) continue
    for (let column = box.c1; column <= box.c2; column += 1) {
      const shown = displayCell(sheet, row, column)
      if (!shown.trim()) continue
      count += 1
      const stored = sheet.cells[`${row}:${column}`] ?? ''
      const value = Number(shown.replace(/%$/, ''))
      if (Number.isFinite(value) && !stored.startsWith("'") && !/^0\d/.test(stored)) {
        numeric += 1
        sum += value
      }
    }
  }
  if (!count) return ''
  if (!numeric) return `Count ${count}`
  return `Count ${count}   Sum ${Math.round(sum * 100) / 100}   Average ${Math.round((sum / numeric) * 100) / 100}`
}

export function EquipmentSpreadsheet({
  workbook,
  readOnly,
  saveState,
  onChange,
  onError,
  editBlock,
  onRecordCell,
  renderCell,
}: {
  workbook: EquipmentWorkbook
  readOnly: boolean
  saveState: string
  onChange: (workbook: EquipmentWorkbook, audit: Audit | null) => void
  onError: (message: string) => void
  editBlock?: (row: number, column: number) => string | null
  onRecordCell?: (row: number, column: number) => void
  renderCell?: (row: number, column: number, shown: string) => ReactNode | null
}) {
  const sheet = activeSheet(workbook)
  const gridRef = useRef<HTMLDivElement>(null)
  const colHeaderRef = useRef<HTMLDivElement>(null)
  const rowHeaderRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const undoRef = useRef<EquipmentWorkbook[]>([])
  const redoRef = useRef<EquipmentWorkbook[]>([])
  const drag = useRef(false)
  const [selection, setSelection] = useState<Selection>({ anchorRow: 0, anchorCol: 0, focusRow: 0, focusCol: 0 })
  const [editing, setEditing] = useState<{ row: number; column: number; draft: string } | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [sheetMenu, setSheetMenu] = useState<{ x: number; y: number; sheetId: string } | null>(null)
  const [sheetDialog, setSheetDialog] = useState<{ kind: SheetDialogKind; sheetId: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [scroll, setScroll] = useState({ left: 0, top: 0, width: 900, height: 520 })
  const [zoom, setZoom] = useState(100)
  const [find, setFind] = useState<{ query: string; matchCase: boolean } | null>(null)
  const [formulaDraft, setFormulaDraft] = useState<string | null>(null)
  const csvRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const clipRef = useRef<{ raws: string[][]; values: string[][]; styles: Array<Array<CellStyle | undefined>> } | null>(null)
  const paintRef = useRef<{ style: CellStyle; repeat: boolean } | null>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [appMenu, setAppMenu] = useState<string | null>(null)
  const [slicerOn, setSlicerOn] = useState(false)
  const [emojiOn, setEmojiOn] = useState(false)
  const [statsText, setStatsText] = useState<string | null>(null)
  const [chartRows, setChartRows] = useState<Array<{ label: string; value: number }> | null>(null)
  const [chartType, setChartType] = useState('bar')
  const [pivotRows, setPivotRows] = useState<Array<{ label: string; count: number }> | null>(null)
  const linkedSheet = useRef(false)
  const scrollRef = useRef(scroll)
  const frameRef = useRef(0)
  const gridWidthRef = useRef(0)
  const gridHeightRef = useRef(0)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const rowSizeList = useMemo(
    () => sheet.rowHeights.map((height, row) => (isRowFilteredOut(sheet, row) ? 0 : height)),
    [sheet],
  )
  const rowMarks = useMemo(
    () => sizeMarks(rowSizeList, sheet.rowSizes, DEFAULT_ROW_HEIGHT, EXCEL_ROWS),
    [rowSizeList, sheet.rowSizes],
  )
  const colMarks = useMemo(
    () => sizeMarks(sheet.columnWidths, sheet.colSizes, DEFAULT_COL_WIDTH, EXCEL_COLS),
    [sheet.columnWidths, sheet.colSizes],
  )
  const gridWidth = offsetAt(colMarks, EXCEL_COLS, DEFAULT_COL_WIDTH)
  const gridHeight = offsetAt(rowMarks, EXCEL_ROWS, DEFAULT_ROW_HEIGHT)
  gridWidthRef.current = gridWidth
  gridHeightRef.current = gridHeight
  const logicalLeft = scroll.left
  const logicalTop = scroll.top
  const cols = visibleIndexes(colMarks, logicalLeft, scroll.width, DEFAULT_COL_WIDTH, EXCEL_COLS)
  const rows = visibleIndexes(rowMarks, logicalTop, scroll.height, DEFAULT_ROW_HEIGHT, EXCEL_ROWS)
  const rowStart = (row: number) => offsetAt(rowMarks, row, DEFAULT_ROW_HEIGHT)
  const colStart = (column: number) => offsetAt(colMarks, column, DEFAULT_COL_WIDTH)
  const rowSize = (row: number) => (row < rowSizeList.length ? rowSizeList[row] : axisSize(sheet.rowHeights, sheet.rowSizes, row, DEFAULT_ROW_HEIGHT))
  const colSize = (column: number) => axisSize(sheet.columnWidths, sheet.colSizes, column, DEFAULT_COL_WIDTH)
  const placeY = (row: number, frozen: boolean) => (frozen ? rowStart(row) : rowStart(row) - logicalTop)
  const placeX = (column: number, frozen: boolean) => (frozen ? colStart(column) : colStart(column) - logicalLeft)
  const vThumb = thumbMetrics(gridHeight, scroll.height, logicalTop, scroll.height)
  const hThumb = thumbMetrics(gridWidth, scroll.width, logicalLeft, scroll.width)

  function publish(next: { left: number; top: number; width: number; height: number }, immediate = false) {
    const clamped = {
      ...next,
      left: clampScroll(next.left, gridWidthRef.current, next.width),
      top: clampScroll(next.top, gridHeightRef.current, next.height),
    }
    scrollRef.current = clamped
    if (immediate) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
      setScroll(clamped)
      return
    }
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      setScroll(scrollRef.current)
    })
  }

  function dragThumb(axis: 'x' | 'y', event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    const metrics = axis === 'y' ? vThumb : hThumb
    if (!metrics) return
    const start = axis === 'y' ? event.clientY : event.clientX
    const total = axis === 'y' ? gridHeight : gridWidth
    const view = axis === 'y' ? scroll.height : scroll.width
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    const move = (ev: PointerEvent) => {
      const delta = (axis === 'y' ? ev.clientY : ev.clientX) - start
      const logical = offsetForThumb(metrics.pos + delta, total, view, view)
      const current = scrollRef.current
      publish({ ...current, left: axis === 'x' ? logical : current.left, top: axis === 'y' ? logical : current.top })
    }
    const stop = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', stop)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', stop)
  }

  function pageTrack(axis: 'x' | 'y', event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    const click = axis === 'y' ? event.clientY - rect.top : event.clientX - rect.left
    const metrics = axis === 'y' ? vThumb : hThumb
    if (!metrics) return
    const page = (axis === 'y' ? scroll.height : scroll.width) * 0.9
    const delta = click < metrics.pos ? -page : page
    const current = scrollRef.current
    publish({ ...current, left: current.left + (axis === 'x' ? delta : 0), top: current.top + (axis === 'y' ? delta : 0) })
  }
  const mergeState = useMemo(() => {
    const box = bounds(selection)
    return mergeMenuState(sheet.merges ?? [], box.r1, box.c1, box.r2, box.c2)
  }, [selection, sheet.merges])

  useEffect(() => {
    const node = gridRef.current
    if (!node) return
    const update = () => {
      publish({ ...scrollRef.current, width: node.clientWidth, height: node.clientHeight }, true)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
  }, [])

  useEffect(() => {
    const nodes = [gridRef.current, colHeaderRef.current, rowHeaderRef.current].filter((node): node is HTMLDivElement => node !== null)
    const onWheel = (event: WheelEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
      if (event.ctrlKey) return
      event.preventDefault()
      const scale = zoomRef.current / 100 || 1
      const unit = event.deltaMode === 1 ? DEFAULT_ROW_HEIGHT : event.deltaMode === 2 ? scrollRef.current.height : 1
      let dx = (event.deltaX * unit) / scale
      let dy = (event.deltaY * unit) / scale
      if (event.shiftKey && dx === 0) {
        dx = dy
        dy = 0
      }
      const current = scrollRef.current
      publish({ ...current, left: current.left + dx, top: current.top + dy })
    }
    nodes.forEach((node) => node.addEventListener('wheel', onWheel, { passive: false }))
    return () => nodes.forEach((node) => node.removeEventListener('wheel', onWheel))
  }, [])

  useEffect(() => {
    if (!appMenu) return
    function close(event: MouseEvent) {
      const target = event.target
      if (target instanceof Element && target.closest('.eq-app-menus')) return
      setAppMenu(null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setAppMenu(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [appMenu])

  useEffect(() => {
    setSelection({ anchorRow: 0, anchorCol: 0, focusRow: 0, focusCol: 0 })
    setEditing(null)
  }, [sheet.id])

  useEffect(() => {
    const node = gridRef.current
    if (!node) return
    const top = offsetAt(rowMarks, selection.focusRow, DEFAULT_ROW_HEIGHT)
    const height = selection.focusRow < rowSizeList.length
      ? rowSizeList[selection.focusRow]
      : axisSize(sheet.rowHeights, sheet.rowSizes, selection.focusRow, DEFAULT_ROW_HEIGHT)
    const left = offsetAt(colMarks, selection.focusCol, DEFAULT_COL_WIDTH)
    const width = axisSize(sheet.columnWidths, sheet.colSizes, selection.focusCol, DEFAULT_COL_WIDTH)
    const frozenTop = offsetAt(rowMarks, sheet.freezeRows || 0, DEFAULT_ROW_HEIGHT)
    const frozenLeft = offsetAt(colMarks, sheet.freezeCols || 0, DEFAULT_COL_WIDTH)
    const current = scrollRef.current
    const viewHeight = node.clientHeight || current.height
    const viewWidth = node.clientWidth || current.width
    let nextTop = current.top
    let nextLeft = current.left
    if (top < nextTop + frozenTop) nextTop = Math.max(0, top - frozenTop)
    else if (top + height > nextTop + viewHeight) nextTop = top + height - viewHeight
    if (left < nextLeft + frozenLeft) nextLeft = Math.max(0, left - frozenLeft)
    else if (left + width > nextLeft + viewWidth) nextLeft = left + width - viewWidth
    if (Math.abs(nextTop - current.top) > 1 || Math.abs(nextLeft - current.left) > 1) {
      publish({ ...current, left: nextLeft, top: nextTop, width: viewWidth, height: viewHeight }, true)
    }
  }, [selection.focusRow, selection.focusCol, rowMarks, colMarks, rowSizeList, sheet, gridHeight, gridWidth])

  useEffect(() => {
    const visible = visibleSheets(workbook).map((item) => item.id)
    setSelectedIds((current) => {
      const kept = current.filter((id) => visible.includes(id))
      return kept.length ? kept : [activeSheet(workbook).id]
    })
  }, [workbook])

  useEffect(() => {
    if (linkedSheet.current) return
    linkedSheet.current = true
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
    const range = parseA1(params.get('range') ?? '')
    if (range) {
      setSelection({ anchorRow: range.row, anchorCol: range.column, focusRow: range.row2, focusCol: range.column2 })
    }
    const id = params.get('sheet')
    if (!id) return
    const target = workbook.sheets.find((item) => item.id === id)
    if (!target) {
      onError('That worksheet is not in this workbook.')
      return
    }
    if (target.id === workbook.activeSheetId && !target.hidden) return
    onChange(
      {
        ...workbook,
        activeSheetId: target.id,
        sheets: workbook.sheets.map((item) => (item.id === target.id ? { ...item, hidden: false } : item)),
      },
      null,
    )
  }, [onChange, onError, workbook])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  function apply(next: EquipmentWorkbook, audit: Audit | null, history = true) {
    if (history) {
      undoRef.current = [...undoRef.current, workbook].slice(-40)
      redoRef.current = []
    }
    onChange(next, audit)
  }

  function guard(action: () => void) {
    if (readOnly) {
      onError('You can view this workbook. Editing requires Equipment Profile edit permission.')
      return
    }
    try {
      action()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Worksheet action failed.')
    }
  }

  function raw(row: number, column: number) {
    return sheet.cells[`${row}:${column}`] ?? ''
  }

  function denial(row: number, column: number): string | null {
    return editBlock?.(row, column) ?? (sheet.lockedCells?.[`${row}:${column}`] ? 'This cell is protected.' : null)
  }

  function denialIn(row1: number, col1: number, row2: number, col2: number): string | null {
    for (let row = Math.min(row1, row2); row <= Math.max(row1, row2); row += 1) {
      for (let column = Math.min(col1, col2); column <= Math.max(col1, col2); column += 1) {
        const reason = denial(row, column)
        if (reason) return reason
      }
    }
    return null
  }

  function openRecord(row: number, column: number) {
    if (onRecordCell) onRecordCell(row, column)
    else onError(denial(row, column) ?? 'This cell is protected.')
  }

  function selectionText() {
    const box = bounds(selection)
    const lines: string[] = []
    for (let row = box.r1; row <= box.r2; row += 1) {
      const line: string[] = []
      for (let column = box.c1; column <= box.c2; column += 1) line.push(raw(row, column))
      lines.push(line.join('\t'))
    }
    return lines.join('\n')
  }

  function groupedIds() {
    return selectedIds.includes(sheet.id) && selectedIds.length > 1 ? selectedIds : [sheet.id]
  }

  function changeGrouped(mutate: (item: EquipmentSheet) => EquipmentSheet, audit: Audit) {
    apply(mapVisibleSelection(workbook, groupedIds(), mutate), audit)
  }

  function writeCell(row: number, column: number, value: string) {
    const reason = denial(row, column)
    if (reason) {
      onError(reason)
      return
    }
    const allowed = sheet.lists?.[cellKey(row, column)]
    if (allowed && value && !allowed.includes(value)) {
      onError(`Enter one of: ${allowed.join(', ')}`)
      return
    }
    const previous = raw(row, column)
    if (previous === value) return
    try {
      changeGrouped((item) => setCellValue(item, row, column, value), {
        action: 'CELL_UPDATED',
        range: addressLabel(row, column),
        oldValue: previous || null,
        newValue: value || null,
      })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Worksheet action failed.')
    }
  }

  function commitEdit(next?: { row: number; column: number }) {
    if (!editing) return
    writeCell(editing.row, editing.column, editing.draft)
    setEditing(null)
    if (next) setSelection({ anchorRow: next.row, anchorCol: next.column, focusRow: next.row, focusCol: next.column })
    gridRef.current?.focus()
  }

  function move(rowDelta: number, colDelta: number, extend: boolean) {
    setSelection((current) => {
      const row = Math.max(0, Math.min(EXCEL_ROWS - 1, current.focusRow + rowDelta))
      const column = Math.max(0, Math.min(EXCEL_COLS - 1, current.focusCol + colDelta))
      return extend
        ? { ...current, focusRow: row, focusCol: column }
        : { anchorRow: row, anchorCol: column, focusRow: row, focusCol: column }
    })
  }

  async function copySelection(cut = false) {
    const text = selectionText()
    const box = bounds(selection)
    const raws: string[][] = []
    const values: string[][] = []
    const styles: Array<Array<CellStyle | undefined>> = []
    for (let row = box.r1; row <= box.r2; row += 1) {
      const rawLine: string[] = []
      const valueLine: string[] = []
      const styleLine: Array<CellStyle | undefined> = []
      for (let column = box.c1; column <= box.c2; column += 1) {
        rawLine.push(raw(row, column))
        valueLine.push(displayCell(sheet, row, column))
        styleLine.push(sheet.styles?.[cellKey(row, column)])
      }
      raws.push(rawLine)
      values.push(valueLine)
      styles.push(styleLine)
    }
    clipRef.current = { raws, values, styles }
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      onError('Clipboard access was blocked by the browser.')
      return
    }
    if (!cut) return
    guard(() => {
      const box = bounds(selection)
      const reason = denialIn(box.r1, box.c1, box.r2, box.c2)
      if (reason) throw new Error(reason)
      changeGrouped((item) => clearRange(item, box.r1, box.c1, box.r2, box.c2), {
        action: 'CELL_UPDATED',
        range: `${addressLabel(box.r1, box.c1)}:${addressLabel(box.r2, box.c2)}`,
        oldValue: text,
        newValue: null,
      })
    })
  }

  function pasteAt(text: string) {
    guard(() => {
      const box = bounds(selection)
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
      if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
      const width = lines.reduce((max, line) => Math.max(max, line.split('\t').length), 1)
      const reason = denialIn(box.r1, box.c1, box.r1 + Math.max(0, lines.length - 1), box.c1 + width - 1)
      if (reason) throw new Error(reason)
      changeGrouped((item) => pasteText(item, box.r1, box.c1, text), {
        action: 'CELL_UPDATED',
        range: addressLabel(box.r1, box.c1),
        oldValue: null,
        newValue: 'Pasted',
      })
    })
  }

  function clearSelection() {
    guard(() => {
      const box = bounds(selection)
      const reason = denialIn(box.r1, box.c1, box.r2, box.c2)
      if (reason) throw new Error(reason)
      changeGrouped((item) => clearRange(item, box.r1, box.c1, box.r2, box.c2), {
        action: 'CELL_UPDATED',
        range: `${addressLabel(box.r1, box.c1)}:${addressLabel(box.r2, box.c2)}`,
        oldValue: selectionText(),
        newValue: null,
      })
    })
  }

  function styleRange(patch: Parameters<typeof applyCellStyle>[5], label: string) {
    const box = bounds(selection)
    changeGrouped((item) => applyCellStyle(item, box.r1, box.c1, box.r2, box.c2, patch), {
      action: 'CELL_UPDATED',
      range: `${addressLabel(box.r1, box.c1)}:${addressLabel(box.r2, box.c2)}`,
      oldValue: null,
      newValue: label,
    })
  }

  function sortSelection(direction: 'asc' | 'desc') {
    const box = bounds(selection)
    let last = 0
    for (const key of Object.keys(sheet.cells)) last = Math.max(last, Number(key.split(':')[0]))
    const row1 = box.r1 === box.r2 ? Math.min(1, last) : box.r1
    const row2 = box.r1 === box.r2 ? last : box.r2
    if (row2 <= row1 && box.r1 === box.r2) return
    guard(() => changeGrouped((item) => sortRowRange(item, row1, row2, selection.focusCol, direction), {
      action: 'CELL_UPDATED',
      range: `${addressLabel(row1, 0)}:${addressLabel(row2, Math.max(0, sheet.columnCount - 1))}`,
      oldValue: null,
      newValue: direction === 'asc' ? 'Sorted A to Z' : 'Sorted Z to A',
    }))
  }

  function usedLastRow() {
    let last = 0
    for (const key of Object.keys(sheet.cells)) last = Math.max(last, Number(key.split(':')[0]))
    return last
  }

  function columnChoices(column: number): string[] {
    const values = new Set<string>()
    const limit = Math.min(sheet.rowCount, Math.max(sheet.rowHeights.length, 1))
    for (let row = 1; row < limit; row += 1) values.add(displayCell(sheet, row, column))
    for (const key of Object.keys(sheet.cells)) {
      const [row, col] = key.split(':').map(Number)
      if (col === column && row >= limit) values.add(displayCell(sheet, row, column))
    }
    return [...values]
  }

  function sheetAudit(label: string): Audit {
    return { action: 'CELL_UPDATED', range: addressLabel(selection.focusRow, selection.focusCol), oldValue: null, newValue: label }
  }

  function handleMenuCommand(command: string): boolean {
    setAppMenu(null)
    const box = bounds(selection)
    const key = cellKey(selection.focusRow, selection.focusCol)
    const column = selection.focusCol
    if (command === 'undo') {
      const previous = undoRef.current.pop()
      if (previous) {
        redoRef.current.push(workbook)
        onChange(previous, null)
      }
      return true
    }
    if (command === 'redo') {
      const next = redoRef.current.pop()
      if (next) {
        undoRef.current.push(workbook)
        onChange(next, null)
      }
      return true
    }
    if (command === 'paste-values' || command === 'paste-formulas' || command === 'paste-formats') {
      const clip = clipRef.current
      if (!clip) {
        onError('Copy cells in this sheet first.')
        return true
      }
      guard(() => {
        if (command === 'paste-formats') {
          changeGrouped((item) => {
            let next = item
            clip.styles.forEach((line, row) => {
              line.forEach((style, col) => {
                if (style) next = applyCellStyle(next, box.r1 + row, box.c1 + col, box.r1 + row, box.c1 + col, style)
              })
            })
            return next
          }, sheetAudit('Formats pasted'))
          return
        }
        const grid = (command === 'paste-values' ? clip.values : clip.raws).map((line) => line.join('\t')).join('\n')
        const width = (command === 'paste-values' ? clip.values : clip.raws).reduce((max, line) => Math.max(max, line.length), 1)
        const height = (command === 'paste-values' ? clip.values : clip.raws).length
        const reason = denialIn(box.r1, box.c1, box.r1 + Math.max(0, height - 1), box.c1 + width - 1)
        if (reason) throw new Error(reason)
        changeGrouped((item) => pasteText(item, box.r1, box.c1, grid), sheetAudit(command === 'paste-values' ? 'Values pasted' : 'Formulas pasted'))
      })
      return true
    }
    if (command === 'sort-sheet-asc' || command === 'sort-sheet-desc') {
      const last = usedLastRow()
      if (last < 1) return true
      const direction = command.endsWith('asc') ? 'asc' : 'desc'
      guard(() => changeGrouped((item) => sortRowRange(item, 1, last, column, direction), sheetAudit('Sheet sorted')))
      return true
    }
    if (command === 'sort-range-asc' || command === 'sort-range-desc') {
      if (box.r1 === box.r2) {
        onError('Select at least two rows to sort a range.')
        return true
      }
      const direction = command.endsWith('asc') ? 'asc' : 'desc'
      guard(() => changeGrouped((item) => sortRowRange(item, box.r1, box.r2, column, direction), sheetAudit('Range sorted')))
      return true
    }
    if (command === 'sort-color' || command === 'sort-font') {
      const style = sheet.styles?.[key]
      const wanted = command === 'sort-color' ? style?.fill : style?.color
      if (!wanted) {
        onError(command === 'sort-color' ? 'The selected cell has no fill color.' : 'The selected cell has no font color.')
        return true
      }
      const last = box.r1 === box.r2 ? usedLastRow() : box.r2
      const row1 = box.r1 === box.r2 ? 1 : box.r1
      guard(() => changeGrouped((item) => rearrangeRows(item, row1, last, (left, right) => {
        const leftStyle = item.styles?.[cellKey(left, column)]
        const rightStyle = item.styles?.[cellKey(right, column)]
        const leftMatch = (command === 'sort-color' ? leftStyle?.fill : leftStyle?.color) === wanted
        const rightMatch = (command === 'sort-color' ? rightStyle?.fill : rightStyle?.color) === wanted
        return Number(rightMatch) - Number(leftMatch)
      }), sheetAudit('Sorted by color')))
      return true
    }
    if (command === 'sort-custom') {
      const answer = window.prompt('Type A to Z or Z to A')
      if (!answer) return true
      const direction = /z/i.test(answer) ? 'desc' : 'asc'
      sortSelection(direction)
      return true
    }
    if (command === 'filter-create') {
      const values = columnChoices(column)
      guard(() => changeGrouped((item) => setSheetFilter(item, { column, headerRow: 0, values, fill: null, fontColor: null }), sheetAudit('Filter created')))
      return true
    }
    if (command === 'filter-fill' || command === 'filter-font') {
      const style = sheet.styles?.[key]
      const fill = command === 'filter-fill' ? style?.fill ?? null : null
      const fontColor = command === 'filter-font' ? style?.color ?? null : null
      if (command === 'filter-fill' && !fill) {
        onError('The selected cell has no fill color.')
        return true
      }
      if (command === 'filter-font' && !fontColor) {
        onError('The selected cell has no font color.')
        return true
      }
      guard(() => changeGrouped((item) => setSheetFilter(item, { column, headerRow: 0, values: null, fill, fontColor }), sheetAudit('Filtered by color')))
      return true
    }
    if (command === 'filter-reapply') {
      if (!sheet.filter) {
        onError('There is no filter to reapply.')
        return true
      }
      guard(() => changeGrouped((item) => setSheetFilter(item, { ...sheet.filter! }), sheetAudit('Filter reapplied')))
      return true
    }
    if (command === 'group-by') {
      const last = usedLastRow()
      if (last < 1) return true
      guard(() => changeGrouped((item) => sortRowRange(item, 1, last, column, 'asc'), sheetAudit(`Grouped by ${columnLabel(column)}`)))
      return true
    }
    if (command === 'filter-view-save') {
      if (!sheet.filter) {
        onError('Create a filter before saving a filter view.')
        return true
      }
      const name = window.prompt('Filter view name')
      if (!name?.trim()) return true
      const filter = sheet.filter
      guard(() => changeGrouped((item) => ({
        ...item,
        filterViews: [...(item.filterViews ?? []).filter((view) => view.name !== name.trim()), { name: name.trim(), filter }],
      }), sheetAudit(`Filter view ${name.trim()}`)))
      return true
    }
    if (command.startsWith('filter-view:')) {
      const name = command.slice('filter-view:'.length)
      const view = sheet.filterViews?.find((item) => item.name === name)
      if (!view) return true
      guard(() => changeGrouped((item) => setSheetFilter(item, view.filter), sheetAudit(name)))
      return true
    }
    if (command === 'slicer') {
      setSlicerOn(true)
      return true
    }
    if (command === 'protect-range') {
      guard(() => changeGrouped((item) => {
        const lockedCells = { ...(item.lockedCells ?? {}) }
        for (let row = box.r1; row <= box.r2; row += 1) {
          for (let col = box.c1; col <= box.c2; col += 1) lockedCells[cellKey(row, col)] = true
        }
        return { ...item, lockedCells }
      }, sheetAudit('Range protected')))
      setSheetDialog({ kind: 'protect', sheetId: sheet.id })
      return true
    }
    if (command === 'named-range') {
      const name = window.prompt('Name for the selected cells')
      if (!name?.trim()) return true
      const address = box.r1 === box.r2 && box.c1 === box.c2
        ? addressLabel(box.r1, box.c1)
        : `${addressLabel(box.r1, box.c1)}:${addressLabel(box.r2, box.c2)}`
      guard(() => changeGrouped((item) => ({ ...item, namedRanges: { ...(item.namedRanges ?? {}), [name.trim()]: address } }), sheetAudit(name.trim())))
      return true
    }
    if (command === 'named-function') {
      const name = window.prompt('Function name')
      const body = name ? window.prompt('Formula without the equals sign, for example SUM(A1:A10)') : null
      if (!name?.trim() || !body?.trim()) return true
      guard(() => {
        changeGrouped((item) => ({ ...item, snippets: { ...(item.snippets ?? {}), [name.trim().toUpperCase()]: body.trim() } }), sheetAudit(name.trim()))
        writeCell(selection.focusRow, selection.focusCol, `=${body.trim()}`)
      })
      return true
    }
    if (command === 'column-stats') {
      const stats = columnStats(sheet, column, 0, Math.max(usedLastRow(), box.r2))
      setStatsText(`${columnLabel(column)}: count ${stats.count}, blanks ${stats.blanks}, sum ${Math.round(stats.sum * 100) / 100}, average ${Math.round(stats.average * 100) / 100}, min ${stats.min}, max ${stats.max}`)
      return true
    }
    if (command === 'trim') {
      guard(() => changeGrouped((item) => trimCells(item, box.r1, box.c1, box.r2, box.c2), sheetAudit('Trimmed')))
      return true
    }
    if (command === 'dedupe') {
      const last = box.r1 === box.r2 ? usedLastRow() : box.r2
      const row1 = box.r1 === box.r2 ? 1 : box.r1
      guard(() => changeGrouped((item) => removeDuplicateRows(item, row1, last, column), sheetAudit('Duplicates removed')))
      return true
    }
    if (command === 'extract') {
      const last = box.r1 === box.r2 ? usedLastRow() : box.r2
      const row1 = box.r1 === box.r2 ? 0 : box.r1
      guard(() => changeGrouped((item) => extractUnique(item, column, row1, last), sheetAudit('Unique values extracted')))
      return true
    }
    if (command === 'shuffle') {
      if (box.r1 === box.r2) {
        onError('Select at least two rows to randomize.')
        return true
      }
      guard(() => changeGrouped((item) => shuffleRows(item, box.r1, box.r2), sheetAudit('Randomized')))
      return true
    }
    if (command === 'insert-row-above' || command === 'insert-row-below') {
      const at = command.endsWith('below') ? selection.focusRow + 1 : selection.focusRow
      guard(() => changeGrouped((item) => insertRow(item, at), { action: 'ROW_INSERTED', range: `Row ${at + 1}`, oldValue: null, newValue: 'Inserted' }))
      return true
    }
    if (command === 'insert-col-left' || command === 'insert-col-right') {
      const at = command.endsWith('right') ? column + 1 : column
      guard(() => changeGrouped((item) => insertColumn(item, at), { action: 'COLUMN_INSERTED', range: columnLabel(at), oldValue: null, newValue: 'Inserted' }))
      return true
    }
    if (command === 'delete-row') {
      guard(() => changeGrouped((item) => deleteRow(item, selection.focusRow), { action: 'ROW_DELETED', range: `Row ${selection.focusRow + 1}`, oldValue: null, newValue: 'Deleted' }))
      return true
    }
    if (command === 'delete-col') {
      guard(() => changeGrouped((item) => deleteColumn(item, column), { action: 'COLUMN_DELETED', range: columnLabel(column), oldValue: null, newValue: 'Deleted' }))
      return true
    }
    if (command === 'add-sheet') {
      guard(() => apply(addSheet(workbook), { action: 'SHEET_CREATED', range: null, oldValue: null, newValue: 'New sheet' }))
      return true
    }
    if (command.startsWith('fn-')) {
      const name = command.slice(3)
      if (name === 'SUM') writeCell(selection.focusRow, selection.focusCol, autoSumFormula(sheet, selection.focusRow, selection.focusCol))
      else if (name === 'ROUND') writeCell(selection.focusRow, selection.focusCol, '=ROUND(0,2)')
      else writeCell(selection.focusRow, selection.focusCol, `=${name}()`)
      return true
    }
    if (command === 'checkbox') {
      guard(() => changeGrouped((item) => {
        const current = item.cells[key] === 'TRUE'
        const next = setCellValue(item, selection.focusRow, column, current ? 'FALSE' : 'TRUE')
        return { ...next, checkboxes: { ...(next.checkboxes ?? {}), [key]: true } }
      }, sheetAudit('Checkbox')))
      return true
    }
    if (command === 'dropdown') {
      const entered = window.prompt('Allowed values, separated by commas')
      if (!entered?.trim()) return true
      const values = entered.split(',').map((item) => item.trim()).filter(Boolean)
      guard(() => changeGrouped((item) => ({ ...item, lists: { ...(item.lists ?? {}), [key]: values } }), sheetAudit('Dropdown')))
      return true
    }
    if (command === 'emoji') {
      setEmojiOn(true)
      return true
    }
    if (command.startsWith('emoji:')) {
      const symbol = command.slice('emoji:'.length)
      writeCell(selection.focusRow, selection.focusCol, `${raw(selection.focusRow, selection.focusCol)}${symbol}`)
      setEmojiOn(false)
      return true
    }
    if (command === 'comment') {
      const existing = sheet.comments?.[key] ?? ''
      const entered = window.prompt(existing ? 'Reply, or type RESOLVE' : 'Comment', existing ? '' : '')
      if (entered == null) return true
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const line = entered.trim().toUpperCase() === 'RESOLVE' ? `[Resolved ${stamp}] ${existing}` : existing ? `${existing}\n${stamp}: ${entered.trim()}` : `${stamp}: ${entered.trim()}`
      guard(() => changeGrouped((item) => {
        const comments = { ...(item.comments ?? {}) }
        if (line.trim()) comments[key] = line
        else delete comments[key]
        return { ...item, comments }
      }, sheetAudit('Comment')))
      return true
    }
    if (command === 'rotate-0' || command === 'rotate-90' || command === 'rotate-up' || command === 'rotate-down' || command === 'rotate-vert') {
      const angle = command === 'rotate-down' ? -90 : command === 'rotate-0' ? 0 : 90
      guard(() => styleRange({ rotate: angle }, 'Rotation'))
      return true
    }
    if (command === 'rotate-ask') {
      const angle = Number(window.prompt('Rotation angle in degrees', '45'))
      if (!Number.isFinite(angle)) return true
      guard(() => styleRange({ rotate: angle }, 'Rotation'))
      return true
    }
    if (command === 'font-dec' || command === 'font-inc') {
      const size = sheet.styles?.[key]?.fontSize ?? 12
      guard(() => styleRange({ fontSize: Math.min(72, Math.max(6, size + (command.endsWith('inc') ? 1 : -1))) }, 'Font size'))
      return true
    }
    if (command.startsWith('family-')) {
      guard(() => styleRange({ fontFamily: command.slice(7) }, 'Font'))
      return true
    }
    if (command.startsWith('color-')) {
      guard(() => styleRange({ color: command.slice(6) }, 'Text color'))
      return true
    }
    if (command === 'fill-none') {
      guard(() => styleRange({ fill: '' }, 'No fill'))
      return true
    }
    if (command === 'strike') {
      guard(() => styleRange({ strike: !sheet.styles?.[key]?.strike }, 'Strikethrough'))
      return true
    }
    if (command.startsWith('valign-')) {
      guard(() => styleRange({ valign: command.slice(7) as 'top' | 'middle' | 'bottom' }, 'Vertical align'))
      return true
    }
    if (command === 'wrap-wrap' || command === 'wrap-clip' || command === 'wrap-overflow' || command === 'clip') {
      const wrapMode = command === 'wrap-wrap' ? 'wrap' : command === 'wrap-overflow' ? 'overflow' : 'clip'
      guard(() => styleRange({ wrap: wrapMode === 'wrap', wrapMode }, 'Wrap'))
      return true
    }
    if (command === 'decimals-inc' || command === 'decimals-dec') {
      const current = sheet.styles?.[key]?.decimals ?? 0
      const decimals = command.endsWith('inc') ? Math.min(10, current + 1) : Math.max(0, current - 1)
      const format = sheet.styles?.[key]?.format && sheet.styles[key].format !== 'general' && sheet.styles[key].format !== 'text' ? sheet.styles[key].format : 'number'
      guard(() => styleRange({ decimals, format }, 'Decimals'))
      return true
    }
    if (command === 'currency-ask') {
      const symbol = window.prompt('Currency symbol', sheet.styles?.[key]?.currency ?? '$')
      if (!symbol?.trim()) return true
      guard(() => styleRange({ format: 'currency', currency: symbol.trim().slice(0, 4), decimals: sheet.styles?.[key]?.decimals ?? 2 }, 'Currency'))
      return true
    }
    if (command === 'paint' || command === 'paint-lock') {
      paintRef.current = { style: { ...(sheet.styles?.[key] ?? {}) }, repeat: command === 'paint-lock' }
      setNotice(command === 'paint-lock' ? 'Paint format stays on until you press Escape.' : 'Paint format armed for the next cell.')
      return true
    }
    if (command === 'print') {
      setPrintOpen(true)
      return true
    }
    if (command === 'zoom-custom') {
      const next = Number(window.prompt('Zoom percent from 50 to 200', String(zoom)))
      if (next >= 50 && next <= 200) setZoom(next)
      else onError('Enter a zoom from 50 to 200.')
      return true
    }
    if (command.startsWith('border-')) {
      const mode = command.slice(7)
      const line = mode === 'dashed' || mode === 'dotted' ? mode : (sheet.styles?.[key]?.borderStyle ?? 'solid')
      const borderMode = mode === 'dashed' || mode === 'dotted' ? 'all' : mode
      if (!['all', 'outer', 'inner', 'top', 'bottom', 'left', 'right', 'none'].includes(borderMode)) return true
      guard(() => changeGrouped((item) => applyBorders(item, box.r1, box.c1, box.r2, box.c2, borderMode as 'all', sheet.styles?.[key]?.borderColor ?? '#202124', line), sheetAudit('Borders')))
      return true
    }
    if (command === 'merge-all' || command === 'merge' || command === 'merge-h' || command === 'merge-v') {
      const mode = command === 'merge-h' ? 'h' : command === 'merge-v' ? 'v' : 'all'
      const allowed = mode === 'h' ? mergeState.canMergeHorizontal : mode === 'v' ? mergeState.canMergeVertical : mergeState.canMerge
      if (!allowed) {
        onError(mergeState.canUnmerge ? 'Unmerge these cells before merging them again.' : 'Select more than one unmerged cell.')
        return true
      }
      const discarded = mergeDiscardCount(sheet, box.r1, box.c1, box.r2, box.c2, mode)
      if (discarded > 0 && !window.confirm('Merging keeps the top-left value and discards the other values in the selection. Continue?')) return true
      guard(() => changeGrouped((item) => mergeCells(item, box.r1, box.c1, box.r2, box.c2, mode), sheetAudit('Merged')))
      return true
    }
    if (command === 'unmerge') {
      if (!mergeState.canUnmerge) return true
      guard(() => changeGrouped((item) => unmergeCells(item, box.r1, box.c1, box.r2, box.c2), sheetAudit('Unmerged')))
      return true
    }
    if (command.startsWith('font-')) {
      guard(() => styleRange({ fontSize: Number(command.slice(5)) }, 'Font size'))
      return true
    }
    if (command === 'table') {
      guard(() => changeGrouped((item) => {
        let next = applyCellStyle(item, 0, box.c1, 0, box.c2, { bold: true, fill: '#e7f4f3' })
        for (let row = box.r1; row <= Math.max(box.r2, usedLastRow()); row += 1) {
          if (row > 0 && row % 2 === 0) next = applyCellStyle(next, row, box.c1, row, box.c2, { fill: '#f7f7f5' })
        }
        const values = new Set<string>()
        for (let row = 1; row <= usedLastRow(); row += 1) values.add(displayCell(next, row, column))
        return setSheetFilter(next, { column, headerRow: 0, values: [...values], fill: null, fontColor: null })
      }, sheetAudit('Table')))
      return true
    }
    if (command === 'conditional') {
      const value = window.prompt('Highlight cells greater than')
      if (!value?.trim()) return true
      guard(() => changeGrouped((item) => highlightMatches(item, column, box.r1, Math.max(box.r2, usedLastRow()), 'gt', value.trim(), '#fff2cc'), sheetAudit('Conditional format')))
      return true
    }
    if (command === 'band') {
      guard(() => changeGrouped((item) => {
        let next = item
        for (let row = box.r1; row <= box.r2; row += 1) {
          if (row % 2 === 0) next = applyCellStyle(next, row, box.c1, row, box.c2, { fill: '#f3f6f4' })
        }
        return next
      }, sheetAudit('Alternating colors')))
      return true
    }
    if (command === 'chart') {
      const rows: Array<{ label: string; value: number }> = []
      for (let row = box.r1; row <= box.r2; row += 1) {
        const value = Number(displayCell(sheet, row, column).replace(/%$/, ''))
        if (Number.isFinite(value)) rows.push({ label: displayCell(sheet, row, Math.max(0, column - 1)) || addressLabel(row, column), value })
      }
      if (!rows.length) onError('Select numeric cells to chart.')
      else setChartRows(rows)
      return true
    }
    if (command === 'pivot') {
      const counts = new Map<string, number>()
      const last = box.r1 === box.r2 ? usedLastRow() : box.r2
      const row1 = box.r1 === box.r2 ? 1 : box.r1
      for (let row = row1; row <= last; row += 1) {
        const label = displayCell(sheet, row, column) || '(blank)'
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
      setPivotRows([...counts.entries()].map(([label, count]) => ({ label, count })))
      return true
    }
    if (command === 'image') {
      imageRef.current?.click()
      return true
    }
    if (command === 'link-range') {
      const url = new URL(window.location.href)
      const [path, query = ''] = url.hash.split('?')
      const params = new URLSearchParams(query)
      params.set('sheet', sheet.id)
      params.set('range', box.r1 === box.r2 && box.c1 === box.c2 ? addressLabel(box.r1, box.c1) : `${addressLabel(box.r1, box.c1)}:${addressLabel(box.r2, box.c2)}`)
      url.hash = `${path}?${params.toString()}`
      void navigator.clipboard.writeText(url.toString()).then(() => setNotice('Link copied')).catch(() => onError('Clipboard access was blocked by the browser.'))
      return true
    }
    if (command === 'font-color-ask') {
      const value = window.prompt('Font color, for example #1a1a1a')
      if (!value) return true
      if (!/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
        onError('Enter a color like #1a1a1a.')
        return true
      }
      guard(() => styleRange({ color: value.trim() }, 'Font color'))
      return true
    }
    return false
  }

  function runCommand(command: string) {
    setMenu(null)
    if (handleMenuCommand(command)) return
    if (command === 'copy') {
      void copySelection(false)
      return
    }
    if (command === 'cut') {
      void copySelection(true)
      return
    }
    if (command === 'paste') {
      void navigator.clipboard.readText().then(pasteAt).catch(() => onError('Clipboard access was blocked by the browser.'))
      return
    }
    if (command === 'find') {
      setFind({ query: '', matchCase: false })
      return
    }
    if (command === 'export-csv') {
      const blob = new Blob([sheetToCsv(sheet)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${sheet.name}.csv`
      link.click()
      URL.revokeObjectURL(url)
      return
    }
    if (command === 'import-csv') {
      csvRef.current?.click()
      return
    }
    if (command.startsWith('zoom-')) {
      setZoom(Number(command.slice(5)))
      return
    }
    if (command === 'protect') {
      setSheetDialog({ kind: 'protect', sheetId: sheet.id })
      return
    }
    guard(() => {
      const box = bounds(selection)
      const key = cellKey(selection.focusRow, selection.focusCol)
      if (command === 'bold' || command === 'italic' || command === 'underline' || command === 'wrap') {
        styleRange({ [command]: !sheet.styles?.[key]?.[command] }, command)
      } else if (command.startsWith('align-')) {
        const align = command.slice(6) as 'left' | 'center' | 'right'
        styleRange({ align }, align)
      } else if (command.startsWith('format-')) {
        styleRange({ format: command.slice(7) as 'general' | 'text' | 'number' | 'percent' | 'currency' | 'date' | 'time' | 'scientific' }, command)
      } else if (command.startsWith('fill-')) {
        styleRange({ fill: command.slice(5) }, 'Fill')
      } else if (command === 'clear') clearSelection()
      else if (command === 'clear-formats') styleRange(null, 'Formats cleared')
      else if (command === 'sort-asc' || command === 'sort-desc') sortSelection(command === 'sort-asc' ? 'asc' : 'desc')
      else if (command === 'filter') {
        const value = displayCell(sheet, selection.focusRow, selection.focusCol)
        changeGrouped((item) => setSheetFilter(item, { column: selection.focusCol, headerRow: 0, values: [value] }), {
          action: 'CELL_UPDATED',
          range: columnLabel(selection.focusCol),
          oldValue: null,
          newValue: `Filter ${value}`,
        })
      } else if (command === 'clear-filter') {
        changeGrouped((item) => setSheetFilter(item, null), { action: 'CELL_UPDATED', range: null, oldValue: null, newValue: 'Filter cleared' })
      } else if (command === 'autosum') {
        writeCell(selection.focusRow, selection.focusCol, autoSumFormula(sheet, selection.focusRow, selection.focusCol))
      } else if (command === 'split') {
        changeGrouped((item) => splitTextToColumns(item, selection.focusCol, box.r1, box.r2, ','), {
          action: 'CELL_UPDATED',
          range: columnLabel(selection.focusCol),
          oldValue: null,
          newValue: 'Split on comma',
        })
      } else if (command === 'link') {
        const entered = window.prompt('Link address')
        if (!entered) return
        let safe = ''
        try {
          const url = new URL(entered.trim())
          if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad')
          safe = url.toString()
        } catch {
          onError('Enter an http or https link.')
          return
        }
        changeGrouped((item) => ({ ...item, links: { ...(item.links ?? {}), [key]: safe } }), {
          action: 'CELL_UPDATED',
          range: addressLabel(selection.focusRow, selection.focusCol),
          oldValue: sheet.links?.[key] ?? null,
          newValue: safe,
        })
      } else if (command === 'note') {
        const entered = window.prompt('Note', sheet.notes?.[key] ?? '')
        if (entered == null) return
        const notes = { ...(sheet.notes ?? {}) }
        if (entered.trim()) notes[key] = entered
        else delete notes[key]
        changeGrouped((item) => ({ ...item, notes }), {
          action: 'CELL_UPDATED',
          range: addressLabel(selection.focusRow, selection.focusCol),
          oldValue: sheet.notes?.[key] ?? null,
          newValue: entered || null,
        })
      } else if (command === 'freeze-row') {
        changeGrouped((item) => ({ ...item, freezeRows: 1 }), { action: 'CELL_UPDATED', range: null, oldValue: null, newValue: 'Freeze top row' })
      } else if (command === 'freeze-col') {
        changeGrouped((item) => ({ ...item, freezeCols: 1 }), { action: 'CELL_UPDATED', range: null, oldValue: null, newValue: 'Freeze first column' })
      } else if (command === 'unfreeze') {
        changeGrouped((item) => ({ ...item, freezeRows: 0, freezeCols: 0 }), { action: 'CELL_UPDATED', range: null, oldValue: null, newValue: 'Unfreeze' })
      } else if (command === 'gridlines') {
        changeGrouped((item) => ({ ...item, showGridlines: item.showGridlines === false }), { action: 'CELL_UPDATED', range: null, oldValue: null, newValue: 'Gridlines' })
      } else if (command === 'headings') {
        changeGrouped((item) => ({ ...item, showHeadings: item.showHeadings === false }), { action: 'CELL_UPDATED', range: null, oldValue: null, newValue: 'Headings' })
      } else if (command === 'formula-bar') {
        changeGrouped((item) => ({ ...item, showFormulaBar: item.showFormulaBar === false }), { action: 'CELL_UPDATED', range: null, oldValue: null, newValue: 'Formula bar' })
      }
    })
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (editing) return
    const key = event.key
    const meta = event.ctrlKey || event.metaKey
    if (meta && key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      const previous = undoRef.current.pop()
      if (!previous) return
      redoRef.current.push(workbook)
      onChange(previous, null)
      return
    }
    if (meta && (key.toLowerCase() === 'y' || (event.shiftKey && key.toLowerCase() === 'z'))) {
      event.preventDefault()
      const next = redoRef.current.pop()
      if (!next) return
      undoRef.current.push(workbook)
      onChange(next, null)
      return
    }
    if (meta && key.toLowerCase() === 'c') {
      event.preventDefault()
      void copySelection(false)
      return
    }
    if (meta && key.toLowerCase() === 'x') {
      event.preventDefault()
      void copySelection(true)
      return
    }
    if (meta && key.toLowerCase() === 'v') {
      event.preventDefault()
      void navigator.clipboard.readText().then(pasteAt).catch(() => onError('Clipboard access was blocked by the browser.'))
      return
    }
    if (meta && key.toLowerCase() === 'b') {
      event.preventDefault()
      runCommand('bold')
      return
    }
    if (meta && key.toLowerCase() === 'i') {
      event.preventDefault()
      runCommand('italic')
      return
    }
    if (meta && key.toLowerCase() === 'u') {
      event.preventDefault()
      runCommand('underline')
      return
    }
    if (meta && key.toLowerCase() === 'f') {
      event.preventDefault()
      setFind({ query: '', matchCase: false })
      return
    }
    if (key === 'Escape') {
      paintRef.current = null
      return
    }
    if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault()
      clearSelection()
      return
    }
    if (key === 'Home') {
      event.preventDefault()
      if (meta) {
        setSelection({ anchorRow: 0, anchorCol: 0, focusRow: 0, focusCol: 0 })
        return
      }
      setSelection((current) => (event.shiftKey
        ? { ...current, focusCol: 0 }
        : { anchorRow: current.focusRow, anchorCol: 0, focusRow: current.focusRow, focusCol: 0 }))
      return
    }
    if (key === 'End' && meta) {
      event.preventDefault()
      const used = usedCorner(sheet)
      setSelection((current) => (event.shiftKey
        ? { ...current, focusRow: used.row, focusCol: used.column }
        : { anchorRow: used.row, anchorCol: used.column, focusRow: used.row, focusCol: used.column }))
      return
    }
    if (key === 'PageDown' || key === 'PageUp') {
      event.preventDefault()
      const page = Math.max(1, Math.floor(scroll.height / DEFAULT_ROW_HEIGHT) - 1)
      move(key === 'PageDown' ? page : -page, 0, event.shiftKey)
      return
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(key)) {
      event.preventDefault()
      const rowDelta = key === 'ArrowUp' ? -1 : key === 'ArrowDown' || key === 'Enter' ? 1 : 0
      const colDelta = key === 'ArrowLeft' || (key === 'Tab' && event.shiftKey) ? -1 : key === 'ArrowRight' || key === 'Tab' ? 1 : 0
      const enterDelta = key === 'Enter' && event.shiftKey ? -1 : rowDelta
      move(key === 'Enter' ? enterDelta : rowDelta, colDelta, event.shiftKey && key !== 'Tab' && key !== 'Enter')
      return
    }
    if (key === 'F2') {
      event.preventDefault()
      if (denial(selection.focusRow, selection.focusCol)) {
        openRecord(selection.focusRow, selection.focusCol)
        return
      }
      guard(() => setEditing({ row: selection.focusRow, column: selection.focusCol, draft: raw(selection.focusRow, selection.focusCol) }))
      return
    }
    if (key.length === 1 && !meta && !event.altKey) {
      event.preventDefault()
      const reason = denial(selection.focusRow, selection.focusCol)
      if (reason) {
        onError(reason)
        return
      }
      guard(() => setEditing({ row: selection.focusRow, column: selection.focusCol, draft: key }))
    }
  }

  function startResize(event: ReactPointerEvent, axis: 'col' | 'row', index: number) {
    event.preventDefault()
    event.stopPropagation()
    const ids = groupedIds()
    try {
      if (readOnly) throw new Error('You can view this workbook. Editing requires Equipment Profile edit permission.')
      workbook.sheets.filter((item) => ids.includes(item.id)).forEach((item) => assertSheetAction(item, 'format'))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Worksheet action failed.')
      return
    }
    const start = axis === 'col' ? event.clientX : event.clientY
    const base = sheet
    const initial = axis === 'col'
      ? axisSize(base.columnWidths, base.colSizes, index, DEFAULT_COL_WIDTH)
      : axisSize(base.rowHeights, base.rowSizes, index, DEFAULT_ROW_HEIGHT)
    function movePointer(pointer: PointerEvent) {
      const delta = (axis === 'col' ? pointer.clientX : pointer.clientY) - start
      const size = Math.max(32, initial + delta)
      const written = axis === 'col'
        ? writeAxisSize(base.columnWidths, base.colSizes, index, size, DEFAULT_COL_WIDTH)
        : writeAxisSize(base.rowHeights, base.rowSizes, index, size, DEFAULT_ROW_HEIGHT)
      const next = axis === 'col'
        ? { ...base, columnWidths: written.dense, colSizes: written.extra }
        : { ...base, rowHeights: written.dense, rowSizes: written.extra }
      const sized = (item: EquipmentSheet) => {
        if (item.id === base.id) return next
        const itemWritten = axis === 'col'
          ? writeAxisSize(item.columnWidths, item.colSizes, index, size, DEFAULT_COL_WIDTH)
          : writeAxisSize(item.rowHeights, item.rowSizes, index, size, DEFAULT_ROW_HEIGHT)
        return axis === 'col'
          ? { ...item, columnWidths: itemWritten.dense, colSizes: itemWritten.extra }
          : { ...item, rowHeights: itemWritten.dense, rowSizes: itemWritten.extra }
      }
      onChange(mapVisibleSelection(workbook, ids, sized), null)
    }
    function stop() {
      window.removeEventListener('pointermove', movePointer)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', movePointer)
    window.addEventListener('pointerup', stop)
  }

  function openMenu(event: React.MouseEvent, next: Omit<MenuState, 'x' | 'y'>) {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ ...next, x: event.clientX, y: event.clientY })
  }

  function runWorkbook(next: () => EquipmentWorkbook, audit: Audit) {
    guard(() => apply(next(), audit))
    setMenu(null)
  }

  function finishRename() {
    if (!renaming) return
    const current = renaming
    const currentSheet = workbook.sheets.find((item) => item.id === current.id)
    setRenaming(null)
    if (!currentSheet || current.name.trim() === currentSheet.name) return
    guard(() => apply(renameSheet(workbook, current.id, current.name), { action: 'SHEET_RENAMED', range: current.name.trim(), oldValue: currentSheet.name, newValue: current.name.trim() }))
  }

  function openSheetMenu(sheetId: string, x: number, y: number) {
    setMenu(null)
    setSelectedIds((current) => (current.includes(sheetId) && current.length > 1 ? current : [sheetId]))
    if (workbook.activeSheetId !== sheetId || workbook.sheets.find((item) => item.id === sheetId)?.hidden) {
      onChange({ ...workbook, activeSheetId: sheetId }, null)
    }
    setSheetMenu({ x, y, sheetId })
  }

  function applySheet(build: () => EquipmentWorkbook, audit: SheetMenuAudit) {
    guard(() => {
      apply(build(), audit)
      setSheetDialog(null)
      setSheetMenu(null)
    })
  }

  const rowIndexes = axisIndexes(rows, sheet.freezeRows || 0, sheet.merges, 'row', cols.start, cols.end)
  const colIndexes = axisIndexes(cols, sheet.freezeCols || 0, sheet.merges, 'column', rows.start, rows.end)
  const cells = rowIndexes.flatMap((row) =>
    colIndexes.map((column) => {
      const active = selection.focusRow === row && selection.focusCol === column
      const editingHere = editing?.row === row && editing.column === column
      const style = sheet.styles?.[`${row}:${column}`]
      const merge = (sheet.merges ?? []).find((item) => row >= item.r1 && row <= item.r2 && column >= item.c1 && column <= item.c2)
      if (merge && (row !== merge.r1 || column !== merge.c1)) return null
      const frozenRow = row < (sheet.freezeRows || 0)
      const frozenCol = column < (sheet.freezeCols || 0)
      let width = colSize(column)
      let height = rowSize(row)
      if (merge) {
        width = 0
        height = 0
        for (let col = merge.c1; col <= merge.c2; col += 1) width += colSize(col)
        for (let index = merge.r1; index <= merge.r2; index += 1) height += rowSize(index)
      }
      const rawTop = placeY(row, frozenRow)
      const rawLeft = placeX(column, frozenCol)
      const oversized = height > scroll.height + 64 || width > scroll.width + 64 || rawTop < -scroll.height || rawLeft < -scroll.width
      const paintBottom = oversized ? Math.min(rawTop + height, scroll.height + 1) : rawTop + height
      const paintRight = oversized ? Math.min(rawLeft + width, scroll.width + 1) : rawLeft + width
      const paintTop = oversized ? Math.max(rawTop, -1) : rawTop
      const paintLeft = oversized ? Math.max(rawLeft, -1) : rawLeft
      const paintWidth = paintRight - paintLeft
      const paintHeight = paintBottom - paintTop
      if (paintWidth < 1 || paintHeight < 1) return null
      const showValue = !oversized || (paintTop === rawTop && paintLeft === rawLeft)
      const cellRaw = sheet.cells[`${row}:${column}`] ?? ''
      const shown = displayCell(sheet, row, column)
      const custom = renderCell?.(row, column, shown)
      return (
        <div
          key={`${row}:${column}`}
          role="gridcell"
          className={`eq-cell${covers(selection, row, column) ? ' is-selected' : ''}${active ? ' is-active' : ''}${sheet.links?.[`${row}:${column}`] ? ' is-link' : ''}`}
          style={{
            left: paintLeft,
            top: paintTop,
            width: paintWidth,
            height: paintHeight,
            zIndex: frozenRow || frozenCol || merge ? 4 : undefined,
            fontWeight: style?.bold ? 700 : undefined,
            fontStyle: style?.italic ? 'italic' : undefined,
            textDecoration: [style?.underline ? 'underline' : '', style?.strike ? 'line-through' : ''].filter(Boolean).join(' ') || undefined,
            textAlign: style?.align,
            fontFamily: style?.fontFamily,
            display: 'flex',
            alignItems: style?.valign === 'top' ? 'flex-start' : style?.valign === 'bottom' ? 'flex-end' : 'center',
            whiteSpace: style?.wrapMode === 'wrap' || style?.wrap ? 'pre-wrap' : 'nowrap',
            overflow: style?.wrapMode === 'overflow' ? 'visible' : 'hidden',
            background: covers(selection, row, column) ? undefined : style?.fill || undefined,
            color: style?.color,
            fontSize: style?.fontSize,
            writingMode: style?.rotate === 90 || style?.rotate === -90 ? 'vertical-rl' : undefined,
            transform: style?.rotate && Math.abs(style.rotate) !== 90 ? `rotate(${style.rotate}deg)` : undefined,
            borderTop: style?.borderTop ? `1px ${style.borderStyle ?? 'solid'} ${style.borderColor ?? '#202124'}` : undefined,
            borderRight: style?.borderRight ? `1px ${style.borderStyle ?? 'solid'} ${style.borderColor ?? '#202124'}` : undefined,
            borderBottom: style?.borderBottom ? `1px ${style.borderStyle ?? 'solid'} ${style.borderColor ?? '#202124'}` : undefined,
            borderLeft: style?.borderLeft ? `1px ${style.borderStyle ?? 'solid'} ${style.borderColor ?? '#202124'}` : undefined,
          }}
          onMouseDown={(event) => {
            const link = sheet.links?.[`${row}:${column}`]
            if (link && (event.ctrlKey || event.metaKey)) {
              window.open(link, '_blank', 'noopener')
              return
            }
            if (event.button !== 0) return
            const painted = paintRef.current
            if (painted) {
              guard(() => changeGrouped((item) => applyCellStyle(item, row, column, row, column, painted.style), {
                action: 'CELL_UPDATED',
                range: addressLabel(row, column),
                oldValue: null,
                newValue: 'Format painted',
              }))
              if (!painted.repeat) paintRef.current = null
            }
            drag.current = true
            setEditing(null)
            setSelection((current) =>
              event.shiftKey
                ? { ...current, focusRow: row, focusCol: column }
                : { anchorRow: row, anchorCol: column, focusRow: row, focusCol: column },
            )
            gridRef.current?.focus()
          }}
          onMouseEnter={() => {
            if (drag.current) setSelection((current) => ({ ...current, focusRow: row, focusCol: column }))
          }}
          onDoubleClick={() => {
            if (denial(row, column)) {
              openRecord(row, column)
              return
            }
            guard(() => setEditing({ row, column, draft: raw(row, column) }))
          }}
          onContextMenu={(event) => openMenu(event, { row, column, target: 'cell' })}
        >
          {!showValue ? null : editingHere ? (
            <input
              className="eq-editor"
              autoFocus
              aria-label={`Edit ${addressLabel(row, column)}`}
              value={editing.draft}
              onChange={(event) => setEditing({ row, column, draft: event.target.value })}
              onBlur={() => commitEdit()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitEdit({ row: Math.min(EXCEL_ROWS - 1, row + (event.shiftKey ? -1 : 1)), column })
                } else if (event.key === 'Tab') {
                  event.preventDefault()
                  commitEdit({ row, column: Math.min(EXCEL_COLS - 1, column + (event.shiftKey ? -1 : 1)) })
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  setEditing(null)
                  gridRef.current?.focus()
                }
              }}
            />
          ) : sheet.checkboxes?.[`${row}:${column}`] ? (
            <input
              type="checkbox"
              aria-label={addressLabel(row, column)}
              checked={cellRaw === 'TRUE'}
              onMouseDown={(event) => event.stopPropagation()}
              onChange={() => {
                guard(() => changeGrouped((item) => {
                  const current = item.cells[cellKey(row, column)] === 'TRUE'
                  const next = setCellValue(item, row, column, current ? 'FALSE' : 'TRUE')
                  return { ...next, checkboxes: { ...(next.checkboxes ?? {}), [cellKey(row, column)]: true } }
                }, { action: 'CELL_UPDATED', range: addressLabel(row, column), oldValue: null, newValue: 'Checkbox' }))
              }}
            />
          ) : sheet.lists?.[`${row}:${column}`] ? (
            <select
              aria-label={addressLabel(row, column)}
              value={sheet.lists[`${row}:${column}`].includes(displayCell(sheet, row, column)) ? displayCell(sheet, row, column) : ''}
              onMouseDown={(event) => event.stopPropagation()}
              onChange={(event) => writeCell(row, column, event.target.value)}
            >
              <option value="">Choose</option>
              {sheet.lists[`${row}:${column}`].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : cellRaw.startsWith('data:image') ? (
            <img src={cellRaw} alt="" />
          ) : custom ? (
            <span onMouseDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
              {custom}
              {sheet.notes?.[`${row}:${column}`] ? <i className="eq-note" title={sheet.notes[`${row}:${column}`]} /> : null}
              {sheet.comments?.[`${row}:${column}`] ? <i className="eq-comment" title={sheet.comments[`${row}:${column}`]} /> : null}
            </span>
          ) : (
            <span>
              {shown}
              {sheet.filter && row === sheet.filter.headerRow && column === sheet.filter.column && sheet.filter.values ? (
                <select
                  aria-label={`Filter ${columnLabel(column)}`}
                  value={sheet.filter.values.length === 1 ? sheet.filter.values[0] : '*'}
                  onMouseDown={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    const values = event.target.value === '*' ? columnChoices(column) : [event.target.value]
                    guard(() => changeGrouped((item) => setSheetFilter(item, { column, headerRow: 0, values, fill: null, fontColor: null }), { action: 'CELL_UPDATED', range: columnLabel(column), oldValue: null, newValue: 'Filter' }))
                  }}
                >
                  <option value="*">All</option>
                  {columnChoices(column).map((option) => <option key={option || '(blank)'} value={option}>{option || '(blank)'}</option>)}
                </select>
              ) : null}
              {sheet.notes?.[`${row}:${column}`] ? <i className="eq-note" title={sheet.notes[`${row}:${column}`]} /> : null}
              {sheet.comments?.[`${row}:${column}`] ? <i className="eq-comment" title={sheet.comments[`${row}:${column}`]} /> : null}
            </span>
          )}
        </div>
      )
    }),
  )

  return (
    <div className={`eq-sheet${sheet.showGridlines === false ? ' is-plain' : ''}${sheet.showHeadings === false ? ' is-headless' : ''}`} onMouseUp={() => { drag.current = false }}>
      <SheetMenuBar
        readOnly={readOnly}
        openMenu={appMenu}
        savedViews={(sheet.filterViews ?? []).map((view) => view.name)}
        canMerge={mergeState.canMerge}
        canUnmerge={mergeState.canUnmerge}
        onOpen={setAppMenu}
        onCommand={runCommand}
      />
      <SheetRibbon
        readOnly={readOnly}
        zoom={zoom}
        active={sheet.styles?.[cellKey(selection.focusRow, selection.focusCol)]}
        canMerge={mergeState.canMerge}
        canMergeHorizontal={mergeState.canMergeHorizontal}
        canMergeVertical={mergeState.canMergeVertical}
        canUnmerge={mergeState.canUnmerge}
        onCommand={runCommand}
      />
      {printOpen ? (
        <form
          className="eq-find"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            const scope = String(data.get('scope') ?? 'sheet')
            const popup = window.open('', '_blank')
            if (!popup) {
              onError('Allow pop-ups to print.')
              return
            }
            const box = bounds(selection)
            const sheets = scope === 'workbook' ? workbook.sheets : [sheet]
            const tables = sheets.map((item) => {
              const r1 = scope === 'selection' ? box.r1 : 0
              const c1 = scope === 'selection' ? box.c1 : 0
              let r2 = scope === 'selection' ? box.r2 : 0
              let c2 = scope === 'selection' ? box.c2 : 0
              if (scope !== 'selection') {
                for (const cell of Object.keys(item.cells)) {
                  const [row, column] = cell.split(':').map(Number)
                  r2 = Math.max(r2, row)
                  c2 = Math.max(c2, column)
                }
              }
              const repeat = data.get('repeat') === 'on'
              const lines: string[] = []
              for (let row = r1; row <= r2; row += 1) {
                const fields: string[] = []
                for (let column = c1; column <= c2; column += 1) fields.push(`<td>${displayCell(item, row, column).replace(/</g, '&lt;')}</td>`)
                lines.push(`<tr>${fields.join('')}</tr>`)
              }
              const head = repeat && lines.length ? lines[0] : ''
              const body = repeat ? lines.slice(1).join('') : lines.join('')
              return `<h2>${item.name}</h2><table><thead>${head}</thead><tbody>${body}</tbody></table>`
            }).join('')
            popup.document.write(`<!doctype html><title>Print</title><style>@page{size:${data.get('paper')} ${data.get('orientation')};margin:${data.get('margin')}}body{font:12px Arial}table{border-collapse:collapse;width:100%}td{border:1px solid #ccc;padding:4px}</style>${tables}`)
            popup.document.close()
            popup.focus()
            popup.print()
            setPrintOpen(false)
          }}
        >
          <label>Scope <select name="scope"><option value="selection">Selected cells</option><option value="sheet">This sheet</option><option value="workbook">Workbook</option></select></label>
          <label>Paper <select name="paper"><option>A4</option><option>Letter</option></select></label>
          <label>Orientation <select name="orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
          <label>Margin <select name="margin"><option value="12mm">Normal</option><option value="6mm">Narrow</option><option value="20mm">Wide</option></select></label>
          <label><input type="checkbox" name="repeat" /> Repeat first row</label>
          <button type="submit">Print</button>
          <button type="button" onClick={() => setPrintOpen(false)}>Close</button>
        </form>
      ) : null}
      <input
        ref={csvRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        aria-label="Import CSV"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          void file.text().then((text) => {
            guard(() => changeGrouped((item) => importCsvText(item, text), {
              action: 'CELL_UPDATED',
              range: 'A1',
              oldValue: null,
              newValue: 'Imported CSV',
            }))
          })
        }}
      />
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        hidden
        aria-label="Insert image"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          if (file.size > 150000) {
            onError('Choose an image smaller than 150 KB.')
            return
          }
          const reader = new FileReader()
          reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : ''
            if (result.startsWith('data:image')) writeCell(selection.focusRow, selection.focusCol, result)
          }
          reader.readAsDataURL(file)
        }}
      />
      {sheet.showFormulaBar === false ? null : (
        <div className="eq-formula">
          <input
            key={`${selection.focusRow}:${selection.focusCol}`}
            className="eq-namebox"
            aria-label="Name Box"
            defaultValue={addressLabel(selection.focusRow, selection.focusCol)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              const parsed = parseA1(sheet.namedRanges?.[event.currentTarget.value.trim()] ?? event.currentTarget.value)
              if (!parsed) {
                onError('Enter a cell such as A1 or a range such as A1:C10.')
                return
              }
              setSelection({ anchorRow: parsed.row, anchorCol: parsed.column, focusRow: parsed.row2, focusCol: parsed.column2 })
              gridRef.current?.focus()
            }}
          />
          <input
            className="eq-formula-input"
            aria-label="Formula bar"
            value={formulaDraft ?? raw(selection.focusRow, selection.focusCol)}
            onChange={(event) => setFormulaDraft(event.target.value)}
            onBlur={() => {
              if (formulaDraft == null) return
              const next = formulaDraft
              setFormulaDraft(null)
              guard(() => writeCell(selection.focusRow, selection.focusCol, next))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                const next = formulaDraft ?? raw(selection.focusRow, selection.focusCol)
                setFormulaDraft(null)
                guard(() => writeCell(selection.focusRow, selection.focusCol, next))
                gridRef.current?.focus()
              }
              if (event.key === 'Escape') setFormulaDraft(null)
            }}
          />
          {(formulaDraft ?? '').startsWith('=') ? (
            <div className="eq-formula-hints">
              {['SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'MIN', 'MAX', 'ABS', 'ROUND', 'STDEV.S', 'VAR.S']
                .filter((name) => name.startsWith((formulaDraft ?? '=').slice(1).toUpperCase().replace(/\(.*$/, '')))
                .map((name) => (
                  <button key={name} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setFormulaDraft(`=${name}(`)}>
                    {name}
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      )}
      {find ? (
        <form
          className="eq-find"
          onSubmit={(event) => {
            event.preventDefault()
            const hit = findNextCell(sheet, find.query, selection.focusRow, selection.focusCol, find.matchCase)
            if (!hit) {
              onError(`No cells contain “${find.query}”.`)
              return
            }
            setSelection({ anchorRow: hit.row, anchorCol: hit.column, focusRow: hit.row, focusCol: hit.column })
          }}
        >
          <input aria-label="Find" value={find.query} onChange={(event) => setFind({ ...find, query: event.target.value })} autoFocus />
          <label><input type="checkbox" checked={find.matchCase} onChange={(event) => setFind({ ...find, matchCase: event.target.checked })} /> Match case</label>
          <button type="submit">Find next</button>
          <button type="button" onClick={() => setFind(null)}>Close</button>
        </form>
      ) : null}
      {slicerOn ? (
        <div className="eq-find">
          <span>Slicer {columnLabel(selection.focusCol)}</span>
          <select
            aria-label="Slicer"
            value={sheet.filter?.column === selection.focusCol && sheet.filter.values?.length === 1 ? sheet.filter.values[0] : '*'}
            onChange={(event) => {
              const column = selection.focusCol
              const values = event.target.value === '*' ? columnChoices(column) : [event.target.value]
              guard(() => changeGrouped((item) => setSheetFilter(item, { column, headerRow: 0, values, fill: null, fontColor: null }), { action: 'CELL_UPDATED', range: columnLabel(column), oldValue: null, newValue: 'Slicer' }))
            }}
          >
            <option value="*">All</option>
            {columnChoices(selection.focusCol).map((option) => (
              <option key={option || '(blank)'} value={option}>{option || '(blank)'}</option>
            ))}
          </select>
          <button type="button" onClick={() => setSlicerOn(false)}>Close</button>
        </div>
      ) : null}
      {emojiOn ? (
        <div className="eq-find">
          {['😀', '✅', '⚠️', '❌', '📌', '🧪'].map((symbol) => (
            <button key={symbol} type="button" onClick={() => runCommand(`emoji:${symbol}`)}>{symbol}</button>
          ))}
          <button type="button" onClick={() => setEmojiOn(false)}>Close</button>
        </div>
      ) : null}
      {statsText ? <div className="eq-pop"><p>{statsText}</p><button type="button" onClick={() => setStatsText(null)}>Close</button></div> : null}
      {chartRows ? (
        <div className="eq-pop" role="dialog" aria-label="Chart">
          <input aria-label="Chart title" defaultValue="Chart" id="eq-chart-title" />
          <select aria-label="Chart type" value={chartType} onChange={(event) => setChartType(event.target.value)}>
            {['bar', 'column', 'line', 'scatter', 'histogram'].map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          {chartRows.map((row) => (
            <div key={`${row.label}-${row.value}`} className={`eq-bar-row${chartType === 'column' ? ' is-column' : ''}`}>
              <span>{row.label}</span>
              <i style={{ width: chartType === 'line' ? 8 : `${Math.max(4, (row.value / Math.max(...chartRows.map((item) => item.value), 1)) * 160)}px`, height: chartType === 'column' ? `${Math.max(4, row.value)}px` : undefined }} />
              <span>{row.value}</span>
            </div>
          ))}
          <button type="button" onClick={() => {
            const csv = ['Label,Value', ...chartRows.map((row) => `${row.label},${row.value}`)].join('\n')
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = 'chart.csv'
            link.click()
            URL.revokeObjectURL(url)
          }}>Export data</button>
          <button type="button" onClick={() => setChartRows(null)}>Delete chart</button>
        </div>
      ) : null}
      {pivotRows ? (
        <div className="eq-pop" role="dialog" aria-label="Pivot table">
          <table>
            <thead><tr><th>Value</th><th>Count</th></tr></thead>
            <tbody>
              {pivotRows.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.count}</td></tr>)}
            </tbody>
          </table>
          <button type="button" onClick={() => setPivotRows(null)}>Close</button>
        </div>
      ) : null}
      <div className="eq-head">
        <button
          type="button"
          className="eq-corner"
          aria-label="Select all cells"
          onClick={() => setSelection({ anchorRow: 0, anchorCol: 0, focusRow: sheet.rowCount - 1, focusCol: sheet.columnCount - 1 })}
        />
        <div className="eq-col-headers" ref={colHeaderRef}>
          <div className="eq-axis">
            {colIndexes.map((column) => (
              <button
                type="button"
                key={column}
                className="eq-col-header"
                style={{ left: placeX(column, column < (sheet.freezeCols || 0)), width: colSize(column), zIndex: column < (sheet.freezeCols || 0) ? 2 : undefined }}
                onMouseDown={(event) => setSelection({
                  anchorRow: 0,
                  anchorCol: event.shiftKey ? selection.anchorCol : column,
                  focusRow: sheet.rowCount - 1,
                  focusCol: column,
                })}
                onContextMenu={(event) => openMenu(event, { row: 0, column, target: 'column' })}
              >
                {columnLabel(column)}
                <span
                  className="eq-resize"
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => startResize(event, 'col', column)}
                  onDoubleClick={(event) => {
                    event.stopPropagation()
                    let width = 48
                    const limit = Math.min(sheet.rowCount, Math.max(sheet.rowHeights.length, usedLastRow() + 1))
                    for (let row = 0; row < limit; row += 1) width = Math.max(width, Math.min(420, displayCell(sheet, row, column).length * 8 + 16))
                    guard(() => changeGrouped((item) => {
                      const written = writeAxisSize(item.columnWidths, item.colSizes, column, width, DEFAULT_COL_WIDTH)
                      return { ...item, columnWidths: written.dense, colSizes: written.extra }
                    }, { action: 'CELL_UPDATED', range: columnLabel(column), oldValue: null, newValue: 'Autofit' }))
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="eq-body" style={{ zoom: zoom / 100 }}>
        <div className="eq-row-headers" ref={rowHeaderRef}>
          <div className="eq-axis">
            {rowIndexes.map((row) => (
              <button
                type="button"
                key={row}
                className="eq-row-header"
                style={{ top: placeY(row, row < (sheet.freezeRows || 0)), height: rowSize(row), zIndex: row < (sheet.freezeRows || 0) ? 2 : undefined }}
                onMouseDown={(event) => setSelection({
                  anchorRow: event.shiftKey ? selection.anchorRow : row,
                  anchorCol: 0,
                  focusRow: row,
                  focusCol: sheet.columnCount - 1,
                })}
                onContextMenu={(event) => openMenu(event, { row, column: 0, target: 'row' })}
              >
                {row + 1}
                <span className="eq-resize row" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => startResize(event, 'row', row)} />
              </button>
            ))}
          </div>
        </div>
        <div
          ref={gridRef}
          className="eq-grid"
          tabIndex={0}
          role="grid"
          aria-label="Equipment Profile worksheet"
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            if (editing) return
            const text = event.clipboardData.getData('text/plain')
            if (!text) return
            event.preventDefault()
            pasteAt(text)
          }}
          onCopy={(event) => {
            if (editing) return
            event.preventDefault()
            event.clipboardData.setData('text/plain', selectionText())
          }}
          onCut={(event) => {
            if (editing) return
            event.preventDefault()
            event.clipboardData.setData('text/plain', selectionText())
            clearSelection()
          }}
        >
          <div className="eq-canvas">
            {cells}
          </div>
          {vThumb ? (
            <div className="eq-vbar" onPointerDown={(event) => pageTrack('y', event)}>
              <div className="eq-thumb" style={{ height: vThumb.size, transform: `translateY(${vThumb.pos}px)` }} onPointerDown={(event) => dragThumb('y', event)} />
            </div>
          ) : null}
          {hThumb ? (
            <div className="eq-hbar" onPointerDown={(event) => pageTrack('x', event)}>
              <div className="eq-thumb" style={{ width: hThumb.size, transform: `translateX(${hThumb.pos}px)` }} onPointerDown={(event) => dragThumb('x', event)} />
            </div>
          ) : null}
        </div>
      </div>
      <div className="eq-footer">
        <button type="button" className="eq-tab-nav" aria-label="Previous worksheet" onClick={() => tabsRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}>‹</button>
        <button type="button" className="eq-tab-nav" aria-label="Next worksheet" onClick={() => tabsRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}>›</button>
        <div className="eq-tabs" ref={tabsRef} role="tablist" aria-label="Worksheets">
          {visibleSheets(workbook).map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={selectedIds.includes(item.id)}
              key={item.id}
              className={`eq-tab${item.id === sheet.id ? ' is-active' : ''}${selectedIds.includes(item.id) ? ' is-selected' : ''}`}
              style={item.tabColor ? { boxShadow: `inset 0 -3px 0 ${item.tabColor}` } : undefined}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey) {
                  setSelectedIds((current) => {
                    const has = current.includes(item.id)
                    const next = has ? current.filter((id) => id !== item.id) : [...current, item.id]
                    return next.length ? next : [item.id]
                  })
                } else {
                  setSelectedIds([item.id])
                }
                onChange({ ...workbook, activeSheetId: item.id }, null)
              }}
              onDoubleClick={() => {
                if (readOnly) return
                setSelectedIds([item.id])
                setRenaming({ id: item.id, name: item.name })
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                openSheetMenu(item.id, event.clientX, event.clientY)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                openSheetMenu(item.id, rect.left, rect.bottom)
              }}
            >
              {renaming?.id === item.id ? (
                <input
                  className="eq-tab-rename"
                  autoFocus
                  aria-label="Rename worksheet"
                  value={renaming.name}
                  onChange={(event) => setRenaming({ id: item.id, name: event.target.value })}
                  onBlur={finishRename}
                  onKeyDown={(event) => {
                    event.stopPropagation()
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      finishRename()
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      setRenaming(null)
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
              ) : item.name}
            </button>
          ))}
        </div>
        <button type="button" className="eq-tab-add" aria-label="Add worksheet" onClick={() => runWorkbook(() => addSheet(workbook), { action: 'SHEET_CREATED', range: null, oldValue: null, newValue: 'New sheet' })}>+</button>
        {selectedIds.length > 1 ? <span className="eq-group-note">{selectedIds.length} sheets grouped. Click a sheet to ungroup.</span> : null}
        {notice ? <span className="eq-group-note">{notice}</span> : null}
        <span className="eq-status">{selectionSummary(sheet, selection)}</span>
        <span className="eq-save-state">{saveState}</span>
      </div>
      {menu?.target === 'cell' ? (
        <CellContextMenu x={menu.x} y={menu.y} readOnly={readOnly} onCommand={runCommand} />
      ) : null}
      {menu && menu.target !== 'cell' ? (
        <div className="eq-menu" style={{ left: menu.x, top: menu.y }} role="menu" onMouseDown={(event) => event.stopPropagation()}>
          {menu.target === 'row' ? (
            <>
              <button type="button" onClick={() => guard(() => { changeGrouped((item) => insertRow(item, menu.row), { action: 'ROW_INSERTED', range: `Row ${menu.row + 1}`, oldValue: null, newValue: 'Inserted above' }); setMenu(null) })}>Insert row above</button>
              <button type="button" onClick={() => guard(() => { changeGrouped((item) => insertRow(item, menu.row + 1), { action: 'ROW_INSERTED', range: `Row ${menu.row + 2}`, oldValue: null, newValue: 'Inserted below' }); setMenu(null) })}>Insert row below</button>
              <button type="button" onClick={() => guard(() => { changeGrouped((item) => deleteRow(item, menu.row), { action: 'ROW_DELETED', range: `Row ${menu.row + 1}`, oldValue: null, newValue: 'Deleted' }); setMenu(null) })}>Delete row</button>
            </>
          ) : null}
          {menu.target === 'column' ? (
            <>
              <button type="button" onClick={() => guard(() => { changeGrouped((item) => insertColumn(item, menu.column), { action: 'COLUMN_INSERTED', range: columnLabel(menu.column), oldValue: null, newValue: 'Inserted left' }); setMenu(null) })}>Insert column left</button>
              <button type="button" onClick={() => guard(() => { changeGrouped((item) => insertColumn(item, menu.column + 1), { action: 'COLUMN_INSERTED', range: columnLabel(menu.column + 1), oldValue: null, newValue: 'Inserted right' }); setMenu(null) })}>Insert column right</button>
              <button type="button" onClick={() => guard(() => { changeGrouped((item) => deleteColumn(item, menu.column), { action: 'COLUMN_DELETED', range: columnLabel(menu.column), oldValue: null, newValue: 'Deleted' }); setMenu(null) })}>Delete column</button>
            </>
          ) : null}
        </div>
      ) : null}
      {sheetMenu ? (
        <SheetTabMenu
          workbook={workbook}
          sheetId={sheetMenu.sheetId}
          x={sheetMenu.x}
          y={sheetMenu.y}
          readOnly={readOnly}
          onClose={() => setSheetMenu(null)}
          onApply={applySheet}
          onRename={(sheetId) => {
            const target = workbook.sheets.find((item) => item.id === sheetId)
            setSheetMenu(null)
            if (target) setRenaming({ id: target.id, name: target.name })
          }}
          onSelectAll={() => {
            setSelectedIds(visibleSheets(workbook).map((item) => item.id))
            setSheetMenu(null)
          }}
          onOpen={(kind, sheetId) => {
            setSheetMenu(null)
            setSheetDialog({ kind, sheetId })
          }}
          onNotice={(message) => {
            setNotice(message)
            window.setTimeout(() => setNotice(null), 2000)
          }}
          onError={onError}
        />
      ) : null}
      <SheetTabDialogs
        workbook={workbook}
        dialog={sheetDialog}
        onClose={() => setSheetDialog(null)}
        onApply={applySheet}
      />
    </div>
  )
}
