const STORAGE_KEY = 'apqr-sent-by-suggestions'
const MAX_SUGGESTIONS = 50

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function readSentBySuggestions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map(normalizeName)
      .filter(Boolean)
  } catch {
    return []
  }
}

export function rememberSentBy(name: string): void {
  const trimmed = normalizeName(name)
  if (!trimmed) return
  unhide(trimmed)
  const existing = readSentBySuggestions().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())
  localStorage.setItem(STORAGE_KEY, JSON.stringify([trimmed, ...existing].slice(0, MAX_SUGGESTIONS)))
}

export function forgetSentBy(name: string): void {
  const trimmed = normalizeName(name)
  if (!trimmed) return
  const existing = readSentBySuggestions().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  const hidden = readHidden().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([trimmed, ...hidden].slice(0, MAX_SUGGESTIONS)))
}

const HIDDEN_KEY = 'apqr-sent-by-hidden'

function readHidden(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string').map(normalizeName).filter(Boolean)
  } catch {
    return []
  }
}

function unhide(value: string): void {
  const hidden = readHidden().filter((entry) => entry.toLowerCase() !== value.toLowerCase())
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden))
}

export function isSentByHidden(name: string): boolean {
  const trimmed = normalizeName(name)
  if (!trimmed) return false
  return readHidden().some((entry) => entry.toLowerCase() === trimmed.toLowerCase())
}

export function mergeSentBySuggestions(additional: string[] = []): string[] {
  const recent = readSentBySuggestions()
  const hidden = new Set(readHidden().map((entry) => entry.toLowerCase()))
  const seen = new Set<string>()
  const merged: string[] = []

  for (const name of [...recent, ...additional.map(normalizeName)]) {
    if (!name || seen.has(name) || hidden.has(name.toLowerCase())) continue
    seen.add(name)
    merged.push(name)
  }

  const recentRank = new Map(recent.map((name, index) => [name, index]))
  return merged.sort((a, b) => {
    const aRank = recentRank.get(a)
    const bRank = recentRank.get(b)
    if (aRank != null && bRank != null) return aRank - bRank
    if (aRank != null) return -1
    if (bRank != null) return 1
    return a.localeCompare(b)
  })
}
