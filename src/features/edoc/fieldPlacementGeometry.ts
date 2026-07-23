import type { EdocFieldDraft } from './types'

export function clampNormalized(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function normalizeRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0
  const wrapped = ((degrees % 360) + 360) % 360
  return Math.round(wrapped * 10) / 10
}

export function clampFieldToPage(field: Pick<EdocFieldDraft, 'x' | 'y' | 'width' | 'height'>): {
  x: number
  y: number
  width: number
  height: number
} {
  const width = clampNormalized(field.width, 0.03, 0.95)
  const height = clampNormalized(field.height, 0.03, 0.95)
  return {
    width,
    height,
    x: clampNormalized(field.x, 0, 1 - width),
    y: clampNormalized(field.y, 0, 1 - height),
  }
}

export function fieldsOverlap(
  a: Pick<EdocFieldDraft, 'pageNumber' | 'x' | 'y' | 'width' | 'height'>,
  b: Pick<EdocFieldDraft, 'pageNumber' | 'x' | 'y' | 'width' | 'height'>,
  padding = 0.004,
): boolean {
  if (a.pageNumber !== b.pageNumber) return false
  return !(
    a.x + a.width + padding <= b.x
    || b.x + b.width + padding <= a.x
    || a.y + a.height + padding <= b.y
    || b.y + b.height + padding <= a.y
  )
}

/** Soft nudge away from overlapping siblings while remaining on-page. */
export function resolveSoftOverlap(
  field: EdocFieldDraft,
  others: readonly EdocFieldDraft[],
): EdocFieldDraft {
  let next = { ...field, ...clampFieldToPage(field) }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const collision = others.find((other) => other.id !== next.id && fieldsOverlap(next, other))
    if (!collision) return next
    next = {
      ...next,
      ...clampFieldToPage({
        ...next,
        x: next.x + 0.02,
        y: next.y + 0.02,
      }),
    }
  }
  return next
}

export const SIGNATORY_COLOR_PALETTE = [
  { fill: 'rgba(14, 116, 144, 0.18)', stroke: '#0e7490', text: '#0f4c5c' },
  { fill: 'rgba(180, 83, 9, 0.18)', stroke: '#b45309', text: '#7c2d12' },
  { fill: 'rgba(126, 34, 206, 0.16)', stroke: '#7e22ce', text: '#581c87' },
  { fill: 'rgba(22, 163, 74, 0.16)', stroke: '#16a34a', text: '#14532d' },
  { fill: 'rgba(219, 39, 119, 0.16)', stroke: '#db2777', text: '#9d174d' },
  { fill: 'rgba(37, 99, 235, 0.16)', stroke: '#2563eb', text: '#1e3a8a' },
] as const

export function signatoryColorForIndex(index: number) {
  return SIGNATORY_COLOR_PALETTE[Math.abs(index) % SIGNATORY_COLOR_PALETTE.length]!
}

export function parseAssigneeIdFromDraftId(assigneeDraftId: string): string | null {
  const separator = assigneeDraftId.lastIndexOf(':')
  if (separator < 0) return null
  const assigneeId = assigneeDraftId.slice(separator + 1).trim()
  return assigneeId || null
}

export function pushHistory<T>(past: T[], present: T, limit = 40): {
  past: T[]
  present: T
  future: T[]
} {
  return {
    past: [...past, present].slice(-limit),
    present,
    future: [],
  }
}

export function undoHistory<T>(past: T[], present: T, future: T[]): {
  past: T[]
  present: T
  future: T[]
} | null {
  if (past.length === 0) return null
  const previous = past[past.length - 1]!
  return {
    past: past.slice(0, -1),
    present: previous,
    future: [present, ...future],
  }
}

export function redoHistory<T>(past: T[], present: T, future: T[]): {
  past: T[]
  present: T
  future: T[]
} | null {
  if (future.length === 0) return null
  const next = future[0]!
  return {
    past: [...past, present],
    present: next,
    future: future.slice(1),
  }
}
