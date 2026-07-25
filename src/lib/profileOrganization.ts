/** Trim edges and collapse internal whitespace for organization labels. */
export function normalizeOrganizationValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** Case-insensitive key used for duplicate detection. */
export function organizationKey(value: string): string {
  return normalizeOrganizationValue(value).toLowerCase()
}

export function findDuplicateOrganization(
  value: string,
  options: readonly string[],
): string | null {
  const key = organizationKey(value)
  if (!key) return null
  return options.find((option) => organizationKey(option) === key) ?? null
}

/** Insert or promote an option; preserves existing casing on case-insensitive matches. */
export function upsertOrganizationOption(value: string, options: readonly string[]): string[] {
  const normalized = normalizeOrganizationValue(value)
  if (!normalized) return [...options]

  const duplicate = findDuplicateOrganization(normalized, options)
  const canonical = duplicate ?? normalized
  const key = organizationKey(canonical)
  return [canonical, ...options.filter((option) => organizationKey(option) !== key)]
}

export function removeOrganizationOption(value: string, options: readonly string[]): string[] {
  const key = organizationKey(value)
  if (!key) return [...options]
  return options.filter((option) => organizationKey(option) !== key)
}

export function validateOrganizationValue(value: string): string | null {
  const normalized = normalizeOrganizationValue(value)
  if (!normalized) return null
  if (normalized.length > 120) return 'Organization must be 120 characters or fewer.'
  return null
}
