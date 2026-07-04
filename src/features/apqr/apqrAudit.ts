import { useEffect } from 'react'

import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export interface ApqrAuditEvent {
  id: string
  entity_type: string
  entity_id: string
  entity_label: string | null
  field_name: string | null
  old_value: string | null
  new_value: string | null
  action_type: string
  description: string
  reason: string | null
  performed_by: string | null
  performed_by_name: string
  performed_at: string
}

export interface ApqrActor {
  id?: string
  name: string
  email: string
}

let actor: ApqrActor = { name: 'System', email: 'system@local' }
const events: ApqrAuditEvent[] = []

export function setApqrActor(next: ApqrActor) {
  actor = next
}

export function useApqrActorSync() {
  const { user } = useAuth()
  useEffect(() => {
    if (user) {
      setApqrActor({ id: user.profileId ?? user.id, name: user.name, email: user.email })
    } else {
      setApqrActor({ name: 'System', email: 'system@local' })
    }
  }, [user])
}

function displayValue(value: unknown): string {
  if (value == null || value === '') return '(empty)'
  return String(value)
}

export function buildFieldDescription(
  action: 'created' | 'updated' | 'archived' | 'removed',
  entityLabel: string,
  fieldLabel: string,
  oldValue: unknown,
  newValue: unknown,
): string {
  if (action === 'created') {
    return `${actor.name} created ${entityLabel} and set ${fieldLabel} to ${displayValue(newValue)}.`
  }
  if (action === 'archived') {
    return `${actor.name} archived ${entityLabel}. Reason: ${displayValue(newValue)}.`
  }
  if (action === 'removed') {
    return `${actor.name} removed unsaved ${entityLabel} from the scheduler form.`
  }
  return `${actor.name} changed ${fieldLabel} on ${entityLabel} from ${displayValue(oldValue)} to ${displayValue(newValue)}.`
}

let auditSeq = 0

export async function logApqrAudit(input: {
  entity_type: string
  entity_id: string
  entity_label?: string
  field_name?: string | null
  old_value?: string | null
  new_value?: string | null
  action_type: string
  description: string
  reason?: string | null
}): Promise<ApqrAuditEvent> {
  auditSeq += 1
  const entry: ApqrAuditEvent = {
    id: `apqr-audit-${String(auditSeq).padStart(6, '0')}`,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    entity_label: input.entity_label ?? null,
    field_name: input.field_name ?? null,
    old_value: input.old_value ?? null,
    new_value: input.new_value ?? null,
    action_type: input.action_type,
    description: input.description,
    reason: input.reason ?? null,
    performed_by: actor.id ?? null,
    performed_by_name: actor.name,
    performed_at: new Date().toISOString(),
  }
  events.unshift(entry)

  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient()
    if (sb) {
      await sb.from('apqr_audit_events').insert({
        id: entry.id,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        entity_label: entry.entity_label,
        field_name: entry.field_name,
        old_value: entry.old_value,
        new_value: entry.new_value,
        action_type: entry.action_type,
        description: entry.description,
        reason: entry.reason,
        performed_by: entry.performed_by,
        performed_by_name: entry.performed_by_name,
        performed_at: entry.performed_at,
      })
    }
  }

  return entry
}

export async function auditFieldChanges<T extends object>(
  entityType: string,
  entityId: string,
  entityLabel: string,
  previous: T,
  next: T,
  fields: Array<{ key: keyof T; label: string }>,
  actionType = 'updated',
) {
  for (const field of fields) {
    const oldVal = previous[field.key]
    const newVal = next[field.key]
    if (oldVal === newVal) continue
    await logApqrAudit({
      entity_type: entityType,
      entity_id: entityId,
      entity_label: entityLabel,
      field_name: String(field.key),
      old_value: displayValue(oldVal),
      new_value: displayValue(newVal),
      action_type: actionType,
      description: buildFieldDescription('updated', entityLabel, field.label, oldVal, newVal),
    })
  }
}

export async function listApqrAuditEvents(): Promise<ApqrAuditEvent[]> {
  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient()
    if (sb) {
      const { data, error } = await sb
        .from('apqr_audit_events')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(500)
      if (!error && data?.length) return data as ApqrAuditEvent[]
    }
  }
  return [...events]
}

export function formatAuditTimestamp(iso: string): string {
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
