import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Tooltip } from 'antd'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers,
  Redo2,
  RotateCw,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import { EdocPdfPageCanvas } from './EdocPdfPageCanvas'
import {
  createEdocFieldDraft,
  edocFieldTypeLabels,
  fieldTypesForAction,
} from '../../features/edoc/fieldRules'
import {
  clampFieldToPage,
  normalizeRotation,
  resolveSoftOverlap,
  signatoryColorForIndex,
} from '../../features/edoc/fieldPlacementGeometry'
import { usePdfDocument } from '../../features/edoc/usePdfDocument'
import type { EdocAssignableAction, EdocFieldDraft, EdocFieldType } from '../../features/edoc/types'
import { iconSize, iconStroke } from '../../theme/iconSizes'
import { VMP_INPUT_CLASS } from '../../pages/vmp/vmp-form-shared'

export interface EdocPlacementSignatory {
  id: string
  label: string
  action: EdocAssignableAction
  displayName: string
}

type DragMode = 'move' | 'resize' | 'rotate' | 'create'

interface DragState {
  mode: DragMode
  fieldId: string | null
  pointerId: number
  startClientX: number
  startClientY: number
  originX: number
  originY: number
  originWidth: number
  originHeight: number
  originRotation: number
  pageRect: DOMRect
  createAssigneeId: string | null
  createFieldType: EdocFieldType | null
}

const MIN_ZOOM = 0.7
const MAX_ZOOM = 2.2
const BASE_PAGE_WIDTH = 640

export function EdocFieldPlacementEditor({
  pdfBytes,
  fields,
  signatories,
  emptyMessage,
  onChange,
}: {
  pdfBytes: ArrayBuffer | null
  fields: EdocFieldDraft[]
  signatories: readonly EdocPlacementSignatory[]
  emptyMessage?: string
  onChange: (fields: EdocFieldDraft[]) => void
}) {
  const { document, pageCount, loading, error } = usePdfDocument(pdfBytes)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [renderedSize, setRenderedSize] = useState({ width: BASE_PAGE_WIDTH, height: BASE_PAGE_WIDTH * 1.294 })
  const [past, setPast] = useState<EdocFieldDraft[][]>([])
  const [future, setFuture] = useState<EdocFieldDraft[][]>([])
  const pageRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const fieldsRef = useRef(fields)
  const historySnapshotRef = useRef<EdocFieldDraft[] | null>(null)
  fieldsRef.current = fields

  const pageWidth = Math.round(BASE_PAGE_WIDTH * zoom)

  const colorByAssignee = useMemo(() => {
    const map = new Map<string, ReturnType<typeof signatoryColorForIndex>>()
    signatories.forEach((signatory, index) => {
      map.set(signatory.id, signatoryColorForIndex(index))
    })
    return map
  }, [signatories])

  const pageFields = useMemo(
    () => fields.filter((field) => field.pageNumber === pageNumber),
    [fields, pageNumber],
  )

  const selected = fields.find((field) => field.id === selectedId) ?? null

  useEffect(() => {
    if (pageCount > 0 && pageNumber > pageCount) setPageNumber(pageCount)
  }, [pageCount, pageNumber])

  const commitFields = useCallback((next: EdocFieldDraft[], recordHistory = true) => {
    if (recordHistory) {
      setPast((currentPast) => [...currentPast, fieldsRef.current].slice(-40))
      setFuture([])
    }
    onChange(next)
  }, [onChange])

  const updateField = useCallback((fieldId: string, patch: Partial<EdocFieldDraft>, recordHistory = true) => {
    const current = fieldsRef.current
    const next = current.map((field) => {
      if (field.id !== fieldId) return field
      const merged = { ...field, ...patch }
      return {
        ...merged,
        ...clampFieldToPage(merged),
        rotation: normalizeRotation(merged.rotation ?? 0),
        pageNumber: Math.max(1, Math.floor(merged.pageNumber || 1)),
      }
    })
    const updated = next.find((field) => field.id === fieldId)
    if (!updated) return
    const resolved = resolveSoftOverlap(updated, next)
    commitFields(next.map((field) => (field.id === fieldId ? resolved : field)), recordHistory)
  }, [commitFields])

  function undo() {
    setPast((currentPast) => {
      if (currentPast.length === 0) return currentPast
      const previous = currentPast[currentPast.length - 1]!
      setFuture((currentFuture) => [fieldsRef.current, ...currentFuture])
      onChange(previous)
      return currentPast.slice(0, -1)
    })
  }

  function redo() {
    setFuture((currentFuture) => {
      if (currentFuture.length === 0) return currentFuture
      const next = currentFuture[0]!
      setPast((currentPast) => [...currentPast, fieldsRef.current].slice(-40))
      onChange(next)
      return currentFuture.slice(1)
    })
  }

  function placeField(assigneeDraftId: string, fieldType: EdocFieldType, x: number, y: number) {
    const created = resolveSoftOverlap(
      createEdocFieldDraft({
        assigneeDraftId,
        fieldType,
        pageNumber,
        x,
        y,
      }),
      fieldsRef.current,
    )
    commitFields([...fieldsRef.current, created])
    setSelectedId(created.id)
  }

  function duplicateSelected() {
    if (!selected) return
    const copy = resolveSoftOverlap(
      {
        ...selected,
        id: crypto.randomUUID(),
        x: selected.x + 0.03,
        y: selected.y + 0.03,
      },
      fields,
    )
    commitFields([...fields, { ...copy, ...clampFieldToPage(copy) }])
    setSelectedId(copy.id)
  }

  function deleteSelected() {
    if (!selected) return
    commitFields(fields.filter((field) => field.id !== selected.id))
    setSelectedId(null)
  }

  function rotateSelected(delta = 15) {
    if (!selected) return
    updateField(selected.id, { rotation: selected.rotation + delta })
  }

  function clientToNormalized(clientX: number, clientY: number, pageRect: DOMRect) {
    return {
      x: (clientX - pageRect.left) / pageRect.width,
      y: (clientY - pageRect.top) / pageRect.height,
    }
  }

  function onPaletteDragStart(
    event: DragEvent<HTMLButtonElement>,
    assigneeId: string,
    fieldType: EdocFieldType,
  ) {
    event.dataTransfer.setData('application/x-edoc-field', JSON.stringify({ assigneeId, fieldType }))
    event.dataTransfer.effectAllowed = 'copy'
  }

  function onPageDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const raw = event.dataTransfer.getData('application/x-edoc-field')
    if (!raw || !pageRef.current) return
    try {
      const payload = JSON.parse(raw) as { assigneeId: string; fieldType: EdocFieldType }
      const point = clientToNormalized(event.clientX, event.clientY, pageRef.current.getBoundingClientRect())
      const draft = createEdocFieldDraft({
        assigneeDraftId: payload.assigneeId,
        fieldType: payload.fieldType,
        pageNumber,
        x: point.x,
        y: point.y,
      })
      placeField(payload.assigneeId, payload.fieldType, draft.x, draft.y)
    } catch {
      // ignore invalid drag payloads
    }
  }

  function beginPointerInteraction(field: EdocFieldDraft, mode: 'move' | 'resize' | 'rotate', event: ReactPointerEvent<HTMLElement>) {
    if (!pageRef.current) return
    event.preventDefault()
    event.stopPropagation()
    historySnapshotRef.current = fieldsRef.current
    const pageRect = pageRef.current.getBoundingClientRect()
    dragRef.current = {
      mode,
      fieldId: field.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: field.x,
      originY: field.y,
      originWidth: field.width,
      originHeight: field.height,
      originRotation: field.rotation,
      pageRect,
      createAssigneeId: null,
      createFieldType: null,
    }
    setSelectedId(field.id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginMove(field: EdocFieldDraft, event: ReactPointerEvent<HTMLButtonElement>) {
    beginPointerInteraction(field, 'move', event)
  }

  function beginResize(field: EdocFieldDraft, event: ReactPointerEvent<HTMLSpanElement>) {
    beginPointerInteraction(field, 'resize', event)
  }

  function beginRotate(field: EdocFieldDraft, event: ReactPointerEvent<HTMLSpanElement>) {
    beginPointerInteraction(field, 'rotate', event)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || !drag.fieldId) return
    const dx = (event.clientX - drag.startClientX) / drag.pageRect.width
    const dy = (event.clientY - drag.startClientY) / drag.pageRect.height

    if (drag.mode === 'move') {
      updateField(drag.fieldId, { x: drag.originX + dx, y: drag.originY + dy }, false)
      return
    }
    if (drag.mode === 'resize') {
      updateField(drag.fieldId, {
        width: drag.originWidth + dx,
        height: drag.originHeight + dy,
      }, false)
      return
    }
    if (drag.mode === 'rotate') {
      const centerX = drag.pageRect.left + (drag.originX + drag.originWidth / 2) * drag.pageRect.width
      const centerY = drag.pageRect.top + (drag.originY + drag.originHeight / 2) * drag.pageRect.height
      const startAngle = Math.atan2(drag.startClientY - centerY, drag.startClientX - centerX)
      const nextAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX)
      const degrees = drag.originRotation + ((nextAngle - startAngle) * 180) / Math.PI
      updateField(drag.fieldId, { rotation: degrees }, false)
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (drag.fieldId) {
      const current = fieldsRef.current.find((field) => field.id === drag.fieldId)
      if (current) {
        const resolved = resolveSoftOverlap(current, fieldsRef.current)
        const snapshot = historySnapshotRef.current
        if (snapshot) {
          setPast((currentPast) => [...currentPast, snapshot].slice(-40))
          setFuture([])
          historySnapshotRef.current = null
        }
        onChange(fieldsRef.current.map((field) => (field.id === current.id ? resolved : field)))
      }
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) {
      return
    }
    const meta = event.ctrlKey || event.metaKey
    if (meta && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
      return
    }
    if (meta && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      redo()
      return
    }
    if (meta && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      duplicateSelected()
      return
    }
    if (!selected) return
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      deleteSelected()
      return
    }
    const step = event.shiftKey ? 0.02 : 0.005
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      updateField(selected.id, { x: selected.x - step })
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      updateField(selected.id, { x: selected.x + step })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      updateField(selected.id, { y: selected.y - step })
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      updateField(selected.id, { y: selected.y + step })
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault()
      rotateSelected(event.shiftKey ? -15 : 15)
    }
  }

  if (!pdfBytes) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-10 text-center text-sm text-[var(--muted)]">
        Upload a PDF before placing signature fields.
      </div>
    )
  }

  return (
    <div className="edoc-placement-grid" onKeyDown={onKeyDown}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
          <button type="button" className="edoc-placement-tool" disabled={pageNumber <= 1} aria-label="Previous page" onClick={() => setPageNumber((n) => Math.max(1, n - 1))}>
            <ChevronLeft size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
          </button>
          <span className="min-w-[7rem] text-center text-xs font-semibold text-[var(--navy)]">
            Page {pageNumber} / {Math.max(pageCount, 1)}
          </span>
          <button type="button" className="edoc-placement-tool" disabled={pageNumber >= pageCount} aria-label="Next page" onClick={() => setPageNumber((n) => Math.min(pageCount, n + 1))}>
            <ChevronRight size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
          </button>
          <span className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden />
          <button type="button" className="edoc-placement-tool" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - 0.1) * 10) / 10))}>
            <ZoomOut size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
          </button>
          <span className="min-w-[3.5rem] text-center text-xs font-semibold text-[var(--muted)]">{Math.round(zoom * 100)}%</span>
          <button type="button" className="edoc-placement-tool" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + 0.1) * 10) / 10))}>
            <ZoomIn size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
          </button>
          <span className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden />
          <button type="button" className="edoc-placement-tool" aria-label="Undo" disabled={past.length === 0} onClick={undo}>
            <Undo2 size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
          </button>
          <button type="button" className="edoc-placement-tool" aria-label="Redo" disabled={future.length === 0} onClick={redo}>
            <Redo2 size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
          </button>
          <button type="button" className="edoc-placement-tool" aria-label="Duplicate selected field" disabled={!selected} onClick={duplicateSelected}>
            <Copy size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
          </button>
          <button type="button" className="edoc-placement-tool" aria-label="Rotate selected field" disabled={!selected} onClick={() => rotateSelected(15)}>
            <RotateCw size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
          </button>
          <button type="button" className="edoc-placement-tool edoc-placement-tool-danger" aria-label="Delete selected field" disabled={!selected} onClick={deleteSelected}>
            <Trash2 size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
          </button>
        </div>

        <div
          className="edoc-pdf-surface rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 sm:p-5"
          aria-label="Interactive PDF field placement"
          tabIndex={0}
        >
          {loading ? <p className="m-0 text-sm text-[var(--muted)]">Rendering PDF…</p> : null}
          {error ? <p className="m-0 text-sm text-[var(--danger)]">{error}</p> : null}
          {document ? (
            <div
              ref={pageRef}
              className="edoc-pdf-page-live relative mx-auto overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow)]"
              style={{ width: pageWidth, height: renderedSize.height }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onPageDrop}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClick={() => setSelectedId(null)}
            >
              <EdocPdfPageCanvas
                document={document}
                pageNumber={pageNumber}
                width={pageWidth}
                onRenderedSize={setRenderedSize}
              />
              {pageFields.map((field) => {
                const signatory = signatories.find((item) => item.id === field.assigneeDraftId)
                const color = colorByAssignee.get(field.assigneeDraftId) ?? signatoryColorForIndex(0)
                const isSelected = field.id === selectedId
                const label = `${edocFieldTypeLabels[field.fieldType]} · ${signatory?.displayName ?? 'Signatory'}`
                return (
                  <Tooltip key={field.id} title={`${label} · Page ${field.pageNumber} · ${Math.round(field.rotation)}°`}>
                    <button
                      type="button"
                      className={`edoc-field-box-live ${isSelected ? 'is-selected' : ''}`}
                      aria-label={label}
                      aria-pressed={isSelected}
                      style={{
                        left: `${field.x * 100}%`,
                        top: `${field.y * 100}%`,
                        width: `${field.width * 100}%`,
                        height: `${field.height * 100}%`,
                        transform: `rotate(${field.rotation}deg)`,
                        background: color.fill,
                        borderColor: color.stroke,
                        color: color.text,
                      }}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedId(field.id)
                      }}
                      onPointerDown={(event) => beginMove(field, event)}
                    >
                      <span className="edoc-field-box-live-label">{signatory?.displayName ?? 'Signatory'}</span>
                      <span className="edoc-field-box-live-type">{edocFieldTypeLabels[field.fieldType]}</span>
                      {isSelected ? (
                        <>
                          <span
                            className="edoc-field-handle edoc-field-handle-resize"
                            aria-hidden
                            onPointerDown={(event) => beginResize(field, event)}
                          />
                          <span
                            className="edoc-field-handle edoc-field-handle-rotate"
                            aria-hidden
                            onPointerDown={(event) => beginRotate(field, event)}
                          />
                        </>
                      ) : null}
                    </button>
                  </Tooltip>
                )
              })}
            </div>
          ) : null}
        </div>
        <p className="m-0 text-xs text-[var(--muted)]">
          Drag fields from the palette onto the page. Move, resize from the corner, rotate from the top handle. Arrow keys nudge; Delete removes; Ctrl/Cmd+Z undo; Ctrl/Cmd+D duplicate; R rotates.
        </p>
      </div>

      <aside className="edoc-field-panel rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-[var(--shadow)]">
        <h2 className="m-0 flex items-center gap-2 text-base font-semibold text-[var(--navy)]">
          <Layers size={iconSize.sm} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />
          Required fields
        </h2>

        {emptyMessage ? (
          <p className="m-0 text-sm text-[var(--muted)]">{emptyMessage}</p>
        ) : signatories.length === 0 ? (
          <p className="m-0 text-sm text-[var(--muted)]">Add assignees in the routing step before placing fields.</p>
        ) : (
          <div className="space-y-3">
            {signatories.map((signatory, index) => {
              const color = signatoryColorForIndex(index)
              const allowedFields = fieldTypesForAction(signatory.action)
              const placedCount = fields.filter((field) => field.assigneeDraftId === signatory.id).length
              return (
                <div key={signatory.id} className="edoc-field-row rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: color.stroke }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <strong className="block text-sm text-[var(--navy)]">{signatory.label}</strong>
                      <span className="text-xs text-[var(--muted)]">{placedCount} field{placedCount === 1 ? '' : 's'} placed</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allowedFields.map((fieldType) => (
                      <button
                        key={fieldType}
                        type="button"
                        draggable
                        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--navy)] transition hover:border-[var(--teal)] hover:text-[var(--teal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)]"
                        style={{ borderColor: color.stroke }}
                        aria-label={`Drag ${edocFieldTypeLabels[fieldType]} for ${signatory.displayName}`}
                        onDragStart={(event) => onPaletteDragStart(event, signatory.id, fieldType)}
                        onClick={() => placeField(signatory.id, fieldType, 0.12 + (placedCount % 3) * 0.08, 0.7)}
                      >
                        {edocFieldTypeLabels[fieldType]}
                      </button>
                    ))}
                  </div>
                  <label className="grid gap-1 text-xs text-[var(--muted)]">
                    Or add to current page
                    <select
                      className={VMP_INPUT_CLASS}
                      aria-label={`Add field for ${signatory.label}`}
                      defaultValue=""
                      onChange={(event) => {
                        if (!event.target.value) return
                        placeField(signatory.id, event.target.value as EdocFieldType, 0.12, 0.72)
                        event.currentTarget.value = ''
                      }}
                    >
                      <option value="" disabled>Add field</option>
                      {allowedFields.map((fieldType) => (
                        <option key={fieldType} value={fieldType}>{edocFieldTypeLabels[fieldType]}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )
            })}
          </div>
        )}
        <p className="m-0 text-xs leading-relaxed text-[var(--muted)]">
          Coordinates are stored as normalized page values (0–1) with rotation in degrees so placement stays accurate across zoom and screen sizes.
        </p>
      </aside>
    </div>
  )
}
