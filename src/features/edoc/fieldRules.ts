import type { EdocAssignableAction, EdocFieldDraft, EdocFieldType } from './types'
import { clampNormalized, normalizeRotation } from './fieldPlacementGeometry'
import { DEFAULT_SIGNATURE_FIELD_NORM, MIN_SIGNATURE_FIELD_NORM } from './pdfStampGeometry'

export { clampNormalized, normalizeRotation } from './fieldPlacementGeometry'

export const edocFieldTypeLabels: Record<EdocFieldType, string> = {
  signature: 'Signature',
  initial: 'Initial',
  date_signed: 'Date signed',
  name: 'Name',
  job_title: 'Position/Title',
  text: 'Text',
  approval_meaning: 'Approval meaning',
  review_meaning: 'Review meaning',
  acknowledgment: 'Acknowledgment',
  checkbox: 'Checkbox',
}

/** Placement palette — e-signature stamp only (name/role/date come from the stamp). */
const SIGNATORY_FIELD_TYPES: EdocFieldType[] = ['signature']

export function fieldTypesForAction(_action: EdocAssignableAction): EdocFieldType[] {
  return SIGNATORY_FIELD_TYPES
}

export function defaultFieldSize(fieldType: EdocFieldType): { width: number; height: number } {
  // Comfortable default; adaptive stamp renderer accepts smaller user-drawn fields.
  if (fieldType === 'signature') return { ...DEFAULT_SIGNATURE_FIELD_NORM }
  if (fieldType === 'initial') return { width: 0.1, height: 0.06 }
  if (fieldType === 'checkbox') return { width: 0.04, height: 0.04 }
  if (fieldType === 'date_signed') return { width: 0.16, height: 0.045 }
  return { width: 0.2, height: 0.05 }
}

export function createEdocFieldDraft(input: {
  assigneeDraftId: string
  fieldType: EdocFieldType
  pageNumber: number
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
}): EdocFieldDraft {
  const size = defaultFieldSize(input.fieldType)
  const isSignature = input.fieldType === 'signature'
  const minW = isSignature ? MIN_SIGNATURE_FIELD_NORM.width : 0.03
  const minH = isSignature ? MIN_SIGNATURE_FIELD_NORM.height : 0.03
  const width = clampNormalized(input.width ?? size.width, minW, 0.95)
  const height = clampNormalized(input.height ?? size.height, minH, 0.95)
  const x = clampNormalized(input.x ?? 0.12, 0, 1 - width)
  const y = clampNormalized(input.y ?? 0.72, 0, 1 - height)
  return {
    id: crypto.randomUUID(),
    assigneeDraftId: input.assigneeDraftId,
    fieldType: input.fieldType,
    pageNumber: Math.max(1, Math.floor(input.pageNumber || 1)),
    x,
    y,
    width,
    height,
    rotation: normalizeRotation(input.rotation ?? 0),
    required: true,
  }
}

export function normalizePdfRect(rect: {
  x: number
  y: number
  width: number
  height: number
  pageWidth: number
  pageHeight: number
}) {
  if (rect.pageWidth <= 0 || rect.pageHeight <= 0) {
    throw new Error('PDF page dimensions are required.')
  }

  return {
    x: clamp01(rect.x / rect.pageWidth),
    y: clamp01(rect.y / rect.pageHeight),
    width: clamp01(rect.width / rect.pageWidth),
    height: clamp01(rect.height / rect.pageHeight),
  }
}

export function denormalizePdfRect(rect: {
  x: number
  y: number
  width: number
  height: number
  pageWidth: number
  pageHeight: number
}) {
  return {
    x: rect.x * rect.pageWidth,
    y: rect.y * rect.pageHeight,
    width: rect.width * rect.pageWidth,
    height: rect.height * rect.pageHeight,
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
