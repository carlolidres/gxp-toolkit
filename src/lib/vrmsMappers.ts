import type { AuditEvent, RegistryValue, RoutingDocument, VrmsSignatory } from '../types/vrms'

export interface RoutingDocumentRow {
  routing_tracker: string
  doc_tracer: string
  equipment_product: string
  category: string
  il_tag: string | null
  status: string
  sent_routing_to: string | null
  email: string | null
  date_sent: string | null
  report_protocol: string
  batch_no: string
  client_name: string
  department: string
  prepared_by: string
  date_prepared: string
  checked_by: string
  date_checked: string
  target_completion_date: string | null
  remarks: string | null
  signatories: string
  total_routing_duration: string | null
  routing_completed_at: string | null
  created_at: string
  updated_at: string
  updated_by: string
}

export interface RegistryValueRow {
  id: string
  registry_type: string
  value: string
}

export interface AuditEventRow {
  id: string
  event_timestamp: string
  user_email: string
  action: string
  routing_tracker: string | null
  doc_tracer: string | null
  details: string
}

export function parseSignatoriesJson(value: string | VrmsSignatory[]): VrmsSignatory[] {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? (parsed as VrmsSignatory[]) : []
  } catch {
    return []
  }
}

export function serializeSignatoriesJson(signatories: VrmsSignatory[]): string {
  return JSON.stringify(signatories)
}

export function mapRoutingDocumentRow(row: RoutingDocumentRow): RoutingDocument {
  return {
    routingTracker: row.routing_tracker,
    docTracer: row.doc_tracer,
    equipmentProduct: row.equipment_product,
    category: row.category,
    ilTag: row.il_tag ?? '',
    status: row.status as RoutingDocument['status'],
    sentRoutingTo: row.sent_routing_to ?? '',
    email: row.email ?? '',
    dateSent: row.date_sent ?? '',
    reportProtocol: row.report_protocol,
    batchNo: row.batch_no,
    clientName: row.client_name,
    department: row.department,
    preparedBy: row.prepared_by,
    datePrepared: row.date_prepared,
    checkedBy: row.checked_by,
    dateChecked: row.date_checked,
    targetCompletionDate: row.target_completion_date ?? '',
    remarks: row.remarks ?? '',
    signatories: parseSignatoriesJson(row.signatories),
    totalRoutingDuration: row.total_routing_duration ?? '',
    routingCompletedAt: row.routing_completed_at ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
}

export function mapRoutingDocumentToRow(doc: RoutingDocument): RoutingDocumentRow {
  return {
    routing_tracker: doc.routingTracker,
    doc_tracer: doc.docTracer,
    equipment_product: doc.equipmentProduct,
    category: doc.category,
    il_tag: doc.ilTag || null,
    status: doc.status,
    sent_routing_to: doc.sentRoutingTo || null,
    email: doc.email || null,
    date_sent: doc.dateSent || null,
    report_protocol: doc.reportProtocol,
    batch_no: doc.batchNo,
    client_name: doc.clientName,
    department: doc.department,
    prepared_by: doc.preparedBy,
    date_prepared: doc.datePrepared,
    checked_by: doc.checkedBy,
    date_checked: doc.dateChecked,
    target_completion_date: doc.targetCompletionDate || null,
    remarks: doc.remarks || null,
    signatories: serializeSignatoriesJson(doc.signatories),
    total_routing_duration: doc.totalRoutingDuration || null,
    routing_completed_at: doc.routingCompletedAt || null,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
    updated_by: doc.updatedBy,
  }
}

export function mapRegistryValueRow(row: RegistryValueRow): RegistryValue {
  return {
    id: row.id,
    registryType: row.registry_type as RegistryValue['registryType'],
    value: row.value,
  }
}

export function mapAuditEventRow(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    timestamp: row.event_timestamp,
    userEmail: row.user_email,
    action: row.action,
    routingTracker: row.routing_tracker ?? '',
    docTracer: row.doc_tracer ?? '',
    details: row.details,
  }
}
