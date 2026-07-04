import type { EdocAssignableAction, EdocFieldType } from './types'

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
    x: clamp(rect.x / rect.pageWidth),
    y: clamp(rect.y / rect.pageHeight),
    width: clamp(rect.width / rect.pageWidth),
    height: clamp(rect.height / rect.pageHeight),
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

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

