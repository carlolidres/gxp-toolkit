import {
  createHistoryEvent,
  vmpMasterlistSeedRecords,
  type VmpMasterlistRecord,
} from '../lib/vmpMasterlist'
import { formatInstrumentList, instrumentsChanged } from '../lib/vmpQcInstruments'

export interface SaveVmpRecordPayload {
  record: VmpMasterlistRecord
  mode: 'draft' | 'saved'
  expectedVersion?: number
  previousInstruments?: VmpMasterlistRecord['qcInstruments']
}

export interface VmpMasterlistRepository {
  listRecords(): Promise<VmpMasterlistRecord[]>
  getRecordById(id: string): Promise<VmpMasterlistRecord | null>
  getRecordByRecordId(recordId: string): Promise<VmpMasterlistRecord | null>
  saveRecord(payload: SaveVmpRecordPayload, actor: string): Promise<VmpMasterlistRecord>
  archiveRecord(id: string, actor: string): Promise<VmpMasterlistRecord>
  restoreRecord(id: string, actor: string): Promise<VmpMasterlistRecord>
}

let store: VmpMasterlistRecord[] = structuredClone(vmpMasterlistSeedRecords)

function findIndex(id: string): number {
  return store.findIndex((record) => record.id === id)
}

export const mockVmpMasterlistService: VmpMasterlistRepository = {
  async listRecords() {
    return structuredClone(store)
  },

  async getRecordById(id: string) {
    const record = store.find((row) => row.id === id)
    return record ? structuredClone(record) : null
  },

  async getRecordByRecordId(recordId: string) {
    const record = store.find((row) => row.recordId === recordId)
    return record ? structuredClone(record) : null
  },

  async saveRecord(payload: SaveVmpRecordPayload, actor: string) {
    const { record, mode, expectedVersion, previousInstruments = [] } = payload
    const index = findIndex(record.id)
    const now = new Date().toISOString()

    if (index >= 0 && expectedVersion !== undefined && store[index].version !== expectedVersion) {
      throw new Error('This record was updated by another user. Refresh and try again.')
    }

    const duplicateRecordId = store.some(
      (row) => row.recordId === record.recordId && row.id !== record.id,
    )
    if (duplicateRecordId) {
      throw new Error('Record ID must be unique across the masterlist.')
    }

    const saved: VmpMasterlistRecord = {
      ...record,
      isDraft: mode === 'draft',
      version: index >= 0 ? store[index].version + 1 : 1,
      updatedAt: now,
      updatedBy: actor,
      history: [
        ...(instrumentsChanged(previousInstruments, record.qcInstruments ?? [])
          ? [
              createHistoryEvent(
                record,
                'QC instruments updated',
                actor,
                formatInstrumentList(previousInstruments),
                formatInstrumentList(record.qcInstruments ?? []),
                'Associated QC instrument list changed.',
              ),
            ]
          : []),
        createHistoryEvent(
          record,
          mode === 'draft' ? 'Draft saved' : index >= 0 ? 'Record updated' : 'Record saved',
          actor,
          index >= 0 ? store[index].validationStatus : 'Draft',
          record.validationStatus,
          mode === 'draft' ? 'Saved as draft.' : 'Record persisted.',
        ),
        ...record.history,
      ],
    }

    if (index >= 0) {
      store[index] = saved
    } else {
      store = [saved, ...store]
    }

    return structuredClone(saved)
  },

  async archiveRecord(id: string, actor: string) {
    const index = findIndex(id)
    if (index < 0) throw new Error('Record not found.')
    const current = store[index]
    const archived: VmpMasterlistRecord = {
      ...current,
      isArchived: true,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
      history: [
        createHistoryEvent(current, 'Archived', actor, 'Active', 'Archived', 'Record archived.'),
        ...current.history,
      ],
    }
    store[index] = archived
    return structuredClone(archived)
  },

  async restoreRecord(id: string, actor: string) {
    const index = findIndex(id)
    if (index < 0) throw new Error('Record not found.')
    const current = store[index]
    const restored: VmpMasterlistRecord = {
      ...current,
      isArchived: false,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
      history: [
        createHistoryEvent(current, 'Restored', actor, 'Archived', 'Active', 'Record restored.'),
        ...current.history,
      ],
    }
    store[index] = restored
    return structuredClone(restored)
  },
}

/** Reset store for tests. */
export function resetMockVmpMasterlistStore(records = vmpMasterlistSeedRecords) {
  store = structuredClone(records)
}
