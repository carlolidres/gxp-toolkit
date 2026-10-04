import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'

import {
  activeSheet,
  addSheet,
  addressLabel,
  clearRange,
  columnLabel,
  deleteColumn,
  deleteRow,
  deleteSheet,
  displayCell,
  duplicateSheet,
  insertColumn,
  insertRow,
  pasteText,
  renameSheet,
  replaceSheet,
  setCellValue,
  type EquipmentAuditAction,
  type EquipmentSheet,
  type EquipmentWorkbook,
} from '../../features/vmp/equipmentWorkbook'

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

function offsets(sizes: number[]) {
  const next = [0]
  for (const size of sizes) next.push(next[next.length - 1] + size)
  return next
}

function visibleSpan(starts: number[], scroll: number, size: number) {
  let start = 0
  while (start < starts.length - 2 && starts[start + 1] <= scroll) start += 1
  let end = start
  while (end < starts.length - 2 && starts[end] < scroll + size) end += 1
  return { start: Math.max(0, start - 1), end: Math.min(starts.length - 2, end + 2) }
}

export function EquipmentSpreadsheet({
  workbook,
  readOnly,
  saveState,
  onChange,
  onError,
}: {
  workbook: EquipmentWorkbook
  readOnly: boolean
  saveState: string
  onChange: (workbook: EquipmentWorkbook, audit: Audit | null) => void
  onError: (message: string) => void
}) {
  const sheet = activeSheet(workbook)
  const gridRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const undoRef = useRef<EquipmentWorkbook[]>([])
  const redoRef = useRef<EquipmentWorkbook[]>([])
  const drag = useRef(false)
  const [selection, setSelection] = useState<Selection>({ anchorRow: 0, anchorCol: 0, focusRow: 0, focusCol: 0 })
  const [editing, setEditing] = useState<{ row: number; column: number; draft: string } | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [scroll, setScroll] = useState({ left: 0, top: 0, width: 900, height: 520 })

  const colStarts = useMemo(() => offsets(sheet.columnWidths), [sheet.columnWidths])
  const rowStarts = useMemo(() => offsets(sheet.rowHeights), [sheet.rowHeights])
  const cols = visibleSpan(colStarts, scroll.left, scroll.width)
  const rows = visibleSpan(rowStarts, scroll.top, scroll.height)

  useEffect(() => {
    const node = gridRef.current
    if (!node) return
    const update = () => setScroll((current) => ({ ...current, width: node.clientWidth, height: node.clientHeight }))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setSelection({ anchorRow: 0, anchorCol: 0, focusRow: 0, focusCol: 0 })
    setEditing(null)
  }, [sheet.id])

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

  function changeSheet(next: EquipmentSheet, audit: Audit) {
    apply(replaceSheet(workbook, next), audit)
  }

  function writeCell(row: number, column: number, value: string) {
    const previous = raw(row, column)
    if (previous === value) return
    changeSheet(setCellValue(sheet, row, column, value), {
      action: 'CELL_UPDATED',
      range: addressLabel(row, column),
      oldValue: previous || null,
      newValue: value || null,
    })
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
      const row = Math.max(0, Math.min(sheet.rowCount - 1, current.focusRow + rowDelta))
      const column = Math.max(0, Math.min(sheet.columnCount - 1, current.focusCol + colDelta))
      return extend
        ? { ...current, focusRow: row, focusCol: column }
        : { anchorRow: row, anchorCol: column, focusRow: row, focusCol: column }
    })
  }

  async function copySelection(cut = false) {
    const text = selectionText()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      onError('Clipboard access was blocked by the browser.')
      return
    }
    if (!cut) return
    guard(() => {
      const box = bounds(selection)
      changeSheet(clearRange(sheet, box.r1, box.c1, box.r2, box.c2), {
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
      changeSheet(pasteText(sheet, box.r1, box.c1, text), {
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
      changeSheet(clearRange(sheet, box.r1, box.c1, box.r2, box.c2), {
        action: 'CELL_UPDATED',
        range: `${addressLabel(box.r1, box.c1)}:${addressLabel(box.r2, box.c2)}`,
        oldValue: selectionText(),
        newValue: null,
      })
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
    if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault()
      clearSelection()
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
      guard(() => setEditing({ row: selection.focusRow, column: selection.focusCol, draft: raw(selection.focusRow, selection.focusCol) }))
      return
    }
    if (key.length === 1 && !meta && !event.altKey) {
      event.preventDefault()
      guard(() => setEditing({ row: selection.focusRow, column: selection.focusCol, draft: key }))
    }
  }

  function startResize(event: ReactPointerEvent, axis: 'col' | 'row', index: number) {
    event.preventDefault()
    event.stopPropagation()
    const start = axis === 'col' ? event.clientX : event.clientY
    const initial = axis === 'col' ? sheet.columnWidths[index] : sheet.rowHeights[index]
    const base = sheet
    function movePointer(pointer: PointerEvent) {
      const delta = (axis === 'col' ? pointer.clientX : pointer.clientY) - start
      const size = Math.max(32, initial + delta)
      const next = axis === 'col'
        ? { ...base, columnWidths: base.columnWidths.map((width, item) => (item === index ? size : width)) }
        : { ...base, rowHeights: base.rowHeights.map((height, item) => (item === index ? size : height)) }
      onChange(replaceSheet(workbook, next), null)
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
    setRenaming(null)
    if (current.name.trim() === sheet.name && current.id === sheet.id) return
    guard(() => apply(renameSheet(workbook, current.id, current.name), { action: 'SHEET_RENAMED', range: current.name.trim(), oldValue: null, newValue: current.name.trim() }))
  }

  const cells = Array.from({ length: rows.end - rows.start + 1 }, (_, rowOffset) => rows.start + rowOffset).flatMap((row) =>
    Array.from({ length: cols.end - cols.start + 1 }, (_, columnOffset) => cols.start + columnOffset).map((column) => {
      const active = selection.focusRow === row && selection.focusCol === column
      const editingHere = editing?.row === row && editing.column === column
      return (
        <div
          key={`${row}:${column}`}
          role="gridcell"
          className={`eq-cell${covers(selection, row, column) ? ' is-selected' : ''}${active ? ' is-active' : ''}`}
          style={{ left: colStarts[column], top: rowStarts[row], width: sheet.columnWidths[column], height: sheet.rowHeights[row] }}
          onMouseDown={(event) => {
            if (event.button !== 0) return
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
          onDoubleClick={() => guard(() => setEditing({ row, column, draft: raw(row, column) }))}
          onContextMenu={(event) => openMenu(event, { row, column, target: 'cell' })}
        >
          {editingHere ? (
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
                  commitEdit({ row: Math.min(sheet.rowCount - 1, row + (event.shiftKey ? -1 : 1)), column })
                } else if (event.key === 'Tab') {
                  event.preventDefault()
                  commitEdit({ row, column: Math.min(sheet.columnCount - 1, column + (event.shiftKey ? -1 : 1)) })
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  setEditing(null)
                  gridRef.current?.focus()
                }
              }}
            />
          ) : (
            <span>{displayCell(sheet, row, column)}</span>
          )}
        </div>
      )
    }),
  )

  return (
    <div className="eq-sheet" onMouseUp={() => { drag.current = false }}>
      <div className="eq-head">
        <button
          type="button"
          className="eq-corner"
          aria-label="Select all cells"
          onClick={() => setSelection({ anchorRow: 0, anchorCol: 0, focusRow: sheet.rowCount - 1, focusCol: sheet.columnCount - 1 })}
        />
        <div className="eq-col-headers">
          <div style={{ width: colStarts[sheet.columnCount], height: 28, position: 'relative', transform: `translateX(${-scroll.left}px)` }}>
            {Array.from({ length: cols.end - cols.start + 1 }, (_, offset) => cols.start + offset).map((column) => (
              <button
                type="button"
                key={column}
                className="eq-col-header"
                style={{ left: colStarts[column], width: sheet.columnWidths[column] }}
                onMouseDown={(event) => setSelection({
                  anchorRow: 0,
                  anchorCol: event.shiftKey ? selection.anchorCol : column,
                  focusRow: sheet.rowCount - 1,
                  focusCol: column,
                })}
                onContextMenu={(event) => openMenu(event, { row: 0, column, target: 'column' })}
              >
                {columnLabel(column)}
                <span className="eq-resize" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => startResize(event, 'col', column)} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="eq-body">
        <div className="eq-row-headers">
          <div style={{ height: rowStarts[sheet.rowCount], position: 'relative', transform: `translateY(${-scroll.top}px)` }}>
            {Array.from({ length: rows.end - rows.start + 1 }, (_, offset) => rows.start + offset).map((row) => (
              <button
                type="button"
                key={row}
                className="eq-row-header"
                style={{ top: rowStarts[row], height: sheet.rowHeights[row] }}
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
          onScroll={(event) => {
            const target = event.currentTarget
            setScroll({ left: target.scrollLeft, top: target.scrollTop, width: target.clientWidth, height: target.clientHeight })
          }}
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
          <div className="eq-canvas" style={{ width: colStarts[sheet.columnCount], height: rowStarts[sheet.rowCount] }}>
            {cells}
          </div>
        </div>
      </div>
      <div className="eq-footer">
        <button type="button" className="eq-tab-nav" aria-label="Previous worksheet" onClick={() => tabsRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}>‹</button>
        <button type="button" className="eq-tab-nav" aria-label="Next worksheet" onClick={() => tabsRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}>›</button>
        <div className="eq-tabs" ref={tabsRef}>
          {workbook.sheets.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`eq-tab${item.id === sheet.id ? ' is-active' : ''}`}
              onClick={() => onChange({ ...workbook, activeSheetId: item.id }, null)}
              onDoubleClick={() => setRenaming({ id: item.id, name: item.name })}
              onContextMenu={(event) => openMenu(event, { row: 0, column: 0, target: 'sheet', sheetId: item.id })}
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
                    if (event.key === 'Enter') finishRename()
                    if (event.key === 'Escape') setRenaming(null)
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
              ) : item.name}
            </button>
          ))}
        </div>
        <button type="button" className="eq-tab-add" aria-label="Add worksheet" onClick={() => runWorkbook(() => addSheet(workbook), { action: 'SHEET_CREATED', range: null, oldValue: null, newValue: 'New sheet' })}>+</button>
        <span className="eq-save-state">{saveState}</span>
      </div>
      {menu ? (
        <div className="eq-menu" style={{ left: menu.x, top: menu.y }} role="menu" onMouseDown={(event) => event.stopPropagation()}>
          {menu.target === 'cell' ? (
            <>
              <button type="button" onClick={() => { void copySelection(false); setMenu(null) }}>Copy</button>
              <button type="button" onClick={() => { void copySelection(true); setMenu(null) }}>Cut</button>
              <button type="button" onClick={() => { void navigator.clipboard.readText().then((text) => { pasteAt(text); setMenu(null) }).catch(() => onError('Clipboard access was blocked by the browser.')) }}>Paste</button>
              <button type="button" onClick={() => { clearSelection(); setMenu(null) }}>Clear contents</button>
            </>
          ) : null}
          {menu.target === 'row' ? (
            <>
              <button type="button" onClick={() => guard(() => { changeSheet(insertRow(sheet, menu.row), { action: 'ROW_INSERTED', range: `Row ${menu.row + 1}`, oldValue: null, newValue: 'Inserted above' }); setMenu(null) })}>Insert row above</button>
              <button type="button" onClick={() => guard(() => { changeSheet(insertRow(sheet, menu.row + 1), { action: 'ROW_INSERTED', range: `Row ${menu.row + 2}`, oldValue: null, newValue: 'Inserted below' }); setMenu(null) })}>Insert row below</button>
              <button type="button" onClick={() => guard(() => { changeSheet(deleteRow(sheet, menu.row), { action: 'ROW_DELETED', range: `Row ${menu.row + 1}`, oldValue: null, newValue: 'Deleted' }); setMenu(null) })}>Delete row</button>
            </>
          ) : null}
          {menu.target === 'column' ? (
            <>
              <button type="button" onClick={() => guard(() => { changeSheet(insertColumn(sheet, menu.column), { action: 'COLUMN_INSERTED', range: columnLabel(menu.column), oldValue: null, newValue: 'Inserted left' }); setMenu(null) })}>Insert column left</button>
              <button type="button" onClick={() => guard(() => { changeSheet(insertColumn(sheet, menu.column + 1), { action: 'COLUMN_INSERTED', range: columnLabel(menu.column + 1), oldValue: null, newValue: 'Inserted right' }); setMenu(null) })}>Insert column right</button>
              <button type="button" onClick={() => guard(() => { changeSheet(deleteColumn(sheet, menu.column), { action: 'COLUMN_DELETED', range: columnLabel(menu.column), oldValue: null, newValue: 'Deleted' }); setMenu(null) })}>Delete column</button>
            </>
          ) : null}
          {menu.target === 'sheet' && menu.sheetId ? (
            <>
              <button type="button" onClick={() => { const target = workbook.sheets.find((item) => item.id === menu.sheetId); setRenaming(target ? { id: target.id, name: target.name } : null); setMenu(null) }}>Rename</button>
              <button type="button" onClick={() => runWorkbook(() => duplicateSheet(workbook, menu.sheetId!), { action: 'SHEET_DUPLICATED', range: null, oldValue: null, newValue: 'Duplicated' })}>Duplicate sheet</button>
              <button type="button" onClick={() => runWorkbook(() => deleteSheet(workbook, menu.sheetId!), { action: 'SHEET_DELETED', range: null, oldValue: null, newValue: 'Deleted' })}>Delete sheet</button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
