import type { AuthUser } from '../types/auth'
import type { UserPermissions } from '../types/permissions'
import { canViewMenu } from './permissions'

export type EdocAccessProfileField = 'organization' | 'signature'

export const edocAccessProfileFieldLabels: Record<EdocAccessProfileField, string> = {
  organization: 'Organization',
  signature: 'Electronic signature (PNG)',
}

export interface EdocAccessProfileCompleteness {
  complete: boolean
  organization: string | null
  hasSignature: boolean
  missing: EdocAccessProfileField[]
  missingLabels: string[]
  reminderMessage: string
}

/** Organization + e-signature required before eDoc create/send/sign/approve. */
export function getEdocAccessProfileCompleteness(
  user: Pick<AuthUser, 'organization' | 'signatureDataUrl'> | null | undefined,
): EdocAccessProfileCompleteness {
  const organization = user?.organization?.trim() || null
  const hasSignature = Boolean(user?.signatureDataUrl?.trim())
  const missing: EdocAccessProfileField[] = []
  if (!organization) missing.push('organization')
  if (!hasSignature) missing.push('signature')

  const missingLabels = missing.map((field) => edocAccessProfileFieldLabels[field])
  return {
    complete: missing.length === 0,
    organization,
    hasSignature,
    missing,
    missingLabels,
    reminderMessage: missingLabels.length
      ? `Complete your profile before using eDocuSign: set ${formatList(missingLabels)} in Account Settings.`
      : 'Your organization and electronic signature are on file.',
  }
}

export function hasAnyEdocMenuAccess(permissions: UserPermissions | null | undefined): boolean {
  if (!permissions) return false
  return Object.keys(permissions).some((menuId) => menuId.startsWith('edoc-') && canViewMenu(permissions, menuId))
}

export function isEdocProfileIncomplete(
  permissions: UserPermissions | null | undefined,
  user: Pick<AuthUser, 'organization' | 'signatureDataUrl'> | null | undefined,
): boolean {
  return hasAnyEdocMenuAccess(permissions) && !getEdocAccessProfileCompleteness(user).complete
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}
