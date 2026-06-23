export function splitDisplayName(displayName: string, email: string): { firstName: string; lastName: string } {
  const trimmed = displayName.trim()
  if (!trimmed) {
    const local = email.split('@')[0] ?? ''
    return { firstName: local, lastName: '' }
  }

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

export function joinDisplayName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim()
}
