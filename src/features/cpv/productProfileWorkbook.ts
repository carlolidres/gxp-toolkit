import { createWorkbook, normalizeWorkbook, type EquipmentWorkbook } from '../vmp/equipmentWorkbook'
import { fixtureWorkbook, SPREADSHEET_FIXTURE_CODE, spreadsheetFixtureEnabled } from './spreadsheetTestFixture'

const STORAGE_KEY = 'gxp.cpv.product-profile.v1'

let held: { key: string; workbook: EquipmentWorkbook } | null = null

function readAll(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function storageKey(productId: string, section: string): string {
  return `${productId}:${section}`
}

export function productSectionHeld(productId: string, section: string): boolean {
  return held?.key === storageKey(productId, section)
}

function requestedFixtureSize(): 'small' | 'medium' | 'large' {
  if (typeof window === 'undefined') return 'small'
  const size = new URLSearchParams(window.location.search).get('sheetSize')
  if (size === 'medium' || size === 'large') return size
  return 'small'
}

export function loadProductSectionWorkbook(productId: string, section: string): EquipmentWorkbook {
  const key = storageKey(productId, section)
  if (held?.key === key) return held.workbook
  const workbook = normalizeWorkbook(readAll()[key])
  if (workbook) return workbook
  if (spreadsheetFixtureEnabled() && productId.trim().toUpperCase() === SPREADSHEET_FIXTURE_CODE) return fixtureWorkbook(requestedFixtureSize())
  return createWorkbook()
}

export function saveProductSectionWorkbook(productId: string, section: string, workbook: EquipmentWorkbook): void {
  const key = storageKey(productId, section)
  const all = readAll()
  all[key] = workbook
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch (error) {
    held = { key, workbook }
    throw error
  }
  if (held?.key === key) held = null
}
