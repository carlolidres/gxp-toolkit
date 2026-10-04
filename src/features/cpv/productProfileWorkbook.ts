import { createWorkbook, normalizeWorkbook, type EquipmentWorkbook } from '../vmp/equipmentWorkbook'

const STORAGE_KEY = 'gxp.cpv.product-profile.v1'

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

export function loadProductSectionWorkbook(productId: string, section: string): EquipmentWorkbook {
  const workbook = normalizeWorkbook(readAll()[storageKey(productId, section)])
  return workbook ?? createWorkbook()
}

export function saveProductSectionWorkbook(productId: string, section: string, workbook: EquipmentWorkbook): void {
  const all = readAll()
  all[storageKey(productId, section)] = workbook
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}
