import type { EdocAssignableAction } from './types'

/** Required Reason for Signing options (statement is stamped and audited). */
export const EDOC_SIGNATURE_REASONS = [
  { key: 'prepared', label: 'Prepared', statement: 'I prepared this document.' },
  { key: 'reviewed', label: 'Reviewed', statement: 'I reviewed this document.' },
  { key: 'approved', label: 'Approved', statement: 'I approve this document.' },
  {
    key: 'acknowledged',
    label: 'Acknowledged',
    statement: 'I acknowledge receipt and understanding of this document.',
  },
  {
    key: 'verified',
    label: 'Verified',
    statement: 'I verified the accuracy and completeness of this document.',
  },
] as const

export type EdocSignatureReasonKey = (typeof EDOC_SIGNATURE_REASONS)[number]['key']
export type EdocSignatureMeaning = (typeof EDOC_SIGNATURE_REASONS)[number]['statement']

/** @deprecated Prefer EDOC_SIGNATURE_REASONS; kept as the list of allowed stamped statements. */
export const EDOC_SIGNATURE_MEANINGS = EDOC_SIGNATURE_REASONS.map((reason) => reason.statement)

export const REVIEWED_SIGNATURE_MEANING =
  'I reviewed this document.' as const satisfies EdocSignatureMeaning

export const APPROVED_SIGNATURE_MEANING =
  'I approve this document.' as const satisfies EdocSignatureMeaning

export const ACKNOWLEDGED_SIGNATURE_MEANING =
  'I acknowledge receipt and understanding of this document.' as const satisfies EdocSignatureMeaning

/** Legacy stamp values still accepted when reading historical signatures. */
const LEGACY_REVIEWED_MEANINGS = new Set(['Reviewed by', REVIEWED_SIGNATURE_MEANING])
const LEGACY_APPROVED_MEANINGS = new Set(['Approved by', APPROVED_SIGNATURE_MEANING])

export const REVIEWED_BY_SIGNATURE_MEANING = REVIEWED_SIGNATURE_MEANING

export function signatureReasonOptionLabel(statement: string): string {
  const match = EDOC_SIGNATURE_REASONS.find((reason) => reason.statement === statement)
  return match ? `${match.label} — ${match.statement}` : statement
}

export function isEdocSignatureMeaning(value: string): value is EdocSignatureMeaning {
  return (EDOC_SIGNATURE_MEANINGS as readonly string[]).includes(value)
}

export function isReviewedSignatureMeaning(value: string): boolean {
  return LEGACY_REVIEWED_MEANINGS.has(value)
}

export function isApprovedSignatureMeaning(value: string): boolean {
  return LEGACY_APPROVED_MEANINGS.has(value)
}

/**
 * Signatory levels (Prepared / Reviewed / Approved / Acknowledge) complete via e-sign.
 * External-auth Document Controller steps stay approve/reject without PDF stamp.
 */
export function assignmentRequiresElectronicSignature(
  action: EdocAssignableAction,
  stepKind?: 'signatory' | 'external_auth',
): boolean {
  if (stepKind === 'external_auth') return false
  return (
    action === 'sign'
    || action === 'review'
    || action === 'approve'
    || action === 'acknowledge'
  )
}

/** Level-bound reasons are locked; Prepared (`sign`) still chooses from the list. */
export function isSignatureMeaningLocked(action: EdocAssignableAction): boolean {
  return action === 'review' || action === 'approve' || action === 'acknowledge'
}

export function defaultSignatureMeaningForAction(action: EdocAssignableAction): string {
  if (action === 'review') return REVIEWED_SIGNATURE_MEANING
  if (action === 'approve') return APPROVED_SIGNATURE_MEANING
  if (action === 'acknowledge') return ACKNOWLEDGED_SIGNATURE_MEANING
  return ''
}

export function reviewAndSignAuditReason(reviewerName: string): string {
  const name = reviewerName.trim() || 'Reviewer'
  return `Document reviewed and electronically signed by ${name}`
}

export function approveAndSignAuditReason(approverName: string): string {
  const name = approverName.trim() || 'Approver'
  return `Document approved and electronically signed by ${name}`
}
