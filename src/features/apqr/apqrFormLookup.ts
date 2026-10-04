import { apqrCycleYearFromCommitment } from './apqrDashboard'
import type { ApqrDatabaseRow } from './types'

type ProductCodeRow = Pick<
  ApqrDatabaseRow,
  'apqr_id' | 'product_code' | 'record_status' | 'review_coverage_start' | 'updated_at'
>

type CycleProductRow = Pick<
  ApqrDatabaseRow,
  'apqr_id' | 'product_code' | 'product_name' | 'client_name' | 'record_status' | 'commitment_schedule'
>

/** Active rows for one product code, latest review coverage first. */
export function activeRowsForProductCode(rows: ProductCodeRow[], productCode: string): ProductCodeRow[] {
  const code = productCode.trim().toUpperCase()
  if (!code) return []
  return rows
    .filter((row) => row.record_status === 'active' && row.product_code.trim().toUpperCase() === code)
    .sort(
      (a, b) =>
        b.review_coverage_start.localeCompare(a.review_coverage_start) ||
        b.updated_at.localeCompare(a.updated_at),
    )
}

/** Active product rows whose commitment date falls in the APQR cycle year. */
export function currentCycleProductRows<T extends CycleProductRow>(rows: T[], cycleYear: number): T[] {
  return rows
    .filter(
      (row) =>
        row.record_status === 'active' &&
        row.product_code.trim() !== '' &&
        apqrCycleYearFromCommitment(row.commitment_schedule) === cycleYear,
    )
    .sort(
      (a, b) =>
        a.product_code.localeCompare(b.product_code) ||
        a.product_name.localeCompare(b.product_name) ||
        a.client_name.localeCompare(b.client_name),
    )
}

export interface ProductCycleIdentity {
  apqrId: string
  department: string | null
  updatedAt: string
  clientId: string
}

/**
 * Department values to write onto this product's cycles.
 * An override replaces every cycle. Without one, a known department fills blanks only.
 */
export function departmentUpdatesForProductCycles(
  cycles: ProductCycleIdentity[],
  sourceApqrId: string,
  override?: string | null,
): { apqrId: string; department: string | null }[] {
  if (!cycles.some((cycle) => cycle.apqrId === sourceApqrId)) return []
  const source = cycles.find((cycle) => cycle.apqrId === sourceApqrId)!
  const chosen =
    override !== undefined
      ? override?.trim() || null
      : source.department?.trim() ||
        cycles
          .filter((cycle) => cycle.department?.trim())
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
          ?.department?.trim() ||
        null
  if (override === undefined && !chosen) return []
  return cycles
    .filter((cycle) => (cycle.department?.trim() || null) !== chosen)
    .filter((cycle) => override !== undefined || !cycle.department?.trim())
    .map((cycle) => ({ apqrId: cycle.apqrId, department: chosen }))
}

/** Other cycles of the same product whose client differs from the open cycle. */
export function clientUpdatesForProductCycles(cycles: ProductCycleIdentity[], sourceApqrId: string): string[] {
  const source = cycles.find((cycle) => cycle.apqrId === sourceApqrId)
  if (!source) return []
  return cycles
    .filter((cycle) => cycle.apqrId !== sourceApqrId && cycle.clientId !== source.clientId)
    .map((cycle) => cycle.apqrId)
}

/** Name and code written onto every cycle of one APQR product. */
export function normalizeApqrProductIdentity(
  currentCode: string,
  name: string,
  code: string,
  existingCodes: string[],
): { product_name: string; product_code: string } {
  const from = currentCode.trim().toUpperCase()
  const product_name = name.trim()
  const product_code = code.trim().toUpperCase()
  if (!from || !product_code) throw new Error('Product code is required.')
  if (!product_name) throw new Error('Product name is required.')
  const taken = existingCodes.some((item) => {
    const other = item.trim().toUpperCase()
    return other === product_code && other !== from
  })
  if (taken) throw new Error('That product code is already used.')
  return { product_name, product_code }
}

/** Case-insensitive match on product code, product name, or client. Blank query keeps the full list. */
export function filterCycleProductRows<T extends CycleProductRow>(rows: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) =>
    [row.product_code, row.product_name, row.client_name].some((value) => value.toLowerCase().includes(q)),
  )
}
