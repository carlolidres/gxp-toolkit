import type {
  AuditEvent,
  RoutingDocument,
  SaveRoutingDocumentPayload,
  SignDocumentResult,
  VrmsAppData,
  VrmsRegistryType,
} from '../types/vrms'

export interface VrmsRepository {
  getAppData(userEmail: string): Promise<VrmsAppData>
  getDocumentByTracker(tracker: string): Promise<RoutingDocument>
  saveDocument(payload: SaveRoutingDocumentPayload, userEmail: string): Promise<VrmsAppData>
  signDocumentSignatory(tracker: string, order: number, userEmail: string): Promise<SignDocumentResult>
  getAuditTrail(): Promise<AuditEvent[]>
  addRegistryValue(type: VrmsRegistryType, value: string, userEmail: string): Promise<VrmsAppData>
  deleteRegistryValue(type: VrmsRegistryType, value: string, userEmail: string): Promise<VrmsAppData>
}
