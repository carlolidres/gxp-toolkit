import type { CpvActor, CpvAuditEvent, CpvAuditFilter } from './types'

export function createCpvId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`
  return `cpv-${prefix}-${uuid}`
}

export function nowUtcIso(): string {
  return new Date().toISOString()
}

const events: CpvAuditEvent[] = []
let actor: CpvActor = { id: 'system', name: 'System', email: 'system@local', role: 'Viewer' }

export function setCpvActor(next: CpvActor) {
  actor = next
}

export function getCpvActor(): CpvActor {
  return actor
}

export function resetCpvAuditForTests() {
  events.length = 0
}

function displayValue(value: unknown): string {
  if (value == null || value === '') return '(empty)'
  return String(value)
}

export function appendCpvAudit(entry: {
  action_type: string
  record_type: string
  record_id: string
  product_id?: string | null
  batch_id?: string | null
  module?: string | null
  record_label?: string | null
  field_name?: string | null
  old_value?: string | null
  new_value?: string | null
  reason?: string | null
  source_record_id?: string | null
  correlation_id?: string | null
  occurred_at?: string
  actor?: CpvActor
}): CpvAuditEvent {
  const who = entry.actor ?? actor
  const event: CpvAuditEvent = {
    id: createCpvId('audit'),
    occurred_at: entry.occurred_at ?? nowUtcIso(),
    actor_id: who.id,
    actor_name: who.name,
    actor_role: who.role,
    action_type: entry.action_type,
    product_id: entry.product_id ?? null,
    batch_id: entry.batch_id ?? null,
    module: entry.module ?? null,
    record_type: entry.record_type,
    record_id: entry.record_id,
    record_label: entry.record_label ?? null,
    field_name: entry.field_name ?? null,
    old_value: entry.old_value ?? null,
    new_value: entry.new_value ?? null,
    reason: entry.reason ?? null,
    source_record_id: entry.source_record_id ?? null,
    correlation_id: entry.correlation_id ?? null,
  }
  events.push(event)
  return event
}

export function auditFieldChanges(
  recordType: string,
  recordId: string,
  recordLabel: string,
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  fields: Array<{ key: string; label: string }>,
  extra?: { productId?: string; batchId?: string; module?: string; reason?: string },
) {
  for (const field of fields) {
    const oldValue = displayValue(previous[field.key])
    const newValue = displayValue(next[field.key])
    if (oldValue === newValue) continue
    appendCpvAudit({
      action_type: 'edit',
      product_id: extra?.productId ?? null,
      batch_id: extra?.batchId ?? null,
      module: extra?.module ?? recordType,
      record_type: recordType,
      record_id: recordId,
      record_label: recordLabel,
      field_name: field.label,
      old_value: oldValue,
      new_value: newValue,
      reason: extra?.reason ?? null,
    })
  }
}

export function listCpvAuditEvents(filter: CpvAuditFilter = {}): CpvAuditEvent[] {
  return events
    .filter((event) => {
      if (filter.from && event.occurred_at < filter.from) return false
      if (filter.to && event.occurred_at > filter.to) return false
      if (filter.user && !event.actor_name.toLowerCase().includes(filter.user.toLowerCase())) return false
      if (filter.productId && event.product_id !== filter.productId) return false
      if (filter.batchId && event.batch_id !== filter.batchId) return false
      if (filter.module && (event.module ?? '') !== filter.module) return false
      if (filter.recordType && event.record_type !== filter.recordType) return false
      if (filter.recordId && event.record_id !== filter.recordId) return false
      if (filter.actionType && event.action_type !== filter.actionType) return false
      if (filter.fieldName && !(event.field_name ?? '').toLowerCase().includes(filter.fieldName.toLowerCase())) {
        return false
      }
      if (filter.protocolOrReportNumber) {
        const needle = filter.protocolOrReportNumber.toLowerCase()
        if (!(event.record_label ?? '').toLowerCase().includes(needle)) return false
      }
      return true
    })
    .slice()
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
}
