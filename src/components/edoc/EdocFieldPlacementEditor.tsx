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
import { Alert, Tooltip } from 'antd'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers,
  MousePointerSquareDashed,
  Redo2,
  RotateCw,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import { EdocPdfPageCanvas } from './EdocPdfPageCanvas'
import { EdocSignatureStampPreview } from './EdocSignatureStampPreview'
import {
  createEdocFieldDraft,
  fieldTypesForAction,
} from '../../features/edoc/fieldRules'
import {
  clampFieldToPage,
  findOverlappingField,
  isSignatureRectTooSmall,
  normalizeCreateRect,
  normalizeRotation,
  resolveSoftOverlap,
  signatoryColorForIndex,
} from '../../features/edoc/fieldPlacementGeometry'
import {
  STAMP_MODE_LABEL,
  pickPreferredMode,
} from '../../features/edoc/pdfStampGeometry'
import { usePdfDocument } from '../../features/edoc/usePdfDocument'
import type { EdocAssignableAction, EdocFieldDraft, EdocFieldType } from '../../features/edoc/types'
import { iconSize, iconStroke } from '../../theme/iconSizes'

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
  startNormX: number
  startNormY: number
}

type DrawTool = {
  assigneeId: string
  fieldType: EdocFieldType
} | null

const MIN_ZOOM = 0.7
const MAX_ZOOM = 2.2
const BASE_PAGE_WIDTH = 640

function roleForAction(action: EdocAssignableAction): string {
  if (action === 'approve') return 'Approver'
  if (action === 'review') return 'Reviewer'
  if (action === 'acknowledge') return 'Acknowledger'
  return 'Signatory'
}

function layoutModeForField(field: EdocFieldDraft, pageCssWidth: number, pageCssHeight: number): string {
  const ptW = field.width * pageCssWidth * 0.75
  const ptH = field.height * pageCssHeight * 0.75
  return STAMP_MODE_LABEL[pickPreferredMode(ptW, ptH)]
}

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
  const [drawTool, setDrawTool] = useState<DrawTool>(null)
  const [createPreview, setCreatePreview] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [placementWarning, setPlacementWarning] = useState<string | null>(null)
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
  const selectedOverlap = selected ? findOverlappingField(selected, fields) : null

  useEffect(() => {
    if (pageCount > 0 && pageNumber > pageCount) setPageNumber(pageCount)
  }, [pageCount, pageNumber])

  useEffect(() => {
    if (selectedOverlap) {
      setPlacementWarning('Fields cannot overlap. Move or resize until the warning clears before sending.')
    } else if (placementWarning?.includes('overlap')) {
      setPlacementWarning(null)
    }
  }, [selectedOverlap, placementWarning])

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
    if (findOverlappingField(resolved, next)) {
      setPlacementWarning('Fields cannot overlap. Adjust placement until they no longer intersect.')
    }
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

  function placeField(assigneeDraftId: string, fieldType: EdocFieldType, x: number, y: number, width?: number, height?: number) {
    const draft = createEdocFieldDraft({
      assigneeDraftId,
      fieldType,
      pageNumber,
      x,
      y,
      width,
      height,
    })
    const created = resolveSoftOverlap(draft, fieldsRef.current)
    if (findOverlappingField(created, fieldsRef.current)) {
      setPlacementWarning('Cannot place field — it would overlap another field. Draw in a free area.')
      return
    }
    setPlacementWarning(null)
    commitFields([...fieldsRef.current, created])
    setSelectedId(created.id)
    setDrawTool(null)
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
    if (findOverlappingField(copy, fields)) {
      setPlacementWarning('Cannot duplicate here — no free space without overlap.')
      return
    }
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
      placeField(payload.assigneeId, payload.fieldType, draft.x, draft.y, draft.width, draft.height)
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
      startNormX: field.x,
      startNormY: field.y,
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

  function beginCreateDraw(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawTool || !pageRef.current) return
    if ((event.target as HTMLElement).closest('.edoc-field-box-live')) return
    event.preventDefault()
    const pageRect = pageRef.current.getBoundingClientRect()
    const start = clientToNormalized(event.clientX, event.clientY, pageRect)
    historySnapshotRef.current = fieldsRef.current
    dragRef.current = {
      mode: 'create',
      fieldId: null,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: start.x,
      originY: start.y,
      originWidth: 0,
      originHeight: 0,
      originRotation: 0,
      pageRect,
      createAssigneeId: drawTool.assigneeId,
      createFieldType: drawTool.fieldType,
      startNormX: start.x,
      startNormY: start.y,
    }
    setCreatePreview({ x: start.x, y: start.y, width: 0, height: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    if (drag.mode === 'create') {
      const end = clientToNormalized(event.clientX, event.clientY, drag.pageRect)
      setCreatePreview(normalizeCreateRect(drag.startNormX, drag.startNormY, end.x, end.y))
      return
    }

    if (!drag.fieldId) return
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

    if (drag.mode === 'create' && drag.createAssigneeId && drag.createFieldType) {
      const end = clientToNormalized(event.clientX, event.clientY, drag.pageRect)
      const rect = normalizeCreateRect(drag.startNormX, drag.startNormY, end.x, end.y)
      setCreatePreview(null)
      if (drag.createFieldType === 'signature' && isSignatureRectTooSmall(rect.width, rect.height)) {
        setPlacementWarning(
          'Signature area is too small. Try a taller slim strip (narrow margin) or a wider short banner (~180×36 px), or enlarge the box.',
        )
        return
      }
      if (drag.createFieldType !== 'signature' && (rect.width < 0.03 || rect.height < 0.03)) {
        setPlacementWarning('Field is too small. Draw a larger area.')
        return
      }
      placeField(drag.createAssigneeId, drag.createFieldType, rect.x, rect.y, rect.width, rect.height)
      return
    }

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
        if (findOverlappingField(resolved, fieldsRef.current)) {
          setPlacementWarning('Fields cannot overlap. Adjust placement before continuing.')
        }
        onChange(fieldsRef.current.map((field) => (field.id === current.id ? resolved : field)))
      }
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) {
      return
    }
    if (event.key === 'Escape' && drawTool) {
      event.preventDefault()
      setDrawTool(null)
      setCreatePreview(null)
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
          {drawTool ? (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--teal)_12%,transparent)] px-2 py-1 text-[11px] font-semibold text-[var(--teal)]">
              <MousePointerSquareDashed size={14} strokeWidth={iconStroke} aria-hidden />
              Draw on PDF · Esc to cancel
            </span>
          ) : null}
        </div>

        {placementWarning ? (
          <Alert type="warning" showIcon closable message={placementWarning} onClose={() => setPlacementWarning(null)} />
        ) : null}

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
              className={`edoc-pdf-page-live relative mx-auto overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow)] ${drawTool ? 'is-draw-mode' : ''}`}
              style={{
                width: pageWidth,
                height: renderedSize.height,
                cursor: drawTool ? 'crosshair' : undefined,
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onPageDrop}
              onPointerDown={beginCreateDraw}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClick={() => {
                if (!drawTool) setSelectedId(null)
              }}
            >
              <EdocPdfPageCanvas
                document={document}
                pageNumber={pageNumber}
                width={pageWidth}
                onRenderedSize={setRenderedSize}
              />
              {createPreview && createPreview.width > 0.005 && createPreview.height > 0.005 ? (
                <div
                  className={`edoc-field-create-preview ${
                    drawTool?.fieldType === 'signature' && isSignatureRectTooSmall(createPreview.width, createPreview.height)
                      ? 'is-too-small'
                      : 'is-ok'
                  }`}
                  style={{
                    left: `${createPreview.x * 100}%`,
                    top: `${createPreview.y * 100}%`,
                    width: `${createPreview.width * 100}%`,
                    height: `${createPreview.height * 100}%`,
                  }}
                />
              ) : null}
              {pageFields.map((field) => {
                const signatory = signatories.find((item) => item.id === field.assigneeDraftId)
                const color = colorByAssignee.get(field.assigneeDraftId) ?? signatoryColorForIndex(0)
                const isSelected = field.id === selectedId
                const isSignature = field.fieldType === 'signature'
                const layoutLabel = isSignature
                  ? layoutModeForField(field, renderedSize.width, renderedSize.height)
                  : null
                const dimLabel = `${Math.round(field.width * renderedSize.width)}×${Math.round(field.height * renderedSize.height)}px`
                const label = `${signatory?.displayName ?? 'Signatory'}${layoutLabel ? ` · ${layoutLabel}` : ''}`
                const overlaps = Boolean(findOverlappingField(field, fields))
                return (
                  <Tooltip key={field.id} title={`${label} · ${dimLabel} · Page ${field.pageNumber}`}>
                    <button
                      type="button"
                      className={`edoc-field-box-live ${isSelected ? 'is-selected' : ''} ${isSignature ? 'is-signature' : ''} ${overlaps ? 'is-invalid' : ''}`}
                      aria-label={label}
                      aria-pressed={isSelected}
                      style={{
                        left: `${field.x * 100}%`,
                        top: `${field.y * 100}%`,
                        width: `${field.width * 100}%`,
                        height: `${field.height * 100}%`,
                        transform: `rotate(${field.rotation}deg)`,
                        background: isSignature ? 'transparent' : color.fill,
                        borderColor: color.stroke,
                        color: color.text,
                      }}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedId(field.id)
                      }}
                      onPointerDown={(event) => beginMove(field, event)}
                    >
                      {isSignature ? (
                        <EdocSignatureStampPreview
                          className="edoc-field-stamp-preview"
                          editing
                          signerName={signatory?.displayName ?? 'Signatory'}
                          role={signatory ? roleForAction(signatory.action) : 'Signatory'}
                          reason="Approved this document"
                          email=""
                          signedAtLabel="Preview · local time"
                        />
                      ) : (
                        <span className="edoc-field-box-live-label">{signatory?.displayName ?? 'Signatory'}</span>
                      )}
                      {isSelected ? (
                        <span className="edoc-field-meta-chip">
                          {layoutLabel ? `${layoutLabel} · ` : ''}{dimLabel}
                        </span>
                      ) : (
                        <span className="edoc-field-assignee-chip" style={{ background: color.stroke }}>
                          {signatory?.displayName?.split(' ')[0] ?? 'Signer'}
                        </span>
                      )}
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
      </div>

      <aside className="edoc-field-panel rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-[var(--shadow)]">
        <h2 className="m-0 flex items-center gap-2 text-base font-semibold text-[var(--navy)]">
          <Layers size={iconSize.sm} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />
          Signatories
        </h2>

        {emptyMessage ? (
          <p className="m-0 text-sm text-[var(--muted)]">{emptyMessage}</p>
        ) : signatories.length === 0 ? (
          <p className="m-0 text-sm text-[var(--muted)]">Add assignees in the routing step before placing signatures.</p>
        ) : (
          <div className="space-y-2">
            {signatories.map((signatory, index) => {
              const color = signatoryColorForIndex(index)
              const fieldType = fieldTypesForAction(signatory.action)[0] ?? 'signature'
              const placedCount = fields.filter((field) => field.assigneeDraftId === signatory.id).length
              const active = drawTool?.assigneeId === signatory.id
              return (
                <div key={signatory.id} className="edoc-field-row rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color.stroke }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-[var(--navy)]">{signatory.displayName}</strong>
                      <span className="text-xs text-[var(--muted)]">
                        {signatory.label}
                        {placedCount > 0 ? ` · ${placedCount} placed` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)] ${active ? 'border-[var(--teal)] bg-[color-mix(in_srgb,var(--teal)_12%,transparent)] text-[var(--teal)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--navy)] hover:border-[var(--teal)] hover:text-[var(--teal)]'}`}
                      style={{ borderColor: active ? undefined : color.stroke }}
                      aria-label={active ? `Cancel drawing for ${signatory.displayName}` : `Place signature for ${signatory.displayName}`}
                      aria-pressed={active}
                      draggable
                      onDragStart={(event) => onPaletteDragStart(event, signatory.id, fieldType)}
                      onClick={() => {
                        setDrawTool(active ? null : { assigneeId: signatory.id, fieldType })
                        setPlacementWarning(active ? null : `Click and drag on the PDF to place ${signatory.displayName}'s signature.`)
                      }}
                    >
                      {active ? 'Cancel' : placedCount > 0 ? 'Add another' : 'Place'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </aside>
    </div>
  )
}
