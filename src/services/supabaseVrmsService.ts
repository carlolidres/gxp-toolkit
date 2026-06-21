import { getSupabaseClient } from '../lib/supabase'
import {
  mapAuditEventRow,
  mapRoutingDocumentRow,
  type AuditEventRow,
  type RegistryValueRow,
  type RoutingDocumentRow,
} from '../lib/vrmsMappers'
import type {
  RegistryValue,
  RoutingDocument,
  VrmsAppData,
  VrmsRegistryType,
} from '../types/vrms'
import { buildRegistriesFromValues, buildVrmsDashboard } from '../data/mockVrms'
import {
  applySaveDocument,
  applySignDocumentSignatory,
  ensureDefaultRegistryValues,
  formatVrmsDateTime,
  formatVrmsDisplayDateTime,
  isValidRegistryValue,
} from '../utils/vrmsLogic'
import type { VrmsRepository } from './vrmsRepository'

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  return client
}

function normalizeDocumentRow(row: RoutingDocumentRow & { signatories?: unknown }): RoutingDocumentRow {
  return {
    ...row,
    signatories:
      typeof row.signatories === 'string'
        ? row.signatories
        : JSON.stringify(row.signatories ?? []),
  }
}

async function loadDocuments(): Promise<RoutingDocument[]> {
  const client = requireClient()
  const { data, error } = await client.from('routing_documents').select('*').order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRoutingDocumentRow(normalizeDocumentRow(row as RoutingDocumentRow)))
}

async function loadRegistryValues(): Promise<RegistryValue[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('registry_values')
    .select('*')
    .order('registry_type', { ascending: true })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as RegistryValueRow[]
  const withDefaults = ensureDefaultRegistryValues(
    rows.map((row) => ({ registryType: row.registry_type, value: row.value })),
  )

  return withDefaults.map((row, index) => ({
    id: rows.find((candidate) => candidate.registry_type === row.registryType && candidate.value === row.value)?.id
      ?? `reg-default-${index}`,
    registryType: row.registryType as VrmsRegistryType,
    value: row.value,
  }))
}

function getAllowedSignatoryNames(registryValues: RegistryValue[]): string[] {
  return buildRegistriesFromValues(registryValues)['Sent / Routing'] ?? []
}

function getStatusRegistry(registryValues: RegistryValue[]): string[] {
  return buildRegistriesFromValues(registryValues).Status ?? []
}

function buildAppDataFrom(
  documents: RoutingDocument[],
  registryValues: RegistryValue[],
  userEmail: string,
): VrmsAppData {
  return {
    documents,
    registries: buildRegistriesFromValues(registryValues),
    dashboard: buildVrmsDashboard(documents),
    user: userEmail,
  }
}

async function persistDocument(document: RoutingDocument): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('routing_documents').upsert({
    routing_tracker: document.routingTracker,
    doc_tracer: document.docTracer,
    equipment_product: document.equipmentProduct,
    category: document.category,
    il_tag: document.ilTag || null,
    status: document.status,
    sent_routing_to: document.sentRoutingTo || null,
    email: document.email || null,
    date_sent: document.dateSent || null,
    report_protocol: document.reportProtocol,
    batch_no: document.batchNo,
    client_name: document.clientName,
    department: document.department,
    prepared_by: document.preparedBy,
    date_prepared: document.datePrepared,
    checked_by: document.checkedBy,
    date_checked: document.dateChecked,
    target_completion_date: document.targetCompletionDate || null,
    remarks: document.remarks || null,
    signatories: document.signatories,
    total_routing_duration: document.totalRoutingDuration || null,
    routing_completed_at: document.routingCompletedAt || null,
    created_at: document.createdAt,
    updated_at: document.updatedAt,
    updated_by: document.updatedBy,
  })
  if (error) throw new Error(error.message)
}

async function appendAudit(
  action: string,
  routingTracker: string,
  docTracer: string,
  details: string,
  userEmail: string,
  now = new Date(),
): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('audit_events').insert({
    id: `audit-${Date.now()}`,
    event_timestamp: formatVrmsDateTime(now),
    user_email: userEmail,
    action,
    routing_tracker: routingTracker || null,
    doc_tracer: docTracer || null,
    details,
  })
  if (error) throw new Error(error.message)
}

export const supabaseVrmsService: VrmsRepository = {
  async getAppData(userEmail) {
    const [documents, registryValues] = await Promise.all([loadDocuments(), loadRegistryValues()])
    return buildAppDataFrom(documents, registryValues, userEmail)
  },

  async getDocumentByTracker(tracker) {
    const client = requireClient()
    const { data, error } = await client
      .from('routing_documents')
      .select('*')
      .eq('routing_tracker', tracker.trim())
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error(`No document found for tracking number: ${tracker}`)
    return mapRoutingDocumentRow(normalizeDocumentRow(data as RoutingDocumentRow))
  },

  async saveDocument(payload, userEmail) {
    const [documents, registryValues] = await Promise.all([loadDocuments(), loadRegistryValues()])
    const originalTracker = String(payload.__originalTracker || payload.routingTracker || '').trim()
    const existing = originalTracker
      ? documents.find((doc) => doc.routingTracker === originalTracker)
      : undefined

    const { document, auditAction, auditDetails } = applySaveDocument(
      payload,
      existing,
      documents,
      getAllowedSignatoryNames(registryValues),
      userEmail,
    )

    await persistDocument(document)
    await appendAudit(auditAction, document.routingTracker, document.docTracer, auditDetails, userEmail)

    const nextDocuments = existing
      ? documents.map((row) => (row.routingTracker === document.routingTracker ? document : row))
      : [...documents, document]

    return buildAppDataFrom(nextDocuments, registryValues, userEmail)
  },

  async signDocumentSignatory(tracker, order, userEmail) {
    const [documents, registryValues] = await Promise.all([loadDocuments(), loadRegistryValues()])
    const existing = documents.find((doc) => doc.routingTracker.trim() === tracker.trim())
    if (!existing) throw new Error(`No document found for tracking number: ${tracker}`)

    const { document, result, auditDetails } = applySignDocumentSignatory(
      existing,
      order,
      getAllowedSignatoryNames(registryValues),
      getStatusRegistry(registryValues),
      userEmail,
    )

    await persistDocument(document)
    await appendAudit(
      'Signed routing signatory',
      document.routingTracker,
      document.docTracer,
      auditDetails,
      userEmail,
    )

    const nextDocuments = documents.map((row) =>
      row.routingTracker === document.routingTracker ? document : row,
    )
    const appData = buildAppDataFrom(nextDocuments, registryValues, userEmail)
    return { ...result, appData }
  },

  async getAuditTrail() {
    const client = requireClient()
    const { data, error } = await client
      .from('audit_events')
      .select('*')
      .order('event_timestamp', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => mapAuditEventRow(row as AuditEventRow))
  },

  async addRegistryValue(type, value, userEmail) {
    const trimmed = String(value || '').trim()
    if (!trimmed) throw new Error('Value is required.')
    if (!isValidRegistryValue(trimmed)) {
      throw new Error(
        'Registry values can only contain readable text, numbers, spaces, and common punctuation.',
      )
    }

    const client = requireClient()
    const registryValues = await loadRegistryValues()
    const exists = registryValues.some(
      (row) => row.registryType === type && row.value.toLowerCase() === trimmed.toLowerCase(),
    )

    if (!exists) {
      const { error } = await client.from('registry_values').insert({
        id: `reg-${Date.now()}`,
        registry_type: type,
        value: trimmed,
      })
      if (error) throw new Error(error.message)
      await appendAudit(
        'Added registry value',
        '',
        '',
        `${type} registry value "${trimmed}" was added by ${userEmail} on ${formatVrmsDisplayDateTime(new Date())}.`,
        userEmail,
      )
    }

    return this.getAppData(userEmail)
  },

  async deleteRegistryValue(type, value, userEmail) {
    const trimmed = String(value || '').trim()
    const client = requireClient()
    const { error } = await client
      .from('registry_values')
      .delete()
      .eq('registry_type', type)
      .eq('value', trimmed)
    if (error) throw new Error(error.message)

    await appendAudit(
      'Deleted registry value',
      '',
      '',
      `${type} registry value "${trimmed}" was removed by ${userEmail} on ${formatVrmsDisplayDateTime(new Date())}.`,
      userEmail,
    )

    return this.getAppData(userEmail)
  },
}
