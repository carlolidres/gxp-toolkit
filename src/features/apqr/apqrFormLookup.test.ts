import { describe, expect, it } from 'vitest'

import {
  activeRowsForProductCode,
  clientUpdatesForProductCycles,
  currentCycleProductRows,
  departmentUpdatesForProductCycles,
  filterCycleProductRows,
  normalizeApqrProductIdentity,
  type ProductCycleIdentity,
} from './apqrFormLookup'

describe('activeRowsForProductCode', () => {
  const rows = [
    {
      apqr_id: 'old1',
      product_code: 'actq',
      record_status: 'active',
      review_coverage_start: '2024-01-01',
      updated_at: '2024-06-01T00:00:00Z',
    },
    {
      apqr_id: 'new1',
      product_code: 'ACTQ',
      record_status: 'active',
      review_coverage_start: '2025-01-01',
      updated_at: '2025-06-01T00:00:00Z',
    },
    {
      apqr_id: 'arch',
      product_code: 'ACTQ',
      record_status: 'archived',
      review_coverage_start: '2026-01-01',
      updated_at: '2026-06-01T00:00:00Z',
    },
    {
      apqr_id: 'other',
      product_code: 'ABES',
      record_status: 'active',
      review_coverage_start: '2025-01-01',
      updated_at: '2025-06-01T00:00:00Z',
    },
  ]

  it('returns the latest active review for the product code', () => {
    expect(activeRowsForProductCode(rows, ' actq ').map((row) => row.apqr_id)).toEqual(['new1', 'old1'])
  })

  it('returns nothing for a blank or unknown code', () => {
    expect(activeRowsForProductCode(rows, '   ')).toEqual([])
    expect(activeRowsForProductCode(rows, 'ZZZZ')).toEqual([])
  })
})

describe('product identity across cycles', () => {
  const cycles: ProductCycleIdentity[] = [
    { apqrId: '2026', department: 'Liquids', updatedAt: '2028-02-01T00:00:00Z', clientId: 'zuellig' },
    { apqrId: '2025', department: null, updatedAt: '2025-02-01T00:00:00Z', clientId: 'other' },
    { apqrId: '2027', department: 'Dry', updatedAt: '2027-02-01T00:00:00Z', clientId: 'zuellig' },
  ]

  it('copies a saved department onto every cycle and leaves a blank year filled from the latest one', () => {
    expect(departmentUpdatesForProductCycles(cycles, '2026', 'Liquids').map((item) => item.apqrId)).toEqual(['2025', '2027'])
    expect(departmentUpdatesForProductCycles(cycles, '2025')).toEqual([{ apqrId: '2025', department: 'Liquids' }])
    expect(clientUpdatesForProductCycles(cycles, '2026')).toEqual(['2025'])
  })

  it('clears department on every cycle when the saved value is empty', () => {
    expect(departmentUpdatesForProductCycles(cycles, '2026', null).map((item) => item.apqrId)).toEqual(['2026', '2027'])
  })
})

describe('current cycle product codes', () => {
  const rows = [
    row('TCN', '2026-03-01', 'active'),
    row('ABES', '2026-06-01', 'active'),
    row('OLD', '2025-06-01', 'active'),
    row('ARCH', '2026-04-01', 'archived'),
    row('actq', '2026-01-15', 'active'),
  ]

  it('lists only active product codes in the commitment year', () => {
    expect(currentCycleProductRows(rows, 2026).map((item) => item.product_code)).toEqual(['ABES', 'actq', 'TCN'])
  })

  it('filters the open list from the typed text', () => {
    const cycle = currentCycleProductRows(rows, 2026)
    expect(filterCycleProductRows(cycle, '').map((item) => item.product_code)).toEqual(['ABES', 'actq', 'TCN'])
    expect(filterCycleProductRows(cycle, 'tc').map((item) => item.product_code)).toEqual(['TCN'])
    expect(filterCycleProductRows(cycle, 'blender').map((item) => item.product_code)).toEqual(['ABES'])
  })
})

describe('normalizeApqrProductIdentity', () => {
  it('trims the name and keeps the same code', () => {
    expect(normalizeApqrProductIdentity('abes', '  Propan TLC Drops  ', 'abes', ['ABES', 'ACTQ'])).toEqual({
      product_name: 'Propan TLC Drops',
      product_code: 'ABES',
    })
  })

  it('rejects a blank name and a code that belongs to another product', () => {
    expect(() => normalizeApqrProductIdentity('ABES', '   ', 'ABES', ['ABES'])).toThrow(/Product name/)
    expect(() => normalizeApqrProductIdentity('ABES', 'Propan TLC Drops', 'actq', ['ABES', 'ACTQ'])).toThrow(/already used/)
  })
})

function row(productCode: string, commitment: string, status: string) {
  return {
    apqr_id: productCode,
    product_code: productCode,
    product_name: productCode === 'ABES' ? 'Blender' : productCode,
    client_name: 'Client',
    record_status: status,
    commitment_schedule: commitment,
  }
}
