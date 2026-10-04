import type { ApqrDatabaseRow } from '../apqr/types'

export type ApqrCatalogProduct = {
  product_code: string
  product_name: string
  client_name: string
  department: string | null
  apqr_id: string
}

export function uniqueApqrProducts(rows: ApqrDatabaseRow[]): ApqrCatalogProduct[] {
  const ranked = [...rows].sort((left, right) => {
    const leftActive = left.record_status === 'archived' ? 1 : 0
    const rightActive = right.record_status === 'archived' ? 1 : 0
    if (leftActive !== rightActive) return leftActive - rightActive
    return right.updated_at.localeCompare(left.updated_at)
  })

  const seen = new Map<string, ApqrCatalogProduct>()
  for (const row of ranked) {
    const product_code = row.product_code.trim().toUpperCase()
    if (!product_code) continue
    const department = row.department?.trim() || null
    const existing = seen.get(product_code)
    if (existing) {
      if (!existing.department && department) existing.department = department
      continue
    }
    seen.set(product_code, {
      product_code,
      product_name: row.product_name.trim(),
      client_name: row.client_name.trim(),
      department,
      apqr_id: row.apqr_id,
    })
  }
  return [...seen.values()].sort((left, right) => left.product_code.localeCompare(right.product_code))
}
