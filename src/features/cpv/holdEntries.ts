import type { CpvHoldEntry } from './types'
import { parseAppDate } from '../../utils/dateUtils'

export function normalizeHoldEntries(
  rows: Array<{ report_ref: string; issued_date?: string; hold_time: string }>,
): CpvHoldEntry[] {
  return rows.flatMap((row) => {
    const report_ref = row.report_ref.trim()
    const hold_time = row.hold_time.trim()
    const issuedText = (row.issued_date ?? '').trim()
    if (!report_ref && !hold_time && !issuedText) return []
    if (!report_ref) throw new Error('BHT-Report reference no. is required.')
    const issued_date = issuedText ? parseAppDate(issuedText) : ''
    if (issuedText && !issued_date) throw new Error('Issued Date must use dd Mmm YYYY.')
    return [{ report_ref, issued_date: issued_date ?? '', hold_time }]
  })
}
