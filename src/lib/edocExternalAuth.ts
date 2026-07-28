/** External Document Controller authorization helpers (profile organization compare). */

export function organizationKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

/** True when any assignee org differs from the creator org (null/empty assignee org counts as different). */
export function needsExternalAuth(
  creatorOrganization: string | null | undefined,
  assigneeOrganizations: Array<string | null | undefined>,
): boolean {
  const creatorKey = organizationKey(creatorOrganization)
  if (!creatorKey) return false
  return assigneeOrganizations.some((org) => organizationKey(org) !== creatorKey)
}

export function missingCreatorOrganizationMessage(): string {
  return 'Complete your organization in Account Settings before sending documents.'
}

export function missingDocumentControllerMessage(organizationLabel: string): string {
  return `External transmission blocked: assign at least one Document Controller for "${organizationLabel}" before sending to recipients in another organization.`
}

export function externalAuthWarningMessage(): string {
  return 'One or more recipients belong to a different organization. This document will be routed to your Document Controllers for authorization first (first approval wins).'
}
