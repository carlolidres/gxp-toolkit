const STORAGE_KEY = 'apqr-report-status-suggestions'
const MAX_SUGGESTIONS = 50

function normalizeStatus(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function readReportStatusSuggestions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map(normalizeStatus)
      .filter(Boolean)
  } catch {
    return []
  }
}

export function rememberReportStatus(value: string): void {
  const trimmed = normalizeStatus(value)
  if (!trimmed) return
  const existing = readReportStatusSuggestions().filter((entry) => entry !== trimmed)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([trimmed, ...existing].slice(0, MAX_SUGGESTIONS)))
}

export function mergeReportStatusSuggestions(additional: string[] = []): string[] {
  const recent = readReportStatusSuggestions()
  const seen = new Set<string>()
  const merged: string[] = []

  for (const status of [...recent, ...additional.map(normalizeStatus)]) {
    if (!status || seen.has(status)) continue
    seen.add(status)
    merged.push(status)
  }

  const recentRank = new Map(recent.map((status, index) => [status, index]))
  return merged.sort((a, b) => {
    const aRank = recentRank.get(a)
    const bRank = recentRank.get(b)
    if (aRank != null && bRank != null) return aRank - bRank
    if (aRank != null) return -1
    if (bRank != null) return 1
    return a.localeCompare(b)
  })
}
