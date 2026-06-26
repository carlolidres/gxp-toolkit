import type { VrmsRegistryType } from '../types/vrms'
import { VRMS_REGISTRY_FIELD_MAP } from './vrmsDefaults'

export interface VrmsFormField {
  key: keyof typeof VRMS_REGISTRY_FIELD_MAP | 'docTracer' | 'equipmentProduct' | 'ilTag' | 'email' | 'dateSent' | 'batchNo' | 'targetCompletionDate' | 'remarks'
  label: string
  required?: boolean
  wide?: boolean
  naOptional?: boolean
  type?: 'text' | 'email' | 'date' | 'textarea'
  registryType?: VrmsRegistryType
}

export const VRMS_ROUTING_FORM_FIELDS: VrmsFormField[] = [
  { key: 'docTracer', label: 'Doc Tracer #', required: true },
  { key: 'equipmentProduct', label: 'Equipment/Product', required: true, wide: true },
  { key: 'category', label: 'Category', required: true, registryType: 'Category' },
  { key: 'ilTag', label: 'IL-Tag', naOptional: true },
  { key: 'status', label: 'Status', required: true, registryType: 'Status' },
  { key: 'sentRoutingTo', label: 'Sent/Routing To', required: true, registryType: 'Sent / Routing' },
  { key: 'email', label: 'Email', type: 'email', naOptional: true },
  { key: 'dateSent', label: 'Date Sent', type: 'date' },
  { key: 'reportProtocol', label: 'Report/Protocol', required: true, registryType: 'Report / Protocol' },
  { key: 'batchNo', label: 'Batch No.', required: true },
  { key: 'clientName', label: 'Client Name', required: true, registryType: 'Client' },
  { key: 'department', label: 'Department', required: true, wide: true, registryType: 'Department' },
  { key: 'preparedBy', label: 'Prepared By', required: true, registryType: 'Prepared by' },
  { key: 'datePrepared', label: 'Date Prepared', required: true, type: 'date' },
  { key: 'checkedBy', label: 'Checked By', required: true, registryType: 'Checked by' },
  { key: 'dateChecked', label: 'Date Checked', required: true, type: 'date' },
  { key: 'targetCompletionDate', label: 'Target Completion Date', type: 'date', wide: true },
  { key: 'remarks', label: 'Remarks', type: 'textarea', wide: true, naOptional: true },
]

export const VRMS_DATABASE_COLUMNS = [
  { key: 'routingTracker', label: 'Routing Tracker #' },
  { key: 'docTracer', label: 'Doc Tracer #' },
  { key: 'equipmentProduct', label: 'Equipment/Product' },
  { key: 'category', label: 'Category' },
  { key: 'ilTag', label: 'IL-Tag' },
  { key: 'status', label: 'Status' },
  { key: 'sentRoutingTo', label: 'Sent/Routing To' },
  { key: 'email', label: 'Email' },
  { key: 'dateSent', label: 'Date Sent' },
  { key: 'reportProtocol', label: 'Report/Protocol' },
  { key: 'clientName', label: 'Client Name' },
  { key: 'department', label: 'Department' },
] as const

export const VRMS_RECENT_COLUMNS = [
  'routingTracker',
  'docTracer',
  'equipmentProduct',
  'status',
  'sentRoutingTo',
  'dateSent',
] as const
