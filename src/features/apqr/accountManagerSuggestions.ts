const STORAGE_KEY = 'apqr-account-manager-suggestions'
const MAX_SUGGESTIONS = 50

function normalizeAccountManager(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function readAccountManagerSuggestions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map(normalizeAccountManager)
      .filter(Boolean)
  } catch {
    return []
  }
}

export function rememberAccountManager(value: string): void {
  const trimmed = normalizeAccountManager(value)
  if (!trimmed) return
  const existing = readAccountManagerSuggestions().filter((entry) => entry !== trimmed)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([trimmed, ...existing].slice(0, MAX_SUGGESTIONS)))
}

export function mergeAccountManagerSuggestions(additional: string[] = []): string[] {
  const recent = readAccountManagerSuggestions()
  const seen = new Set<string>()
  const merged: string[] = []

  for (const name of [...recent, ...additional.map(normalizeAccountManager)]) {
    if (!name || seen.has(name)) continue
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
