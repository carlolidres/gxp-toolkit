/** Owner-designated administrator account (workflow-app maintenance record). */
export const DESIGNATED_ADMIN_EMAIL = 'carlolidres@gmail.com'

export function isDesignatedAdminEmail(email: string | undefined | null): boolean {
  return Boolean(email && email.trim().toLowerCase() === DESIGNATED_ADMIN_EMAIL.toLowerCase())
}

/** Profile DB role with owner-designated admin override. */
export function resolveProfileRole(email: string, profileRole?: string | null): string {
  if (isDesignatedAdminEmail(email)) return 'admin'
  return profileRole?.trim() || 'user'
}
