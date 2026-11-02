import type { EquipmentRecord } from './equipmentMasterlist'

const STORAGE_KEY = 'gxp.vmp.equipment-audit.v1'
const MAX_EVENTS = 500

export type EquipmentAuditEvent = {
  id: string
  entity_label: string
  field_name: string
  old_value: string | null
  new_value: string | null
  action_type: 'created' | 'updated' | 'deleted'
  description: string
  reason: string | null
  performed_by: string
  performed_by_name: string
  performed_at: string
}

type Actor = { id: string; name: string }

const FIELD_LABELS: Array<[keyof EquipmentRecord, string]> = [
  ['department', 'Department'],
  ['equipment', 'Equipment'],
  ['ilTag', 'IL Tag No.'],
  ['section', 'Section'],
  ['protocol', 'Protocol Tracer No.'],
  ['report', 'Report Tracer No.'],
  ['approval', 'Report Approval Date'],
  ['nextReview', 'Next Review Date'],
]

let actor: Actor = { id: 'unknown', name: 'Unknown user' }

export function setEquipmentAuditActor(next: Actor): void {
  actor = { id: next.id || 'unknown', name: next.name || 'Unknown user' }
}

export function listEquipmentAuditEvents(): EquipmentAuditEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) as EquipmentAuditEvent[] : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function logEquipmentRecord(before: EquipmentRecord | null, after: EquipmentRecord): void {
  const label = `${after.equipment} (${after.ilTag})`
  const creating = !before?.sourceNo
  for (const [key, name] of FIELD_LABELS) {
    const previous = before?.[key]?.trim() ?? ''
    const next = String(after[key] ?? '').trim()
    if (creating) {
      if (!next) continue
      append({
        entity_label: label,
        field_name: name,
        old_value: null,
        new_value: next,
        action_type: 'created',
        description: `${actor.name} registered ${label} and set ${name} to ${next}.`,
        reason: null,
      })
    } else if (previous !== next) {
      append({
        entity_label: label,
        field_name: name,
        old_value: previous || '(empty)',
        new_value: next || '(empty)',
        action_type: 'updated',
        description: `${actor.name} changed ${name} on ${label} from ${previous || '(empty)'} to ${next || '(empty)'}.`,
        reason: null,
      })
    }
  }
}

export function logEquipmentDeletion(record: EquipmentRecord, reason: string): void {
  const label = `${record.equipment} (${record.ilTag})`
  const note = reason.trim()
  append({
    entity_label: label,
    field_name: 'Record',
    old_value: `${record.department} / ${label}`,
    new_value: '(deleted)',
    action_type: 'deleted',
    description: `${actor.name} deleted ${label} from ${record.department}. Reason: ${note}.`,
    reason: note,
  })
}

export function logEquipmentCell(range: string | null, oldValue: string | null, newValue: string | null): void {
  if ((oldValue ?? '') === (newValue ?? '')) return
  append({
    entity_label: range ?? 'Equipment masterlist',
    field_name: range ?? 'Cell',
    old_value: oldValue || '(empty)',
    new_value: newValue || '(empty)',
    action_type: 'updated',
    description: `${actor.name} changed ${range ?? 'a cell'} from ${oldValue || '(empty)'} to ${newValue || '(empty)'}.`,
    reason: null,
  })
}

export function logEquipmentReportField(label: string, field: string, oldValue: string, newValue: string, action: 'created' | 'updated' | 'deleted' = 'updated'): void {
  if (oldValue === newValue) return
  append({
    entity_label: label,
    field_name: field,
    old_value: oldValue || null,
    new_value: newValue || null,
    action_type: action,
    description: action === 'deleted'
      ? `${actor.name} removed ${field} on ${label}. Previous value: ${oldValue || '(empty)'}.`
      : `${actor.name} ${action === 'created' ? 'set' : 'changed'} ${field} on ${label}${action === 'created' ? '' : ` from ${oldValue || '(empty)'}`} to ${newValue || '(empty)'}.`,
    reason: null,
  })
}

export function formatEquipmentAuditTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(new Date(iso))
}

function append(event: Omit<EquipmentAuditEvent, 'id' | 'performed_by' | 'performed_by_name' | 'performed_at'>): void {
  const events = listEquipmentAuditEvents()
  events.unshift({
    ...event,
    id: crypto.randomUUID(),
    performed_by: actor.id,
    performed_by_name: actor.name,
    performed_at: new Date().toISOString(),
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)))
}
