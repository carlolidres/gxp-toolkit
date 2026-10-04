export const CPV_DOSAGE_FORMS = [
  'Tablet',
  'Capsule',
  'Solution',
  'Suspension',
  'Cream',
  'Ointment',
  'Injectable',
  'Other',
] as const

export const CPV_REVIEW_FREQUENCIES = ['Monthly', 'Quarterly', 'Semiannual', 'Annual'] as const

export const CPV_PRODUCT_STATUSES = ['Draft', 'Active', 'Retired'] as const

export const CPV_BATCH_SIZE_UNITS = ['Kg', 'L'] as const

export type CpvBatchSizeUnit = (typeof CPV_BATCH_SIZE_UNITS)[number]

export interface CpvAlternateBatchSize {
  size: string
  unit: CpvBatchSizeUnit
}

export interface CpvReportEntry {
  tracer_no: string
  issued_date: string
  remarks: string
}

export interface CpvHoldEntry {
  report_ref: string
  issued_date: string
  hold_time: string
}

export interface CpvCppStep {
  step_no: string
  description: string
  cpp: string
}

export interface CpvCppMonitoring {
  vmp_report_no: string
  issued_date: string
  steps: CpvCppStep[]
}

export const CPV_POSTURES = ['Not Assessed', 'Insufficient Data', 'Not Valid', 'At Risk', 'Valid'] as const

export const CPV_BATCH_STATUSES = [
  'Planned',
  'In Process',
  'Packaged',
  'Released',
  'Rejected',
  'Cancelled',
] as const

export const CPV_PROTOCOL_STATUSES = [
  'Draft',
  'In Review',
  'Pending Approval',
  'Approved/Effective',
  'Rejected',
  'Superseded',
  'Retired',
] as const

export const CPV_REPORT_STATUSES = [
  'Draft',
  'In Review',
  'Pending Approval',
  'Approved/Effective',
  'Rejected',
  'Superseded',
] as const

export const CPV_CONTROLLED_STATUSES = new Set(['Approved/Effective', 'Superseded', 'Retired'])

export type CpvDosageForm = (typeof CPV_DOSAGE_FORMS)[number]
export type CpvReviewFrequency = (typeof CPV_REVIEW_FREQUENCIES)[number]
export type CpvProductStatus = (typeof CPV_PRODUCT_STATUSES)[number]
export type CpvPosture = (typeof CPV_POSTURES)[number]
export type CpvBatchStatus = (typeof CPV_BATCH_STATUSES)[number]
export type CpvProtocolStatus = (typeof CPV_PROTOCOL_STATUSES)[number]
export type CpvReportStatus = (typeof CPV_REPORT_STATUSES)[number]

export interface CpvActor {
  id: string
  name: string
  email: string
  role: 'Admin' | 'Manager' | 'Editor' | 'Viewer'
}

export interface CpvProduct {
  id: string
  product_code: string
  product_name: string
  generic_name: string | null
  dosage_form: string
  strength: string | null
  batch_size: string | null
  batch_size_unit: string | null
  alternate_batch_sizes: CpvAlternateBatchSize[]
  report_entries: CpvReportEntry[]
  hold_entries: CpvHoldEntry[]
  cpp_monitoring: CpvCppMonitoring
  client_owner: string | null
  manufacturing_site: string | null
  packaging_site: string | null
  markets: string | null
  registration_number: string | null
  review_frequency: CpvReviewFrequency
  pv_protocol_ref: string | null
  pv_report_ref: string | null
  effective_date: string | null
  status: CpvProductStatus
  retire_reason: string | null
  proposed_posture: CpvPosture
  official_posture: CpvPosture
  official_posture_rationale: string | null
  official_posture_approved_by: string | null
  official_posture_approved_at: string | null
  review_period_start: string | null
  review_period_end: string | null
  next_review_due: string | null
  last_assessment_at: string | null
  open_critical_items: number
  row_version: number
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface CpvProductInput {
  product_code: string
  product_name: string
  generic_name?: string | null
  dosage_form: string
  strength?: string | null
  batch_size?: string | null
  batch_size_unit?: string | null
  alternate_batch_sizes?: CpvAlternateBatchSize[]
  report_entries?: CpvReportEntry[]
  hold_entries?: CpvHoldEntry[]
  cpp_monitoring?: CpvCppMonitoring
  client_owner?: string | null
  manufacturing_site?: string | null
  packaging_site?: string | null
  markets?: string | null
  registration_number?: string | null
  review_frequency: CpvReviewFrequency
  pv_protocol_ref?: string | null
  pv_report_ref?: string | null
  effective_date?: string | null
  status?: CpvProductStatus
  review_period_start?: string | null
  review_period_end?: string | null
  next_review_due?: string | null
}

export interface CpvProductSaveResult {
  product: CpvProduct
  nameWarning?: string
}

export interface CpvPackagingOrder {
  id: string
  batch_id: string
  po_control_number: string
  comments: string | null
  created_at: string
  updated_at: string
}

export interface CpvBatch {
  id: string
  product_id: string
  batch_number: string
  mo_control_number: string | null
  manufacturing_start_at: string | null
  manufacturing_end_at: string | null
  packaging_start_at: string | null
  packaging_end_at: string | null
  fg_release_date: string | null
  status: CpvBatchStatus
  comments: string | null
  date_exception_reason: string | null
  voided: boolean
  void_reason: string | null
  row_version: number
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  packaging_orders: CpvPackagingOrder[]
}

export interface CpvBatchInput {
  batch_number: string
  mo_control_number?: string | null
  manufacturing_start_at?: string | null
  manufacturing_end_at?: string | null
  packaging_start_at?: string | null
  packaging_end_at?: string | null
  fg_release_date?: string | null
  status: CpvBatchStatus
  comments?: string | null
  date_exception_reason?: string | null
  row_version?: number
}

export const COPY_FORWARD_SAFE_FIELDS = ['comments', 'status'] as const
export const COPY_FORWARD_RESTRICTED_FIELDS = [
  'mo_control_number',
  'manufacturing_start_at',
  'manufacturing_end_at',
  'packaging_start_at',
  'packaging_end_at',
  'fg_release_date',
] as const

export type CpvCopyForwardField =
  | (typeof COPY_FORWARD_SAFE_FIELDS)[number]
  | (typeof COPY_FORWARD_RESTRICTED_FIELDS)[number]

export interface CpvCopyForwardRequest {
  sourceBatchId: string
  target: CpvBatchInput
  confirmed: boolean
  selectedFields: CpvCopyForwardField[]
}

export interface CpvProtocol {
  id: string
  protocol_number: string
  version: number
  product_id: string
  title: string
  review_period_start: string | null
  review_period_end: string | null
  scope: string | null
  batch_selection_rule: string | null
  status: CpvProtocolStatus
  author_id: string | null
  author_name: string | null
  reviewer_name: string | null
  approver_name: string | null
  signoff_printed_name: string | null
  signoff_meaning: string | null
  effective_date: string | null
  superseded_protocol_id: string | null
  linked_report_id: string | null
  objective: string | null
  reject_comment: string | null
  row_version: number
  created_at: string
  updated_at: string
}

export interface CpvProtocolInput {
  product_id: string
  title: string
  review_period_start?: string | null
  review_period_end?: string | null
  scope?: string | null
  batch_selection_rule?: string | null
  objective?: string | null
}

export interface CpvSignoff {
  printedName: string
  meaning: string
}

export interface CpvReportSnapshot {
  generated_at: string
  generated_by: string
  product_id: string
  protocol_id: string
  protocol_version: number
  review_period_start: string | null
  review_period_end: string | null
  included_batch_ids: string[]
  excluded_batch_ids: string[]
  proposed_posture: CpvPosture
}

export interface CpvReport {
  id: string
  report_number: string
  version: number
  product_id: string
  protocol_id: string | null
  review_period_start: string | null
  review_period_end: string | null
  included_batch_count: number
  excluded_batch_count: number
  proposed_posture: CpvPosture
  approved_posture: CpvPosture | null
  status: CpvReportStatus
  snapshot: CpvReportSnapshot | null
  author_id: string | null
  author_name: string | null
  reviewer_name: string | null
  approver_name: string | null
  signoff_printed_name: string | null
  signoff_meaning: string | null
  effective_date: string | null
  reject_comment: string | null
  row_version: number
  created_at: string
  updated_at: string
}

export interface CpvAuditEvent {
  id: string
  occurred_at: string
  actor_id: string | null
  actor_name: string
  actor_role: string | null
  action_type: string
  product_id: string | null
  batch_id: string | null
  module: string | null
  record_type: string
  record_id: string
  record_label: string | null
  field_name: string | null
  old_value: string | null
  new_value: string | null
  reason: string | null
  source_record_id: string | null
  correlation_id: string | null
}

export interface CpvAuditFilter {
  from?: string
  to?: string
  user?: string
  productId?: string
  batchId?: string
  module?: string
  recordType?: string
  recordId?: string
  actionType?: string
  fieldName?: string
  protocolOrReportNumber?: string
}

export const CPV_WORKSPACE_SECTIONS = [
  { id: 'profile', label: 'Product Profile', path: '' },
  { id: 'batches', label: 'Product Batches', path: 'batches' },
  { id: 'raw-materials', label: 'Raw Materials (RMs)', path: 'raw-materials' },
  { id: 'packaging-materials', label: 'Packaging Materials (PMs)', path: 'packaging-materials' },
  { id: 'equipment', label: 'Equipment / Rooms / Lines', path: 'equipment' },
  { id: 'ipc', label: 'In-Process Controls (IPC)', path: 'ipc' },
  { id: 'analytical', label: 'Analytical Reports (AR)', path: 'analytical' },
  { id: 'stability', label: 'Stability', path: 'stability' },
  { id: 'hold-time', label: 'Hold-Time Monitoring', path: 'hold-time' },
  { id: 'cnf', label: 'Change Notification Forms', path: 'cnf' },
  { id: 'complaints', label: 'Product Complaints', path: 'complaints' },
  { id: 'deviations', label: 'Deviation Reports (DR)', path: 'deviations' },
  { id: 'improvements', label: 'Process Improvement Monitoring', path: 'improvements' },
] as const
