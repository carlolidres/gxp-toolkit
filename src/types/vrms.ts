export type VrmsProfileRole = 'user' | 'admin' | 'manager' | 'editor' | 'viewer'

export interface VrmsProfile {
  id: string
  email: string
  displayName: string
  role: VrmsProfileRole
}

export type VrmsDocumentStatus =
  | 'Routing'
  | 'Completed'
  | 'Fully Signed'
  | 'For Scanning'
  | 'Sent'
  | 'In EDMS'
  | 'Returned to'
  | 'Cancelled'
  | 'Blank'
  | ''

export type VrmsSignatoryStatus = 'Pending' | 'Active' | 'Signed'

export interface VrmsSignatory {
  Order: number
  Name: string
  Status: VrmsSignatoryStatus
  'Date/time forwarded': string
  'Date/time signed': string
  'Duration pending/signing time': string
}

export interface RoutingDocument {
  routingTracker: string
  docTracer: string
  equipmentProduct: string
  category: string
  ilTag: string
  status: VrmsDocumentStatus
  sentRoutingTo: string
  email: string
  dateSent: string
  reportProtocol: string
  batchNo: string
  clientName: string
  department: string
  preparedBy: string
  datePrepared: string
  checkedBy: string
  dateChecked: string
  targetCompletionDate: string
  remarks: string
  signatories: VrmsSignatory[]
  totalRoutingDuration: string
  routingCompletedAt: string
  createdAt: string
  updatedAt: string
  updatedBy: string
}

export type VrmsRegistryType =
  | 'Status'
  | 'Sent / Routing'
  | 'Report / Protocol'
  | 'Client'
  | 'Category'
  | 'Department'
  | 'Prepared by'
  | 'Checked by'

export interface RegistryValue {
  id: string
  registryType: VrmsRegistryType
  value: string
}

export interface AuditEvent {
  id: string
  timestamp: string
  userEmail: string
  action: string
  routingTracker: string
  docTracer: string
  details: string
}

export interface VrmsDashboardMetrics {
  total: number
  routing: number
  forScanning: number
  sent: number
  inEdms: number
  cancelled: number
  overdue: number
  avgAging: number
  statusCounts: Record<string, number>
  kpi: VrmsSignatoryKpi[]
  recent: RoutingDocument[]
  active: RoutingDocument[]
}

export interface VrmsSignatoryKpi {
  name: string
  signed: number
  avgDuration: string
  avgDurationMinutes: number
  pending: number
  completed: number
}

export interface VrmsAppData {
  documents: RoutingDocument[]
  registries: Record<VrmsRegistryType, string[]>
  dashboard: VrmsDashboardMetrics
  user: string
}

export interface SaveRoutingDocumentPayload {
  routingTracker?: string
  docTracer: string
  equipmentProduct: string
  category: string
  ilTag?: string
  status: VrmsDocumentStatus
  sentRoutingTo: string
  email?: string
  dateSent?: string
  reportProtocol: string
  batchNo: string
  clientName: string
  department: string
  preparedBy: string
  datePrepared: string
  checkedBy: string
  dateChecked: string
  targetCompletionDate?: string
  remarks?: string
  signatories: VrmsSignatory[]
  __originalTracker?: string
}

export interface SignDocumentResult {
  signedName: string
  nextName: string
  final: boolean
  status: VrmsDocumentStatus
  appData?: VrmsAppData
}
