import {
  applySaveDocument,
  applySignDocumentSignatory,
  formatVrmsDisplayDateTime,
  isValidRegistryValue,
} from '../utils/vrmsLogic'
import type { VrmsRepository } from './vrmsRepository'
import {
  appendAuditEvent,
  buildAppData,
  ensureStoreRegistryDefaults,
  findDocumentByTracker,
  getAllowedSignatoryNames,
  getStatusRegistry,
  getVrmsStore,
  mockDelay,
  upsertDocument,
} from './vrmsStore'

export const mockVrmsService: VrmsRepository = {
  async getAppData(userEmail) {
    await mockDelay()
    return buildAppData(userEmail)
  },

  async getDocumentByTracker(tracker) {
    await mockDelay()
    ensureStoreRegistryDefaults()
    const found = findDocumentByTracker(tracker)
    if (!found) throw new Error(`No document found for tracking number: ${tracker}`)
    return structuredClone(found)
  },

  async saveDocument(payload, userEmail) {
    await mockDelay(300)
    ensureStoreRegistryDefaults()
    const store = getVrmsStore()
    const originalTracker = String(payload.__originalTracker || payload.routingTracker || '').trim()
    const existing = originalTracker ? findDocumentByTracker(originalTracker) : undefined

    const { document, auditAction, auditDetails } = applySaveDocument(
      payload,
      existing,
      store.documents,
      getAllowedSignatoryNames(),
      userEmail,
    )

    upsertDocument(document)
    appendAuditEvent(auditAction, document.routingTracker, document.docTracer, auditDetails, userEmail)
    return buildAppData(userEmail)
  },

  async signDocumentSignatory(tracker, order, userEmail) {
    await mockDelay(300)
    ensureStoreRegistryDefaults()
    const existing = findDocumentByTracker(tracker)
    if (!existing) throw new Error(`No document found for tracking number: ${tracker}`)

    const { document, result, auditDetails } = applySignDocumentSignatory(
      existing,
      order,
      getAllowedSignatoryNames(),
      getStatusRegistry(),
      userEmail,
    )

    upsertDocument(document)
    appendAuditEvent('Signed routing signatory', document.routingTracker, document.docTracer, auditDetails, userEmail)

    const appData = buildAppData(userEmail)
    return { ...result, appData }
  },

  async getAuditTrail() {
    await mockDelay()
    ensureStoreRegistryDefaults()
    return structuredClone(getVrmsStore().auditEvents)
  },

  async addRegistryValue(type, value, userEmail) {
    await mockDelay(250)
    ensureStoreRegistryDefaults()
    const trimmed = String(value || '').trim()
    if (!trimmed) throw new Error('Value is required.')
    if (!isValidRegistryValue(trimmed)) {
      throw new Error(
        'Registry values can only contain readable text, numbers, spaces, and common punctuation.',
      )
    }

    const store = getVrmsStore()
    const exists = store.registryValues.some(
      (row) => row.registryType === type && row.value.toLowerCase() === trimmed.toLowerCase(),
    )
    if (!exists) {
      store.registryValues.push({
        id: `reg-${Date.now()}`,
        registryType: type,
        value: trimmed,
      })
      appendAuditEvent(
        'Added registry value',
        '',
        '',
        `${type} registry value "${trimmed}" was added by ${userEmail} on ${formatVrmsDisplayDateTime(new Date())}.`,
        userEmail,
      )
    }

    return buildAppData(userEmail)
  },

  async deleteRegistryValue(type, value, userEmail) {
    await mockDelay(250)
    ensureStoreRegistryDefaults()
    const trimmed = String(value || '').trim()
    const store = getVrmsStore()
    const index = store.registryValues.findIndex(
      (row) => row.registryType === type && row.value.trim() === trimmed,
    )
    if (index !== -1) {
      store.registryValues.splice(index, 1)
      appendAuditEvent(
        'Deleted registry value',
        '',
        '',
        `${type} registry value "${trimmed}" was removed by ${userEmail} on ${formatVrmsDisplayDateTime(new Date())}.`,
        userEmail,
      )
    }

    return buildAppData(userEmail)
  },
}
