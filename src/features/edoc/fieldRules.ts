import type { EdocAssignableAction, EdocFieldDraft, EdocFieldType } from './types'
import { clampNormalized, normalizeRotation } from './fieldPlacementGeometry'

export { clampNormalized, normalizeRotation } from './fieldPlacementGeometry'

export const edocFieldTypeLabels: Record<EdocFieldType, string> = {
  signature: 'Signature',
  initial: 'Initial',
  date_signed: 'Date signed',
  name: 'Name',
  job_title: 'Job title',
  text: 'Text',
  approval_meaning: 'Approval meaning',
  review_meaning: 'Review meaning',
  acknowledgment: 'Acknowledgment',
  checkbox: 'Checkbox',
}

export function fieldTypesForAction(action: EdocAssignableAction): EdocFieldType[] {
  if (action === 'sign') return ['signature', 'initial', 'date_signed', 'name', 'job_title', 'text']
  if (action === 'approve') return ['approval_meaning', 'date_signed', 'name', 'text', 'checkbox']
  if (action === 'review') return ['review_meaning', 'date_signed', 'name', 'text', 'checkbox']
  return ['acknowledgment', 'date_signed', 'name', 'text', 'checkbox']
}

export function defaultFieldSize(fieldType: EdocFieldType): { width: number; height: number } {
  if (fieldType === 'signature') return { width: 0.22, height: 0.08 }
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
  const width = clampNormalized(input.width ?? size.width, 0.03, 0.95)
  const height = clampNormalized(input.height ?? size.height, 0.03, 0.95)
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
