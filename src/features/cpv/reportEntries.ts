import type { CpvReportEntry } from './types'
import { parseAppDate } from '../../utils/dateUtils'

export type { CpvReportEntry }

export function normalizeReportEntries(
  rows: Array<{ tracer_no: string; issued_date: string; remarks: string }>,
): CpvReportEntry[] {
  const cleaned = rows.flatMap((row, index) => {
    const tracer_no = row.tracer_no.trim()
    const issued_date = row.issued_date.trim()
    const remarks = row.remarks.trim()
    if (!tracer_no && !issued_date && !remarks) return []
    if (!tracer_no) throw new Error('Report Tracer No. is required.')
    const issued = parseAppDate(issued_date)
    if (!issued) throw new Error('Issued Date must use dd Mmm YYYY.')
    return [{ tracer_no, issued_date: issued, remarks, index }]
  })
  return cleaned
    .sort((left, right) => right.issued_date.localeCompare(left.issued_date) || right.index - left.index)
    .map(({ tracer_no, issued_date, remarks }) => ({ tracer_no, issued_date, remarks }))
}

export function arrangeReportRows<T extends { issued_date: string }>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index, iso: parseAppDate(row.issued_date) }))
    .sort((left, right) => {
      if (left.iso && right.iso) return right.iso.localeCompare(left.iso) || right.index - left.index
      if (left.iso) return -1
      if (right.iso) return 1
      return left.index - right.index
    })
    .map(({ row }) => row)
}

export function latestReportEntry(entries: CpvReportEntry[] | undefined): CpvReportEntry | null {
  const rows = [...(entries ?? [])]
    .filter((entry) => entry.tracer_no.trim() && /^\d{4}-\d{2}-\d{2}$/.test(entry.issued_date))
    .sort((left, right) => right.issued_date.localeCompare(left.issued_date))
  return rows[0] ?? null
}
