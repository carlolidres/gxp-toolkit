import type { VrmsRegistryType } from '../types/vrms'
import { VRMS_PRODUCTION_DEFAULT_REGISTRY } from '../data/vrmsProductionData'

export const VRMS_APP_TITLE = 'Validation Routing Monitoring System'

export const VRMS_OPTIONAL_NA_FIELDS = ['IL-Tag', 'Remarks'] as const

export const VRMS_REGISTRY_TYPES: Record<VrmsRegistryType, string> = {
  Status: 'Registry_Status',
  'Sent / Routing': 'Registry_SentRouting',
  'Report / Protocol': 'Registry_ReportProtocol',
  Client: 'Registry_Client',
  Category: 'Registry_Category',
  Department: 'Registry_Department',
  'Prepared by': 'Registry_PreparedBy',
  'Checked by': 'Registry_CheckedBy',
}

/** Production registry values from reference/VRMSdatabase/ CSV exports */
export const VRMS_DEFAULT_REGISTRY = {
  ...VRMS_PRODUCTION_DEFAULT_REGISTRY,
} as Record<VrmsRegistryType, string[]>

export const VRMS_REQUIRED_FORM_FIELDS = [
  'docTracer',
  'equipmentProduct',
  'category',
  'status',
  'sentRoutingTo',
  'reportProtocol',
  'batchNo',
  'clientName',
  'department',
  'preparedBy',
  'datePrepared',
  'checkedBy',
  'dateChecked',
] as const

export const VRMS_REGISTRY_FIELD_MAP: Record<string, VrmsRegistryType> = {
  status: 'Status',
  sentRoutingTo: 'Sent / Routing',
  reportProtocol: 'Report / Protocol',
  clientName: 'Client',
  category: 'Category',
  department: 'Department',
  preparedBy: 'Prepared by',
  checkedBy: 'Checked by',
}

export const VRMS_AUTO_REFRESH_MS = 15_000
