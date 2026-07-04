export type ApqrPackage = 'Billable' | 'Not Billable'
export type ClientStatus = 'active' | 'archived'
export type CommitmentScheduleStatus = 'Planned' | 'For Client Approval' | 'Client Approved'
export type StabilityTabulationStatus = 'No Ongoing Stability' | 'Not Sent' | 'Sent'
export type ApqrReportStatus = 'Draft Sent' | 'For Client Approval' | 'Client Approved'
export type DeliveryClassification =
  | 'Delivered On Time'
  | 'Delivered Overdue'
  | 'Currently Overdue and Undelivered'

export type ApqrDepartment =
  | 'Dry'
  | 'Liquids'
  | 'Creams and Ointments'
  | 'Topicals'
  | 'Cosmetics'

export interface ApqrClient {
  id: string
  code: string
  account_manager: string
  client_name: string
  qa: string | null
  technical: string | null
  regulatory: string | null
  apqr_package: ApqrPackage
  status: ClientStatus
  created_at: string
  updated_at: string
}

export interface ApqrSchedulerEntry {
  id: string
  apqr_id: string
  client_id: string
  stability_pull_out_date: string | null
  product_name: string
  product_code: string
  review_coverage_start: string
  review_coverage_end: string
  review_coverage_adjustment_reason: string | null
  commitment_schedule: string
  commitment_schedule_status: CommitmentScheduleStatus
  schedule_status_date: string | null
  stability_pull_out_adjustment_reason: string | null
  is_active: boolean
  archived_at: string | null
  archive_reason: string | null
  created_at: string
  updated_at: string
}

export interface ApqrRecord {
  id: string
  scheduler_entry_id: string
  department: ApqrDepartment | string | null
  stability_tabulation_status: StabilityTabulationStatus | null
  stability_tabulation_status_date: string | null
  no_ongoing_stability_justification: string | null
  billing_reference_number: string | null
  apqr_report_status: ApqrReportStatus | null
  sent_by: string | null
  date_sent: string | null
  apr_reference_number: string | null
  number_of_batches: number | null
  zero_batch_explanation: string | null
  date_client_signed: string | null
  final_apqr_delivery_date: string | null
  delivery_classification: DeliveryClassification | null
  days_early_or_overdue: number | null
  delay_category: string | null
  delay_reason: string | null
  delay_reason_change_note: string | null
  expected_final_delivery_date: string | null
  remarks: string | null
  next_follow_up_due_date: string | null
  record_status: 'active' | 'archived'
  created_at: string
  updated_at: string
}

export interface ApqrFollowUp {
  id: string
  record_id: string
  follow_up_date: string
  follow_up_remarks: string
  recorded_by: string
  recorded_at: string
}

export interface ApqrDatabaseRow {
  apqr_id: string
  scheduler_entry_id: string
  record_id: string
  client_id: string
  client_code: string
  client_name: string
  account_manager: string
  apqr_package: ApqrPackage
  product_name: string
  product_code: string
  department: string | null
  review_coverage_start: string
  review_coverage_end: string
  stability_pull_out_date: string | null
  expected_stability_tabulation_completion_date: string | null
  stability_tabulation_status: StabilityTabulationStatus | null
  commitment_schedule: string
  commitment_schedule_status: CommitmentScheduleStatus
  apqr_report_status: ApqrReportStatus | null
  apr_reference_number: string | null
  number_of_batches: number | null
  billing_reference_number: string | null
  date_sent: string | null
  last_follow_up_date: string | null
  next_follow_up_due_date: string | null
  date_client_signed: string | null
  final_apqr_delivery_date: string | null
  delivery_classification: DeliveryClassification | null
  days_remaining_or_overdue: number | null
  record_status: string
  updated_at: string
  priority: ApqrPriority
  missing_critical_count: number
}

export type ApqrPriority =
  | 'Overdue Commitment'
  | 'Critical Commitment'
  | 'High-Priority Commitment'
  | 'Moderate Priority'
  | 'Low Priority'
  | 'Completed'
  | 'Overdue Stability Action'
  | 'Critical Stability Action'

export interface ApqrDashboardMetrics {
  totalActive: number
  overdueCommitments: number
  criticalCommitments: number
  highPriorityCommitments: number
  dueThisMonth: number
  deliveredThisMonth: number
  onTimeDeliveryRate: number
  onTimeDelivered: number
  totalDelivered: number
  overdueDeliveries: number
  pendingClientApproval: number
  followUpsDue: number
  stabilityActionsDue: number
  missingCriticalInformation: number
}

export interface ApqrTriageSlice {
  name: string
  value: number
  color: string
}

export interface ApqrUpcomingAction {
  id: string
  title: string
  productName: string
  dueLabel: string
  tone: 'danger' | 'warning' | 'info' | 'neutral'
  link: string
}

export interface ApqrMetricTrend {
  text: string
  tone: 'good' | 'bad' | 'neutral'
}

export interface ApqrClientInput {
  code: string
  account_manager: string
  client_name: string
  qa?: string
  technical?: string
  regulatory?: string
  apqr_package: ApqrPackage
}

export interface ApqrSchedulerRowInput {
  stability_pull_out_date: string
  product_name: string
  product_code: string
  review_coverage_start: string
  review_coverage_end: string
  review_coverage_adjustment_reason?: string
  commitment_schedule_status: CommitmentScheduleStatus
  schedule_status_date?: string | null
  stability_pull_out_adjustment_reason?: string
}

export interface ApqrRecordInput {
  department?: string | null
  stability_tabulation_status?: StabilityTabulationStatus | null
  no_ongoing_stability_justification?: string | null
  billing_reference_number?: string | null
  apqr_report_status?: ApqrReportStatus | null
  sent_by?: string | null
  date_sent?: string | null
  apr_reference_number?: string | null
  number_of_batches?: number | null
  zero_batch_explanation?: string | null
  date_client_signed?: string | null
  final_apqr_delivery_date?: string | null
  delay_category?: string | null
  delay_reason?: string | null
  expected_final_delivery_date?: string | null
  remarks?: string | null
}
