import { describe, expect, it } from 'vitest'

import {
  APPROVED_SIGNATURE_MEANING,
  assignmentRequiresElectronicSignature,
  approveAndSignAuditReason,
  defaultSignatureMeaningForAction,
  EDOC_SIGNATURE_MEANINGS,
  EDOC_SIGNATURE_REASONS,
  isApprovedSignatureMeaning,
  isEdocSignatureMeaning,
  isReviewedSignatureMeaning,
  isSignatureMeaningLocked,
  reviewAndSignAuditReason,
  REVIEWED_SIGNATURE_MEANING,
  signatureReasonOptionLabel,
} from './signatureMeanings'

describe('Reason for Signing helpers', () => {
  it('requires electronic signature for all signatory levels', () => {
    expect(assignmentRequiresElectronicSignature('sign')).toBe(true)
    expect(assignmentRequiresElectronicSignature('review')).toBe(true)
    expect(assignmentRequiresElectronicSignature('approve')).toBe(true)
    expect(assignmentRequiresElectronicSignature('acknowledge')).toBe(true)
    expect(assignmentRequiresElectronicSignature('approve', 'external_auth')).toBe(false)
  })

  it('provides the required Reason for Signing statements', () => {
    expect(EDOC_SIGNATURE_REASONS.map((reason) => reason.statement)).toEqual([
      'I prepared this document.',
      'I reviewed this document.',
      'I approve this document.',
      'I acknowledge receipt and understanding of this document.',
      'I verified the accuracy and completeness of this document.',
    ])
    expect(EDOC_SIGNATURE_MEANINGS).toContain('I approve this document.')
    expect(isEdocSignatureMeaning('I approve this document.')).toBe(true)
    expect(isEdocSignatureMeaning('Approved by')).toBe(false)
  })

  it('locks level-bound reasons and requires selection for Prepared/sign', () => {
    expect(isSignatureMeaningLocked('review')).toBe(true)
    expect(isSignatureMeaningLocked('approve')).toBe(true)
    expect(isSignatureMeaningLocked('acknowledge')).toBe(true)
    expect(isSignatureMeaningLocked('sign')).toBe(false)
    expect(defaultSignatureMeaningForAction('review')).toBe(REVIEWED_SIGNATURE_MEANING)
    expect(defaultSignatureMeaningForAction('approve')).toBe(APPROVED_SIGNATURE_MEANING)
    expect(defaultSignatureMeaningForAction('sign')).toBe('')
    expect(signatureReasonOptionLabel(REVIEWED_SIGNATURE_MEANING)).toBe(
      'Reviewed — I reviewed this document.',
    )
  })

  it('recognizes reviewed and approved meanings for history consolidation', () => {
    expect(isReviewedSignatureMeaning(REVIEWED_SIGNATURE_MEANING)).toBe(true)
    expect(isReviewedSignatureMeaning('Reviewed by')).toBe(true)
    expect(isReviewedSignatureMeaning('I approve this document.')).toBe(false)
    expect(isApprovedSignatureMeaning(APPROVED_SIGNATURE_MEANING)).toBe(true)
    expect(isApprovedSignatureMeaning('Approved by')).toBe(true)
  })

  it('builds review-and-sign and approve-and-sign audit reasons', () => {
    expect(reviewAndSignAuditReason('Carlo M. Lidres')).toBe(
      'Document reviewed and electronically signed by Carlo M. Lidres',
    )
    expect(approveAndSignAuditReason('Carlo M. Lidres')).toBe(
      'Document approved and electronically signed by Carlo M. Lidres',
    )
  })
})
