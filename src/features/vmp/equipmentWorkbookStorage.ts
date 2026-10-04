import {
  createWorkbook,
  normalizeWorkbook,
  type EquipmentAuditEvent,
  type EquipmentWorkbook,
} from './equipmentWorkbook'

const STORAGE_KEY = 'gxp.vmp.equipment-profile.v1'

export type StoredEquipmentWorkbook = {
  workbook: EquipmentWorkbook
  audit: EquipmentAuditEvent[]
  recovered: boolean
}

export function loadEquipmentWorkbook(): StoredEquipmentWorkbook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { workbook: createWorkbook(), audit: [], recovered: false }
    const parsed = JSON.parse(raw) as { workbook?: unknown; audit?: EquipmentAuditEvent[] }
    const workbook = normalizeWorkbook(parsed.workbook)
    if (!workbook) return { workbook: createWorkbook(), audit: [], recovered: true }
    return {
      workbook,
      audit: Array.isArray(parsed.audit) ? parsed.audit.slice(-500) : [],
      recovered: false,
    }
  } catch {
    return { workbook: createWorkbook(), audit: [], recovered: true }
  }
}

export function saveEquipmentWorkbook(stored: Omit<StoredEquipmentWorkbook, 'recovered'>): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ workbook: stored.workbook, audit: stored.audit.slice(-500) }),
  )
}
