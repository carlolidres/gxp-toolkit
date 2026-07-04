export type ApqrContactEntry = {
  name: string
  title: string
  email: string
}

const CONTACT_EMAIL_RE = /[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9?._-]+\.?)*[A-Za-z0-9.-]+\.[A-Za-z]{2,}/

export function emptyContact(): ApqrContactEntry {
  return { name: '', title: '', email: '' }
}

function isContactEntry(value: unknown): value is ApqrContactEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.name === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.email === 'string'
  )
}

function normalizeContact(entry: ApqrContactEntry): ApqrContactEntry {
  return {
    name: entry.name.trim(),
    title: entry.title.trim(),
    email: entry.email.trim(),
  }
}

function hasContactContent(entry: ApqrContactEntry): boolean {
  return Boolean(entry.name || entry.title || entry.email)
}

export function serializeContacts(entries: ApqrContactEntry[]): string {
  const cleaned = entries.map(normalizeContact).filter(hasContactContent)
  return cleaned.length ? JSON.stringify(cleaned) : ''
}

export function parseContacts(raw: string | null | undefined): ApqrContactEntry[] {
  if (!raw?.trim()) return [emptyContact()]

  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.every(isContactEntry)) {
        const entries = parsed.map(normalizeContact).filter(hasContactContent)
        return entries.length ? entries : [emptyContact()]
      }
    } catch {
      // ponytail: fall through to legacy free-text parsing
    }
  }

  const segments = parseContactSegments(trimmed)
  if (!segments.length) return [emptyContact()]
  return segments.map(legacySegmentToContact)
}

export function formatContactsPlainText(raw: string | null | undefined): string {
  return parseContacts(raw)
    .filter(hasContactContent)
    .map((entry) => [entry.name, entry.title, entry.email].filter(Boolean).join(' | '))
    .join('\n')
}

function legacySegmentToContact(segment: string): ApqrContactEntry {
  const emailMatch = segment.match(CONTACT_EMAIL_RE)
  if (!emailMatch || emailMatch.index == null) {
    return { name: segment.trim(), title: '', email: '' }
  }

  const email = emailMatch[0]
  const beforeEmail = segment.slice(0, emailMatch.index).trim()
  return { name: beforeEmail, title: '', email }
}

export function parseContactSegments(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const segments: string[] = []

  for (const line of lines) {
    if (line.includes(',')) {
      const commaParts = line
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
      if (commaParts.length > 1) {
        segments.push(...commaParts)
        continue
      }
    }
    segments.push(...splitContactLineByEmail(line))
  }

  return segments
}

function splitContactLineByEmail(line: string): string[] {
  const matches = [...line.matchAll(new RegExp(CONTACT_EMAIL_RE, 'g'))]
  if (matches.length <= 1) return [line]

  const parts: string[] = []
  let cursor = 0
  for (const match of matches) {
    const end = (match.index ?? 0) + match[0].length
    const chunk = line.slice(cursor, end).trim()
    if (chunk) parts.push(chunk)
    cursor = end
  }
  return parts.length ? parts : [line]
}

export { CONTACT_EMAIL_RE }
