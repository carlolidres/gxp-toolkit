export const CPV_DEF_STATUSES = ['Active', 'Retired'] as const
export const CPV_PACKAGING_LEVELS = ['Primary', 'Secondary', 'Tertiary'] as const
export const CPV_ASSET_TYPES = ['Equipment', 'Room', 'Line'] as const
export const CPV_ASSET_STAGES = ['Manufacturing', 'Packaging'] as const
export const CPV_TEST_CLASSES = ['Bulk', 'Finished Product'] as const
export const CPV_DATA_TYPES = ['Numeric', 'Text', 'Categorical', 'Pass-Fail'] as const
export const CPV_CRITICALITIES = ['CQA', 'CPP', 'Other'] as const
export const CPV_INSTRUMENT_TYPES = ['HPLC', 'UFLC', 'GC', 'AAS', 'UV-Vis', 'Other'] as const
export const CPV_EVAL_STATUSES = ['Pass', 'Fail', 'Warning', 'OOS', 'OOT', 'Not Evaluated'] as const
export const CPV_WINDOW_STATUSES = ['Current', 'Due Soon', 'Due', 'Overdue', 'Not Evaluated'] as const
export const CPV_HOLD_UNITS = ['minutes', 'hours', 'days'] as const
export const CPV_HOLD_EVALS = ['Complies', 'Excursion', 'Not Evaluated'] as const
export const CPV_STABILITY_POINT_STATUSES = ['Scheduled', 'Due', 'Completed', 'Missed', 'Cancelled'] as const
export const CPV_STABILITY_DEFAULT_CONDITIONS = ['30 °C / 75% RH', '40 °C / 75% RH', '25 °C / 75% RH', '25 °C / 60% RH'] as const
export const CPV_DEFAULT_HOLD_TRANSITIONS = [
  'End of dispensing → Start of manufacturing',
  'End of manufacturing → Start of filling',
  'End of manufacturing → Start of compression',
  'End of manufacturing → Start of encapsulation',
  'End of compression → Start of coating',
  'End of coating → Start of packaging',
  'End of compression → Start of packaging',
  'End of encapsulation → Start of packaging',
] as const
export const CPV_CNF_STATUSES = ['Draft', 'Open', 'Pending Client Approval', 'Approved', 'Implemented', 'Closed', 'Cancelled'] as const
export const CPV_COMPLAINT_STATUSES = ['Open', 'Under Investigation', 'Closed', 'No Further Action'] as const
export const CPV_DEVIATION_STATUSES = ['Draft', 'Open', 'Under Investigation', 'Pending Approval', 'Closed', 'Cancelled'] as const
export const CPV_IMPROVEMENT_STATUSES = ['Open', 'In Progress', 'Completed', 'Closed', 'Cancelled'] as const
export const CPV_RECOMMENDATION_STATUSES = ['Open', 'In Progress', 'Completed', 'Closed', 'Cancelled', 'Overdue'] as const

export type CpvDefStatus = (typeof CPV_DEF_STATUSES)[number]
export type CpvEvalStatus = (typeof CPV_EVAL_STATUSES)[number]
export type CpvWindowStatus = (typeof CPV_WINDOW_STATUSES)[number]
export type CpvHoldEval = (typeof CPV_HOLD_EVALS)[number]

export interface CpvMaterialDefinition {
  id: string
  product_id: string
  kind: 'rm' | 'pm'
  description: string
  item_number: string
  spec_number: string | null
  amount: string | null
  unit: string | null
  function_in_formulation: string | null
  packaging_level: string | null
  approved_suppliers: string | null
  critical: boolean
  effective_from: string | null
  effective_to: string | null
  status: CpvDefStatus
  retire_reason: string | null
  row_version: number
}

export interface CpvMaterialUsage {
  id: string
  material_id: string
  batch_id: string
  po_id: string | null
  lot_number: string
  supplier: string | null
  quantity: string | null
  comments: string | null
}

export interface CpvAsset {
  id: string
  product_id: string
  asset_type: (typeof CPV_ASSET_TYPES)[number]
  name: string
  tag: string | null
  room: string | null
  line: string | null
  stage: (typeof CPV_ASSET_STAGES)[number]
  parameter_name: string | null
  lsl: string | null
  usl: string | null
  unit: string | null
  trend_enabled: boolean
  qual_report: string | null
  qual_status: string | null
  requal_due: string | null
  cleaning_sop: string | null
  cleaning_val_ref: string | null
  cleaning_review_due: string | null
  facility_qual_ref: string | null
  facility_requal_due: string | null
  effective_from: string | null
  effective_to: string | null
  status: CpvDefStatus
  retire_reason: string | null
}

export interface CpvAssetUse {
  id: string
  asset_id: string
  batch_id: string
  used_at: string
  parameter_result: string | null
  comments: string | null
  window_status: CpvWindowStatus
}

export interface CpvTestDefinition {
  id: string
  product_id: string
  kind: 'ipc' | 'analytical'
  name: string
  classification: (typeof CPV_TEST_CLASSES)[number]
  data_type: (typeof CPV_DATA_TYPES)[number]
  lsl: string | null
  usl: string | null
  target: string | null
  warning_low: string | null
  warning_high: string | null
  unit: string | null
  method_ref: string | null
  method_version: string | null
  criticality: string | null
  instrument_type: string | null
  effective_from: string | null
  effective_to: string | null
  status: CpvDefStatus
  retire_reason: string | null
}

export interface CpvTestResult {
  id: string
  definition_id: string
  batch_id: string
  result: string | null
  test_at: string | null
  sample_id: string | null
  report_ref: string | null
  instrument: string | null
  csv_ref: string | null
  investigation_link: string | null
  official_event: 'OOS' | 'OOT' | null
  not_applicable: boolean
  na_justification: string | null
  comments: string | null
  evaluation: CpvEvalStatus
  spec_version_applied: string | null
}

export interface CpvStabilityStudy {
  id: string
  product_id: string
  protocol_ref: string
  stability_batch: string
  product_batch_id: string | null
  packaging: string | null
  market: string | null
  start_date: string | null
  status: string
}

export interface CpvStabilityTimePoint {
  id: string
  study_id: string
  condition_label: string
  months: number
  due_date: string | null
  status: (typeof CPV_STABILITY_POINT_STATUSES)[number]
  parameter: string | null
  lsl: string | null
  usl: string | null
  unit: string | null
  result: string | null
  pull_date: string | null
  test_date: string | null
  method_version: string | null
}

export interface CpvHoldTimeRequirement {
  id: string
  product_id: string
  transition: string
  min_duration: string | null
  max_duration: string
  unit: (typeof CPV_HOLD_UNITS)[number]
  study_ref: string
  effective_from: string | null
  status: CpvDefStatus
}

export interface CpvHoldTimeRecord {
  id: string
  product_id: string
  requirement_id: string
  batch_id: string | null
  study_batch: string | null
  start_at: string
  end_at: string
  duration_hours: number | null
  evaluation: CpvHoldEval
}

export interface CpvLinkedEvent {
  id: string
  product_id: string
  kind: 'cnf' | 'complaint' | 'deviation'
  number: string
  title: string
  description: string
  category: string | null
  risk: string | null
  status: string
  initiated_at: string | null
  target_at: string | null
  closed_at: string | null
  conclusion: string | null
  cancel_or_nfa_reason: string | null
  capa_ref: string | null
  owner: string | null
  batch_ids: string[]
}

export interface CpvImprovement {
  id: string
  product_id: string
  number: string
  source_ref: string | null
  endorsed_at: string | null
  summary: string
  owner: string | null
  status: string
}

export interface CpvRecommendation {
  id: string
  improvement_id: string
  sequence: number
  text: string
  category: string | null
  priority: string | null
  owner: string | null
  target_at: string | null
  status: string
}

export interface CpvPhaseCounts {
  raw_materials: number
  packaging_materials: number
  equipment: number
  ipc: number
  analytical: number
  stability: number
  hold_time: number
  cnf: number
  complaints: number
  deviations: number
  improvements: number
}
