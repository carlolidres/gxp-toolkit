import type { CpvBatchInput } from './types'

function toTime(value: string | null | undefined): number | null {
  if (!value?.trim()) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

export function chronologyIssues(input: CpvBatchInput): string[] {
  const issues: string[] = []
  const mStart = toTime(input.manufacturing_start_at)
  const mEnd = toTime(input.manufacturing_end_at)
  const pStart = toTime(input.packaging_start_at)
  const pEnd = toTime(input.packaging_end_at)
  const fg = toTime(input.fg_release_date)

  if (mStart != null && mEnd != null && mStart > mEnd) {
    issues.push('Manufacturing start must be before manufacturing end.')
  }
  if (pStart != null && pEnd != null && pStart > pEnd) {
    issues.push('Packaging start must be before packaging end.')
  }
  if (mEnd != null && pStart != null && mEnd > pStart) {
    issues.push('Manufacturing end must be before packaging start.')
  }
  if (pEnd != null && fg != null && pEnd > fg) {
    issues.push('Packaging end must be before FG release date.')
  }
  return issues
}

export function requireDateException(input: CpvBatchInput): void {
  const issues = chronologyIssues(input)
  if (issues.length === 0) return
  if (!input.date_exception_reason?.trim()) {
    throw new Error(`${issues.join(' ')} Record an auditable date exception reason to continue.`)
  }
}

export function calculateProposedPosture(batchCount: number, hasApprovedAssessment: boolean): 'Not Assessed' | 'Insufficient Data' {
  if (!hasApprovedAssessment && batchCount === 0) return 'Not Assessed'
  if (batchCount < 3) return 'Insufficient Data'
  return 'Not Assessed'
}

export function nextReviewDue(effectiveDate: string | null | undefined, frequency: string): string | null {
  if (!effectiveDate?.trim()) return null
  const start = new Date(`${effectiveDate.trim()}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return null
  const months = frequency === 'Monthly' ? 1 : frequency === 'Quarterly' ? 3 : frequency === 'Semiannual' ? 6 : 12
  start.setUTCMonth(start.getUTCMonth() + months)
  return start.toISOString().slice(0, 10)
}

export function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed : null
}

export function normalizeCode(value: string): string {
  return value.trim()
}

export function parseOptionalNumber(value: string | null | undefined): number | null {
  if (value == null || !value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function evaluateTestResult(input: {
  dataType: string
  result: string | null | undefined
  lsl?: string | null
  usl?: string | null
  warningLow?: string | null
  warningHigh?: string | null
  notApplicable?: boolean
  naJustification?: string | null
  officialEvent?: 'OOS' | 'OOT' | null
  investigationLink?: string | null
}): 'Pass' | 'Fail' | 'Warning' | 'OOS' | 'OOT' | 'Not Evaluated' {
  if (input.notApplicable) {
    if (!input.naJustification?.trim()) throw new Error('Not Applicable requires a justification.')
    return 'Not Evaluated'
  }
  if (input.officialEvent) {
    if (!input.investigationLink?.trim()) {
      throw new Error(`Official ${input.officialEvent} requires an investigation link.`)
    }
    return input.officialEvent
  }

  const raw = input.result?.trim() ?? ''
  if (!raw) return 'Not Evaluated'

  if (input.dataType === 'Pass-Fail') {
    const value = raw.toLowerCase()
    if (value === 'pass') return 'Pass'
    if (value === 'fail') return 'Fail'
    return 'Not Evaluated'
  }
  if (input.dataType === 'Text' || input.dataType === 'Categorical') {
    return 'Pass'
  }

  const number = parseOptionalNumber(raw)
  if (number == null) return 'Not Evaluated'
  const lsl = parseOptionalNumber(input.lsl)
  const usl = parseOptionalNumber(input.usl)
  if (lsl != null && number < lsl) return 'Fail'
  if (usl != null && number > usl) return 'Fail'
  const warnLow = parseOptionalNumber(input.warningLow)
  const warnHigh = parseOptionalNumber(input.warningHigh)
  if (warnLow != null && number < warnLow) return 'Warning'
  if (warnHigh != null && number > warnHigh) return 'Warning'
  return 'Pass'
}

export function evaluateAssetWindow(usedAt: string | null | undefined, due: string | null | undefined): 'Current' | 'Due Soon' | 'Due' | 'Overdue' | 'Not Evaluated' {
  if (!usedAt?.trim()) return 'Not Evaluated'
  if (!due?.trim()) return 'Current'
  const used = usedAt.slice(0, 10)
  const dueDate = due.slice(0, 10)
  if (used > dueDate) return 'Overdue'
  if (used === dueDate) return 'Due'
  const usedMs = Date.parse(`${used}T00:00:00.000Z`)
  const dueMs = Date.parse(`${dueDate}T00:00:00.000Z`)
  if (Number.isNaN(usedMs) || Number.isNaN(dueMs)) return 'Not Evaluated'
  const days = (dueMs - usedMs) / 86400000
  return days <= 30 ? 'Due Soon' : 'Current'
}

export function holdTimeDurationHours(startAt: string, endAt: string): number | null {
  const start = Date.parse(startAt)
  const end = Date.parse(endAt)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  return (end - start) / 3600000
}

export function evaluateHoldTime(durationHours: number | null, maxDuration: string, unit: string, minDuration?: string | null): 'Complies' | 'Excursion' | 'Not Evaluated' {
  if (durationHours == null) return 'Not Evaluated'
  const toHours = (value: string | null | undefined) => {
    const amount = parseOptionalNumber(value)
    if (amount == null) return null
    if (unit === 'minutes') return amount / 60
    if (unit === 'days') return amount * 24
    return amount
  }
  const maxHours = toHours(maxDuration)
  const minHours = toHours(minDuration)
  if (maxHours == null) return 'Not Evaluated'
  if (durationHours > maxHours) return 'Excursion'
  if (minHours != null && durationHours < minHours) return 'Excursion'
  return 'Complies'
}

export function stabilityPointStatus(dueDate: string | null | undefined, result: string | null | undefined, today = new Date().toISOString().slice(0, 10)): 'Scheduled' | 'Due' | 'Completed' | 'Missed' {
  if (result?.trim()) return 'Completed'
  if (!dueDate?.trim()) return 'Scheduled'
  if (dueDate < today) return 'Missed'
  if (dueDate === today) return 'Due'
  return 'Scheduled'
}
