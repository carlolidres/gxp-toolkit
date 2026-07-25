import type { AuthUser } from '../types/auth'
import { splitDisplayName } from './profileNames'

export type SignatoryProfileField = 'firstName' | 'lastName' | 'jobTitle' | 'signature'

export const signatoryProfileFieldLabels: Record<SignatoryProfileField, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  jobTitle: 'Position/Title',
  signature: 'Saved signature (PNG)',
}

export interface SignatoryProfileCompleteness {
  complete: boolean
  firstName: string
  lastName: string
  fullName: string
  jobTitle: string
  signatureDataUrl: string | null
  missing: SignatoryProfileField[]
  missingLabels: string[]
  reminderMessage: string
}

/** Fields required so eDoc Name / Position-Title / Signature overlays can be filled from the user profile. */
export function getSignatoryProfileCompleteness(
  user: Pick<AuthUser, 'name' | 'email' | 'jobTitle' | 'signatureDataUrl'> | null | undefined,
): SignatoryProfileCompleteness {
  const names = splitDisplayName(user?.name ?? '', user?.email ?? '')
  const firstName = names.firstName.trim()
  const lastName = names.lastName.trim()
  const jobTitle = user?.jobTitle?.trim() || ''
  const signatureDataUrl = user?.signatureDataUrl?.trim() || null

  const missing: SignatoryProfileField[] = []
  if (!firstName) missing.push('firstName')
  if (!lastName) missing.push('lastName')
  if (!jobTitle) missing.push('jobTitle')
  if (!signatureDataUrl) missing.push('signature')

  const missingLabels = missing.map((field) => signatoryProfileFieldLabels[field])
  const reminderMessage = missingLabels.length
    ? `Complete your profile before signing: set ${formatList(missingLabels)} in Account Settings.`
    : 'Your profile has the name, position/title, and signature needed for eDoc signatory fields.'

  return {
    complete: missing.length === 0,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    jobTitle,
    signatureDataUrl,
    missing,
    missingLabels,
    reminderMessage,
  }
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}
