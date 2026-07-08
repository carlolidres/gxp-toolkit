import { VMP_OTHER_OPTION } from '../data/vmpFieldOptionDefaults'

const STORAGE_KEY = 'vmp-group-subcategory-suggestions'
const MAX_SUGGESTIONS_PER_SCOPE = 50

export type GroupSuggestionScope = {
  validationArea: string
  department?: string
}

export function normalizeGroupSubcategory(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function buildGroupSuggestionScopeKey(scope: GroupSuggestionScope): string {
  const area = scope.validationArea.trim()
  if (area === 'Equipment') {
    const department = normalizeGroupSubcategory(scope.department ?? '')
    return department ? `${area}::${department}` : area
  }
  return area
}

function readAllScopes(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([key, values]) => [
          key,
          Array.isArray(values)
            ? values
                .filter((value): value is string => typeof value === 'string')
                .map(normalizeGroupSubcategory)
                .filter((value) => value && value !== VMP_OTHER_OPTION)
            : [],
        ])
        .filter(([, values]) => values.length > 0),
    )
  } catch {
    return {}
  }
}

function writeScope(scopeKey: string, values: string[]): void {
  const all = readAllScopes()
  if (values.length === 0) {
    delete all[scopeKey]
  } else {
    all[scopeKey] = values.slice(0, MAX_SUGGESTIONS_PER_SCOPE)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function readGroupSubcategorySuggestions(scope: GroupSuggestionScope): string[] {
  return readAllScopes()[buildGroupSuggestionScopeKey(scope)] ?? []
}

export function rememberGroupSubcategory(scope: GroupSuggestionScope, value: string): void {
  const trimmed = normalizeGroupSubcategory(value)
  if (!trimmed || trimmed === VMP_OTHER_OPTION) return
  const scopeKey = buildGroupSuggestionScopeKey(scope)
  const existing = readGroupSubcategorySuggestions(scope).filter((entry) => entry !== trimmed)
  writeScope(scopeKey, [trimmed, ...existing])
}

export function forgetGroupSubcategory(scope: GroupSuggestionScope, value: string): void {
  const trimmed = normalizeGroupSubcategory(value)
  if (!trimmed) return
  const scopeKey = buildGroupSuggestionScopeKey(scope)
  const next = readGroupSubcategorySuggestions(scope).filter((entry) => entry !== trimmed)
  writeScope(scopeKey, next)
}

export function mergeGroupSubcategorySuggestions(
  scope: GroupSuggestionScope,
  builtIn: readonly string[] = [],
  additional: string[] = [],
): string[] {
  const recent = readGroupSubcategorySuggestions(scope)
  const seen = new Set<string>()
  const merged: string[] = []

  const candidates = [
    ...recent,
    ...builtIn
      .map(normalizeGroupSubcategory)
      .filter((value) => value && value !== VMP_OTHER_OPTION),
    ...additional.map(normalizeGroupSubcategory).filter((value) => value && value !== VMP_OTHER_OPTION),
  ]

  for (const value of candidates) {
    if (seen.has(value)) continue
    seen.add(value)
    merged.push(value)
  }

  const recentRank = new Map(recent.map((value, index) => [value, index]))
  return merged.sort((a, b) => {
    const aRank = recentRank.get(a)
    const bRank = recentRank.get(b)
    if (aRank != null && bRank != null) return aRank - bRank
    if (aRank != null) return -1
    if (bRank != null) return 1
    return a.localeCompare(b)
  })
}
