import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Modal } from 'antd'
import { ChevronRight, Code2, Link2, Lock, Pencil, Trash2 } from 'lucide-react'

import {
  copySheet,
  deleteSheet,
  hideSheet,
  insertSheetBefore,
  moveSheet,
  nextSheetName,
  setSheetProtection,
  setSheetTabColor,
  SHEET_TAB_COLORS,
  unhideSheets,
  visibleSheets,
  type EquipmentWorkbook,
  type SheetProtection,
} from '../../features/vmp/equipmentWorkbook'

export type SheetMenuAudit = {
  action:
    | 'SHEET_CREATED'
    | 'SHEET_DELETED'
    | 'SHEET_DUPLICATED'
    | 'SHEET_MOVED'
    | 'SHEET_HIDDEN'
    | 'SHEET_UNHIDDEN'
    | 'SHEET_COLOR'
    | 'SHEET_PROTECTED'
  range: string | null
  oldValue: string | null
  newValue: string | null
}

export type SheetDialogKind = 'insert' | 'move' | 'protect' | 'unhide' | 'code'

type Item = {
  id: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  separatorBefore?: boolean
  submenu?: boolean
  onSelect?: () => void
}

export function worksheetLink(sheetId: string): string {
  const url = new URL(window.location.href)
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : ''
  const [path, query = ''] = hash.split('?')
  const params = new URLSearchParams(query)
  params.set('sheet', sheetId)
  url.hash = `${path}?${params.toString()}`
  return url.toString()
}

function place(x: number, y: number, width: number, height: number) {
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
    y: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
  }
}

export function SheetTabMenu({
  workbook,
  sheetId,
  x,
  y,
  readOnly,
  onClose,
  onApply,
  onRename,
  onSelectAll,
  onOpen,
  onNotice,
  onError,
}: {
  workbook: EquipmentWorkbook
  sheetId: string
  x: number
  y: number
  readOnly: boolean
  onClose: () => void
  onApply: (build: () => EquipmentWorkbook, audit: SheetMenuAudit) => void
  onRename: (sheetId: string) => void
  onSelectAll: () => void
  onOpen: (kind: SheetDialogKind, sheetId: string) => void
  onNotice: (message: string) => void
  onError: (message: string) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  const [focusIndex, setFocusIndex] = useState(0)
  const [colorsOpen, setColorsOpen] = useState(false)
  const [colorPos, setColorPos] = useState({ x: x + 220, y })
  const sheet = workbook.sheets.find((item) => item.id === sheetId)
  const visibleCount = visibleSheets(workbook).length
  const hiddenCount = workbook.sheets.filter((item) => item.hidden).length

  const items: Item[] = [
    { id: 'insert', label: 'Insert...', disabled: readOnly, onSelect: () => onOpen('insert', sheetId) },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 size={14} aria-hidden />,
      disabled: readOnly || visibleCount <= 1,
      onSelect: () => {
        if (!sheet || !window.confirm(`Delete worksheet '${sheet.name}'?`)) return
        onApply(() => deleteSheet(workbook, sheetId), { action: 'SHEET_DELETED', range: sheet.name, oldValue: sheet.name, newValue: null })
      },
    },
    { id: 'rename', label: 'Rename', icon: <Pencil size={14} aria-hidden />, disabled: readOnly, onSelect: () => onRename(sheetId) },
    { id: 'move', label: 'Move or Copy...', disabled: readOnly, onSelect: () => onOpen('move', sheetId) },
    { id: 'code', label: 'View Code', icon: <Code2 size={14} aria-hidden />, onSelect: () => onOpen('code', sheetId) },
    {
      id: 'protect',
      label: 'Protect Sheet...',
      icon: <Lock size={14} aria-hidden />,
      disabled: readOnly,
      separatorBefore: true,
      onSelect: () => onOpen('protect', sheetId),
    },
    { id: 'color', label: 'Tab Color', disabled: readOnly, submenu: true, separatorBefore: true },
    {
      id: 'hide',
      label: 'Hide',
      disabled: readOnly || visibleCount <= 1,
      onSelect: () =>
        onApply(() => hideSheet(workbook, sheetId), { action: 'SHEET_HIDDEN', range: sheet?.name ?? null, oldValue: null, newValue: 'Hidden' }),
    },
    { id: 'unhide', label: 'Unhide...', disabled: readOnly || hiddenCount === 0, onSelect: () => onOpen('unhide', sheetId) },
    { id: 'select-all', label: 'Select All Sheets', separatorBefore: true, onSelect: onSelectAll },
    {
      id: 'link',
      label: 'Link to this Sheet',
      icon: <Link2 size={14} aria-hidden />,
      separatorBefore: true,
      onSelect: () => {
        void navigator.clipboard.writeText(worksheetLink(sheetId)).then(
          () => onNotice('Link copied to the clipboard.'),
          () => onError('Clipboard access was blocked by the browser.'),
        )
      },
    },
  ]

  useLayoutEffect(() => {
    const node = menuRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    setPos(place(x, y, rect.width, rect.height))
  }, [x, y])

  useEffect(() => {
    menuRef.current?.focus()
  }, [])

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      const target = event.target
      if (target instanceof Node && menuRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('.eq-sheet-submenu')) return
      onClose()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function run(item: Item) {
    if (item.disabled) return
    if (item.submenu) {
      setColorsOpen((open) => !open)
      return
    }
    item.onSelect?.()
    onClose()
  }

  function onMenuKey(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusIndex((index) => (index + 1) % items.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusIndex((index) => (index - 1 + items.length) % items.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setFocusIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setFocusIndex(items.length - 1)
    } else if (event.key === 'ArrowRight' && items[focusIndex]?.submenu) {
      event.preventDefault()
      setColorsOpen(true)
    } else if (event.key === 'ArrowLeft') {
      setColorsOpen(false)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const item = items[focusIndex]
      if (item) run(item)
    }
  }

  function openColors(anchor: HTMLButtonElement) {
    const rect = anchor.getBoundingClientRect()
    const width = 196
    const left = rect.right + 2 + width > window.innerWidth ? rect.left - width - 2 : rect.right + 2
    setColorPos(place(left, rect.top, width, 88))
    setColorsOpen(true)
  }

  function paint(color: string | null) {
    onApply(() => setSheetTabColor(workbook, sheetId, color), {
      action: 'SHEET_COLOR',
      range: sheet?.name ?? null,
      oldValue: sheet?.tabColor ?? null,
      newValue: color,
    })
    onClose()
  }

  return createPortal(
    <>
      <div
        ref={menuRef}
        className="eq-sheet-menu"
        role="menu"
        tabIndex={-1}
        aria-label={`Worksheet options for ${sheet?.name ?? 'sheet'}`}
        style={{ left: pos.x, top: pos.y }}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onMenuKey}
      >
        {items.map((item, index) => (
          <div key={item.id}>
            {item.separatorBefore ? <div className="eq-sheet-menu-sep" role="separator" /> : null}
            <button
              type="button"
              role="menuitem"
              className={index === focusIndex ? 'is-active' : ''}
              aria-disabled={item.disabled || undefined}
              aria-haspopup={item.submenu ? 'menu' : undefined}
              aria-expanded={item.submenu ? colorsOpen : undefined}
              disabled={item.disabled}
              onMouseEnter={(event) => {
                setFocusIndex(index)
                if (item.submenu) openColors(event.currentTarget)
                else setColorsOpen(false)
              }}
              onClick={(event) => {
                if (item.submenu) {
                  openColors(event.currentTarget)
                  return
                }
                run(item)
              }}
            >
              <span className="eq-sheet-menu-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.submenu ? <ChevronRight className="eq-sheet-menu-arrow" size={14} aria-hidden /> : null}
            </button>
          </div>
        ))}
      </div>
      {colorsOpen ? (
        <div
          className="eq-sheet-submenu"
          role="menu"
          aria-label="Tab color"
          style={{ left: colorPos.x, top: colorPos.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="eq-sheet-colors">
            {SHEET_TAB_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="menuitem"
                className="eq-sheet-swatch"
                style={{ background: color }}
                aria-label={`Tab color ${color}`}
                onClick={() => paint(color)}
              />
            ))}
          </div>
          <button type="button" role="menuitem" className="eq-sheet-nocolor" onClick={() => paint(null)}>
            No Color
          </button>
        </div>
      ) : null}
    </>,
    document.body,
  )
}

export function SheetTabDialogs({
  workbook,
  dialog,
  onClose,
  onApply,
}: {
  workbook: EquipmentWorkbook
  dialog: { kind: SheetDialogKind; sheetId: string } | null
  onClose: () => void
  onApply: (build: () => EquipmentWorkbook, audit: SheetMenuAudit) => void
}) {
  const sheet = workbook.sheets.find((item) => item.id === dialog?.sheetId) ?? null
  const [name, setName] = useState('')
  const [beforeId, setBeforeId] = useState<string>('')
  const [makeCopy, setMakeCopy] = useState(false)
  const [protection, setProtection] = useState<SheetProtection>({
    locked: true,
    allowEditCells: false,
    allowFormat: false,
    allowInsert: false,
    allowDelete: false,
  })
  const [unhideIds, setUnhideIds] = useState<string[]>([])

  useEffect(() => {
    if (!dialog) return
    const current = workbook.sheets.find((item) => item.id === dialog.sheetId)
    if (!current) return
    setName(nextSheetName(workbook))
    setBeforeId(current.id)
    setMakeCopy(false)
    setProtection(
      current.protection ?? { locked: true, allowEditCells: false, allowFormat: false, allowInsert: false, allowDelete: false },
    )
    setUnhideIds(workbook.sheets.filter((item) => item.hidden).map((item) => item.id).slice(0, 1))
    // Reset the form only when a different dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog?.kind, dialog?.sheetId])

  if (!dialog || !sheet) return null

  return (
    <>
      <Modal
        title="Insert"
        open={dialog.kind === 'insert'}
        onCancel={onClose}
        okText="OK"
        onOk={() =>
          onApply(() => insertSheetBefore(workbook, sheet.id, name), {
            action: 'SHEET_CREATED',
            range: name.trim(),
            oldValue: null,
            newValue: name.trim(),
          })
        }
        destroyOnHidden
      >
        <label className="eq-sheet-field" htmlFor="eq-insert-sheet-name">
          Worksheet name
          <input id="eq-insert-sheet-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </label>
        <p className="eq-sheet-hint">The new worksheet is inserted before {sheet.name}.</p>
      </Modal>
      <Modal
        title="Move or Copy"
        open={dialog.kind === 'move'}
        onCancel={onClose}
        okText="OK"
        onOk={() => {
          const before = beforeId || null
          if (makeCopy) {
            onApply(() => copySheet(workbook, sheet.id, before), { action: 'SHEET_DUPLICATED', range: sheet.name, oldValue: null, newValue: 'Copy' })
            return
          }
          onApply(() => moveSheet(workbook, sheet.id, before), { action: 'SHEET_MOVED', range: sheet.name, oldValue: null, newValue: 'Moved' })
        }}
        destroyOnHidden
      >
        <label className="eq-sheet-field" htmlFor="eq-move-before">
          Before sheet
          <select id="eq-move-before" value={beforeId} onChange={(event) => setBeforeId(event.target.value)}>
            {workbook.sheets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.hidden ? `${item.name} (hidden)` : item.name}
              </option>
            ))}
            <option value="">(move to end)</option>
          </select>
        </label>
        <label className="eq-sheet-check">
          <input type="checkbox" checked={makeCopy} onChange={(event) => setMakeCopy(event.target.checked)} />
          Create a copy
        </label>
      </Modal>
      <Modal title="View Code" open={dialog.kind === 'code'} onCancel={onClose} footer={null} destroyOnHidden>
        <p className="eq-sheet-hint">
          View Code is not available for {sheet.name}. This workbook does not include a worksheet script editor.
        </p>
        <div className="eq-sheet-dialog-actions">
          <button type="button" className="eq-sheet-dialog-close" onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
      <Modal
        title="Protect Sheet"
        open={dialog.kind === 'protect'}
        onCancel={onClose}
        okText="OK"
        onOk={() =>
          onApply(() => setSheetProtection(workbook, sheet.id, protection.locked ? protection : null), {
            action: 'SHEET_PROTECTED',
            range: sheet.name,
            oldValue: sheet.protection?.locked ? 'Protected' : 'Unprotected',
            newValue: protection.locked ? 'Protected' : 'Unprotected',
          })
        }
        destroyOnHidden
      >
        <label className="eq-sheet-check">
          <input
            type="checkbox"
            checked={protection.locked}
            onChange={(event) => setProtection({ ...protection, locked: event.target.checked })}
          />
          Protect worksheet
        </label>
        <fieldset className="eq-sheet-protect" disabled={!protection.locked}>
          <legend>Allow</legend>
          {(
            [
              ['allowEditCells', 'Editing cells'],
              ['allowFormat', 'Formatting cells'],
              ['allowInsert', 'Inserting rows and columns'],
              ['allowDelete', 'Deleting rows and columns'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="eq-sheet-check">
              <input
                type="checkbox"
                checked={protection[key]}
                onChange={(event) => setProtection({ ...protection, [key]: event.target.checked })}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </Modal>
      <Modal
        title="Unhide"
        open={dialog.kind === 'unhide'}
        onCancel={onClose}
        okText="OK"
        okButtonProps={{ disabled: unhideIds.length === 0 }}
        onOk={() =>
          onApply(() => unhideSheets(workbook, unhideIds), { action: 'SHEET_UNHIDDEN', range: null, oldValue: null, newValue: 'Unhidden' })
        }
        destroyOnHidden
      >
        <div className="eq-sheet-unhide" role="group" aria-label="Hidden worksheets">
          {workbook.sheets.filter((item) => item.hidden).map((item) => (
            <label key={item.id} className="eq-sheet-check">
              <input
                type="checkbox"
                checked={unhideIds.includes(item.id)}
                onChange={(event) =>
                  setUnhideIds((current) =>
                    event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                  )
                }
              />
              {item.name}
            </label>
          ))}
        </div>
      </Modal>
    </>
  )
}
