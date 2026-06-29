import { isDueSoonByDate } from './vmpMasterlistSchedule'
import { legacyEquipmentGroupByDepartment, VMP_OTHER_OPTION } from '../data/vmpFieldOptionDefaults'
import type { VmpQcInstrument } from './vmpQcInstruments'

export const validationAreas = [
  'Facilities',
  'Utilities',
  'Equipment',
  'Computerized Systems',
  'Manufacturing Process Validation',
  'Packaging Process Validation',
  'Cleaning Validation',
  'Plant Qualification',
] as const

export type ValidationArea = (typeof validationAreas)[number]

export const validationStatuses = [
  'Not Assessed',
  'Planned',
  'Protocol in Preparation',
  'Pending Protocol Approval',
  'Approved for Execution',
  'Ongoing',
  'Report in Preparation',
  'Pending Report Approval',
  'Qualified',
  'Due Soon',
  'Requalification Due',
  'Overdue',
  'Deferred',
] as const

export type ValidationStatus = (typeof validationStatuses)[number]

export const lifecycleStatuses = ['Active', 'Inactive', 'Retired', 'Decommissioned'] as const
export type LifecycleStatus = (typeof lifecycleStatuses)[number]

export const criticalities = ['Low', 'Medium', 'High', 'Critical'] as const
export type Criticality = (typeof criticalities)[number]

export const reviewFrequencies = [
  'Annual',
  'Every 2 Years',
  'Every 3 Years',
  'Every 5 Years',
  'Risk-Based',
  'As Needed',
  'Custom',
] as const

export type ReviewFrequency = (typeof reviewFrequencies)[number]

export const sitePlantOptions = ['Plant 1', 'Plant 2'] as const

export interface VmpHistoryEvent {
  id: string
  date: string
  actor: string
  action: string
  previousValue: string
  currentValue: string
  reason: string
}

export interface VmpMasterlistRecord {
  id: string
  recordId: string
  itemName: string
  validationArea: ValidationArea
  sitePlant: string
  department: string
  group: string
  roomLine: string
  assetTagNo: string
  protocolTracer: string
  reportTracer: string
  reportApprovalDate: string
  reviewFrequency: string
  nextDueDate: string
  validationStatus: ValidationStatus
  lifecycleStatus: LifecycleStatus
  criticality: Criticality
  responsibleOwner: string
  remarks: string
  isDraft: boolean
  isArchived: boolean
  version: number
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  history: VmpHistoryEvent[]
  qcInstruments: VmpQcInstrument[]
}

export interface VmpMasterlistFilters {
  validationArea: string
  sitePlant: string
  department: string
  group: string
  validationStatus: string
  lifecycleStatus: string
  criticality: string
  dueMonth: string
  dueYear: string
  search: string
  showArchived: boolean
}

export type VmpKpiFilter = 'all' | 'qualified' | 'dueSoon' | 'overdue' | 'highRisk'

export type { VmpQcInstrument } from './vmpQcInstruments'

export {
  equipmentDepartmentOptions,
  facilitiesSubCategoryOptions,
  legacyEquipmentGroupByDepartment as equipmentGroupByDepartment,
  groupOptionsByArea,
  VMP_OTHER_OPTION,
} from '../data/vmpFieldOptionDefaults'

export function normalizeEquipmentDepartment(department: string): string {
  return department.replace(/\s+DEPARTMENT$/i, '').trim()
}

export function getEquipmentGroupOptions(department: string): readonly string[] {
  const key = normalizeEquipmentDepartment(department)
  return legacyEquipmentGroupByDepartment[key] ?? []
}

export const emptyVmpFilters: VmpMasterlistFilters = {
  validationArea: '',
  sitePlant: '',
  department: '',
  group: '',
  validationStatus: '',
  lifecycleStatus: '',
  criticality: '',
  dueMonth: '',
  dueYear: '',
  search: '',
  showArchived: false,
}

const AREA_PREFIX: Record<ValidationArea, string> = {
  Facilities: 'FAC',
  Utilities: 'UTL',
  Equipment: 'EQ',
  'Computerized Systems': 'CS',
  'Manufacturing Process Validation': 'MPV',
  'Packaging Process Validation': 'PPV',
  'Cleaning Validation': 'CV',
  'Plant Qualification': 'PQ',
}

function reportApprovalFromDocs(docs: { type: string; approvalDate: string }[]): string {
  const report = docs.find((doc) => doc.type === 'Report')
  return report?.approvalDate ?? ''
}

function internalId(): string {
  return crypto.randomUUID()
}

function auditNow(): string {
  return new Date().toISOString()
}

function auditToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Migrate legacy seed shape into flattened record. */
function seedRecord(
  legacyId: string,
  partial: Omit<VmpMasterlistRecord, 'id' | 'recordId' | 'qcInstruments'> & {
    recordId?: string
    qcInstruments?: VmpQcInstrument[]
  },
): VmpMasterlistRecord {
  return {
    id: internalId(),
    recordId: partial.recordId ?? legacyId,
    ...partial,
    qcInstruments: partial.qcInstruments ?? [],
  }
}

export const vmpMasterlistSeedRecords: VmpMasterlistRecord[] = [
  seedRecord('VMP-EQ-02-000-041', {
    itemName: 'Autoclave Unit AU-041',
    validationArea: 'Equipment',
    sitePlant: 'Plant 2',
    department: 'Production',
    group: 'Sterilization',
    roomLine: '',
    assetTagNo: 'IL-AU-041',
    protocolTracer: 'VMP-EQ-02-000-041P-4',
    reportTracer: 'VMP-EQ-02-000-041R-4',
    reportApprovalDate: '2025-08-28',
    reviewFrequency: 'Annual',
    nextDueDate: '2026-08-15',
    validationStatus: 'Requalification Due',
    lifecycleStatus: 'Active',
    criticality: 'High',
    responsibleOwner: 'Validation Team',
    remarks: 'Annual requalification window opened.',
    isDraft: false,
    isArchived: false,
    version: 1,
    createdAt: '2021-08-10T00:00:00.000Z',
    createdBy: 'qa.admin@gxptoolkit.local',
    updatedAt: '2026-06-15T00:00:00.000Z',
    updatedBy: 'qa.admin@gxptoolkit.local',
    history: [
      {
        id: 'hist-eq-041-1',
        date: '2026-06-15',
        actor: 'qa.admin@gxptoolkit.local',
        action: 'Schedule review',
        previousValue: 'Qualified',
        currentValue: 'Requalification Due',
        reason: 'Next due date is within planning window.',
      },
    ],
  }),
  seedRecord('VMP-FAC-01-000-012', {
    itemName: 'P1 Compounding Suite',
    validationArea: 'Facilities',
    sitePlant: 'Plant 1',
    department: 'Facilities',
    group: 'Cleanroom Qualification',
    roomLine: '',
    assetTagNo: '',
    protocolTracer: 'VMP-FAC-01-000-012P-2',
    reportTracer: 'VMP-FAC-01-000-012R-2',
    reportApprovalDate: '',
    reviewFrequency: 'Every 2 Years',
    nextDueDate: '2027-03-31',
    validationStatus: 'Qualified',
    lifecycleStatus: 'Active',
    criticality: 'High',
    responsibleOwner: 'Facilities Qualification',
    remarks: 'Routine environmental monitoring remains within limits.',
    isDraft: false,
    isArchived: false,
    version: 1,
    createdAt: '2020-03-10T00:00:00.000Z',
    createdBy: 'facilities.owner@gxptoolkit.local',
    updatedAt: '2026-03-31T00:00:00.000Z',
    updatedBy: 'facilities.owner@gxptoolkit.local',
    history: [],
    qcInstruments: [],
  }),
  seedRecord('VMP-UTL-02-000-008', {
    itemName: 'Purified Water Loop P2',
    validationArea: 'Utilities',
    sitePlant: 'Plant 2',
    department: 'Engineering',
    group: 'Purified Water System',
    roomLine: '',
    assetTagNo: 'IL-PW-008',
    protocolTracer: 'VMP-UTL-02-000-008P-3',
    reportTracer: 'VMP-UTL-02-000-008R-3',
    reportApprovalDate: '2025-06-20',
    reviewFrequency: 'Annual',
    nextDueDate: '2026-06-20',
    validationStatus: 'Overdue',
    lifecycleStatus: 'Active',
    criticality: 'High',
    responsibleOwner: 'Engineering Validation',
    remarks: 'Delayed by maintenance shutdown coordination.',
    isDraft: false,
    isArchived: false,
    version: 1,
    createdAt: '2019-06-21T00:00:00.000Z',
    createdBy: 'quality@gxptoolkit.local',
    updatedAt: '2026-06-21T00:00:00.000Z',
    updatedBy: 'quality@gxptoolkit.local',
    history: [],
    qcInstruments: [],
  }),
  seedRecord('VMP-CS-00-000-004', {
    itemName: 'Electronic Batch Record Platform',
    validationArea: 'Computerized Systems',
    sitePlant: 'Plant 1',
    department: 'Quality Systems',
    group: 'Computerized System',
    roomLine: '',
    assetTagNo: '',
    protocolTracer: 'VMP-CS-00-000-004P-1',
    reportTracer: 'VMP-CS-00-000-004R-1',
    reportApprovalDate: '2024-12-15',
    reviewFrequency: 'Risk-Based',
    nextDueDate: '2026-12-15',
    validationStatus: 'Ongoing',
    lifecycleStatus: 'Active',
    criticality: 'Medium',
    responsibleOwner: 'IT Quality',
    remarks: 'Version upgrade validation in progress.',
    isDraft: false,
    isArchived: false,
    version: 1,
    createdAt: '2024-12-15T00:00:00.000Z',
    createdBy: 'it.quality@gxptoolkit.local',
    updatedAt: '2026-05-01T00:00:00.000Z',
    updatedBy: 'it.quality@gxptoolkit.local',
    history: [],
    qcInstruments: [],
  }),
  seedRecord('VMP-CV-02-000-014', {
    itemName: 'Cream Line Cleaning Matrix',
    validationArea: 'Cleaning Validation',
    sitePlant: 'Plant 2',
    department: 'Validation',
    group: 'Packaging Equipment',
    roomLine: '',
    assetTagNo: '',
    protocolTracer: 'VMP-CV-02-000-014P-2',
    reportTracer: 'VMP-CV-02-000-014R-2',
    reportApprovalDate: '2025-10-30',
    reviewFrequency: 'Annual',
    nextDueDate: '2026-10-30',
    validationStatus: 'Qualified',
    lifecycleStatus: 'Active',
    criticality: 'Medium',
    responsibleOwner: 'Cleaning Validation',
    remarks: 'Worst-case product remains unchanged.',
    isDraft: false,
    isArchived: false,
    version: 1,
    createdAt: '2022-10-30T00:00:00.000Z',
    createdBy: 'validation@gxptoolkit.local',
    updatedAt: '2026-01-10T00:00:00.000Z',
    updatedBy: 'validation@gxptoolkit.local',
    history: [],
    qcInstruments: [],
  }),
]

export function getDueYear(record: Pick<VmpMasterlistRecord, 'nextDueDate'>): string {
  return record.nextDueDate ? record.nextDueDate.slice(0, 4) : ''
}

export function getDueMonthFromDate(nextDueDate: string): string {
  if (!nextDueDate) return ''
  const parsed = new Date(`${nextDueDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleString('en-US', { month: 'long' })
}

export function isDueSoon(record: Pick<VmpMasterlistRecord, 'nextDueDate' | 'validationStatus'>, now = new Date()) {
  if (!record.nextDueDate) return false
  if (record.validationStatus === 'Overdue') return false
  return isDueSoonByDate(record.nextDueDate, now)
}

export function matchesKpiFilter(record: VmpMasterlistRecord, kpi: VmpKpiFilter, now = new Date()) {
  if (kpi === 'qualified') return record.validationStatus === 'Qualified'
  if (kpi === 'dueSoon') return isDueSoon(record, now)
  if (kpi === 'overdue') return record.validationStatus === 'Overdue'
  if (kpi === 'highRisk') return record.criticality === 'High' || record.criticality === 'Critical'
  return true
}

export function buildSearchHaystack(record: VmpMasterlistRecord): string {
  return [
    record.recordId,
    record.itemName,
    record.assetTagNo,
    record.protocolTracer,
    record.reportTracer,
    record.department,
    record.group,
    record.responsibleOwner,
  ]
    .join(' ')
    .toLowerCase()
}

export function applyVmpMasterlistFilters(
  records: VmpMasterlistRecord[],
  filters: VmpMasterlistFilters,
  kpi: VmpKpiFilter = 'all',
  now = new Date(),
) {
  const search = filters.search.trim().toLowerCase()
  return records.filter((record) => {
    if (!filters.showArchived && record.isArchived) return false
    if (!matchesKpiFilter(record, kpi, now)) return false
    if (filters.validationArea && record.validationArea !== filters.validationArea) return false
    if (filters.sitePlant && record.sitePlant !== filters.sitePlant) return false
    if (filters.department && record.department !== filters.department) return false
    if (filters.group && record.group !== filters.group) return false
    if (filters.validationStatus && record.validationStatus !== filters.validationStatus) return false
    if (filters.lifecycleStatus && record.lifecycleStatus !== filters.lifecycleStatus) return false
    if (filters.criticality && record.criticality !== filters.criticality) return false
    if (filters.dueYear && getDueYear(record) !== filters.dueYear) return false
    if (filters.dueMonth && getDueMonthFromDate(record.nextDueDate) !== filters.dueMonth) return false
    if (!search) return true
    return buildSearchHaystack(record).includes(search)
  })
}

export function getVmpKpiCounts(records: VmpMasterlistRecord[], now = new Date()) {
  const active = records.filter((record) => !record.isArchived)
  return {
    all: active.length,
    qualified: active.filter((record) => record.validationStatus === 'Qualified').length,
    dueSoon: active.filter((record) => isDueSoon(record, now)).length,
    overdue: active.filter((record) => record.validationStatus === 'Overdue').length,
    highRisk: active.filter((record) => record.criticality === 'High' || record.criticality === 'Critical').length,
  }
}

export function getUniqueOptions(records: VmpMasterlistRecord[], key: keyof VmpMasterlistRecord) {
  return Array.from(new Set(records.map((record) => String(record[key] ?? '')).filter(Boolean))).sort()
}

export function mergeVmpOptions(primary: readonly string[], fallback: readonly string[] = []) {
  const values = [...primary, ...fallback].map((value) => value.trim()).filter(Boolean)
  const withoutOther = values.filter((value) => value !== VMP_OTHER_OPTION)
  const unique = Array.from(new Set(withoutOther)).sort()
  return values.includes(VMP_OTHER_OPTION) ? [...unique, VMP_OTHER_OPTION] : unique
}

export function getControlledSelectValue(value: string, options: readonly string[]) {
  if (!value) return ''
  return options.includes(value) ? value : VMP_OTHER_OPTION
}

export function getOtherOptionValue(value: string, options: readonly string[]) {
  if (!value || value === VMP_OTHER_OPTION || options.includes(value)) return ''
  return value
}

export function generateRecordId(validationArea: ValidationArea, existingRecordIds: readonly string[]): string {
  const prefix = AREA_PREFIX[validationArea]
  const pattern = new RegExp(`^VMP-${prefix}-\\d{2}-\\d{3}-(\\d{3})$`)
  let maxSeq = 0
  for (const id of existingRecordIds) {
    const match = id.match(pattern)
    if (match) maxSeq = Math.max(maxSeq, Number(match[1]))
  }
  const next = String(maxSeq + 1).padStart(3, '0')
  const plantCode = '02'
  return `VMP-${prefix}-${plantCode}-000-${next}`
}

export function createDraftVmpRecord(records: VmpMasterlistRecord[], actor: string): VmpMasterlistRecord {
  const validationArea: ValidationArea = 'Equipment'
  const nextDueDate = new Date()
  nextDueDate.setMonth(nextDueDate.getMonth() + 12)
  const due = nextDueDate.toISOString().slice(0, 10)
  const now = auditNow()
  const recordId = generateRecordId(
    validationArea,
    records.map((record) => record.recordId),
  )

  return {
    id: internalId(),
    recordId,
    itemName: '',
    validationArea,
    sitePlant: 'Plant 1',
    department: 'Validation',
    group: '',
    roomLine: '',
    assetTagNo: '',
    protocolTracer: '',
    reportTracer: '',
    reportApprovalDate: '',
    reviewFrequency: 'Annual',
    nextDueDate: due,
    validationStatus: 'Planned',
    lifecycleStatus: 'Active',
    criticality: 'Medium',
    responsibleOwner: 'Validation Team',
    remarks: '',
    isDraft: true,
    isArchived: false,
    version: 1,
    createdAt: now,
    createdBy: actor,
    updatedAt: now,
    updatedBy: actor,
    history: [],
    qcInstruments: [],
  }
}

export function createHistoryEvent(
  record: VmpMasterlistRecord,
  action: string,
  actor: string,
  previousValue: string,
  currentValue: string,
  reason: string,
): VmpHistoryEvent {
  return {
    id: `hist-${record.recordId}-${Date.now()}`,
    date: auditToday(),
    actor,
    action,
    previousValue,
    currentValue,
    reason,
  }
}

// ponytail: legacy helper kept for import migration only
export { reportApprovalFromDocs }
