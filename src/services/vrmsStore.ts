import {
  buildMockVrmsAppData,
  buildRegistriesFromValues,
  buildVrmsDashboard,
  mockAuditEvents,
  mockRegistryValues,
  mockRoutingDocuments,
} from '../data/mockVrms'
import type { AuditEvent, RegistryValue, RoutingDocument, VrmsAppData } from '../types/vrms'
import { ensureDefaultRegistryValues, formatVrmsDateTime } from '../utils/vrmsLogic'

export interface VrmsStoreState {
  documents: RoutingDocument[]
  registryValues: RegistryValue[]
  auditEvents: AuditEvent[]
}

let store: VrmsStoreState = createInitialStore()

function createInitialStore(): VrmsStoreState {
  return {
    documents: structuredClone(mockRoutingDocuments),
    registryValues: structuredClone(mockRegistryValues),
    auditEvents: structuredClone(mockAuditEvents),
  }
}

export function resetVrmsStore(): void {
  store = createInitialStore()
}

export function getVrmsStore(): VrmsStoreState {
  return store
}

export function ensureStoreRegistryDefaults(): void {
  const withDefaults = ensureDefaultRegistryValues(
    store.registryValues.map((row) => ({ registryType: row.registryType, value: row.value })),
  )

  const existingIds = new Set(store.registryValues.map((row) => `${row.registryType}::${row.value.toLowerCase()}`))
  withDefaults.forEach((row) => {
    const key = `${row.registryType}::${row.value.toLowerCase()}`
    if (!existingIds.has(key)) {
      store.registryValues.push({
        id: `reg-auto-${store.registryValues.length + 1}`,
        registryType: row.registryType as RegistryValue['registryType'],
        value: row.value,
      })
      existingIds.add(key)
    }
  })
}

export function buildAppData(userEmail: string): VrmsAppData {
  ensureStoreRegistryDefaults()
  return {
    documents: structuredClone(store.documents),
    registries: buildRegistriesFromValues(store.registryValues),
    dashboard: buildVrmsDashboard(store.documents),
    user: userEmail,
  }
}

export function getAllowedSignatoryNames(): string[] {
  ensureStoreRegistryDefaults()
  return buildRegistriesFromValues(store.registryValues)['Sent / Routing'] ?? []
}

export function getStatusRegistry(): string[] {
  ensureStoreRegistryDefaults()
  return buildRegistriesFromValues(store.registryValues).Status ?? []
}

export function appendAuditEvent(
  action: string,
  routingTracker: string,
  docTracer: string,
  details: string,
  userEmail: string,
  now = new Date(),
): AuditEvent {
  const event: AuditEvent = {
    id: `audit-${Date.now()}-${store.auditEvents.length + 1}`,
    timestamp: formatVrmsDateTime(now),
    userEmail,
    action,
    routingTracker,
    docTracer,
    details,
  }
  store.auditEvents.unshift(event)
  return event
}

export function upsertDocument(document: RoutingDocument): void {
  const index = store.documents.findIndex((row) => row.routingTracker === document.routingTracker)
  if (index === -1) store.documents.push(document)
  else store.documents[index] = document
}

export function findDocumentByTracker(tracker: string): RoutingDocument | undefined {
  return store.documents.find((row) => row.routingTracker.trim() === tracker.trim())
}

export async function mockDelay(ms = 200): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/** Test helper — seed store without touching exported mocks */
export function replaceVrmsStore(next: Partial<VrmsStoreState>): void {
  store = {
    documents: next.documents ?? structuredClone(mockRoutingDocuments),
    registryValues: next.registryValues ?? structuredClone(mockRegistryValues),
    auditEvents: next.auditEvents ?? structuredClone(mockAuditEvents),
  }
}

export function buildEmptyAppData(userEmail: string): VrmsAppData {
  return buildMockVrmsAppData([], userEmail)
}
