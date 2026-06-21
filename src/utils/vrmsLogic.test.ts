import { describe, expect, it, beforeEach } from 'vitest'
import { mockVrmsService } from '../services/mockVrmsService'
import { resetVrmsStore } from '../services/vrmsStore'
import { generateUniqueTracker, normalizeSignatories, applySaveDocument } from './vrmsLogic'

describe('vrmsLogic', () => {
  it('generates unique 4-character trackers', () => {
    const tracker = generateUniqueTracker(['aB3x', 'k9Zm'])
    expect(tracker).toHaveLength(4)
    expect(['aB3x', 'k9Zm']).not.toContain(tracker)
  })

  it('normalizes signatories and activates first routing recipient', () => {
    const now = new Date('2026-06-16T10:00:00')
    const rows = normalizeSignatories(
      [{ Order: 1, Name: 'Steve', Status: 'Pending', 'Date/time forwarded': '', 'Date/time signed': '', 'Duration pending/signing time': '' }],
      [],
      now,
      true,
      true,
      ['Steve', 'Isaiah'],
    )
    expect(rows[0].Status).toBe('Active')
    expect(rows[0]['Date/time forwarded']).toBe('2026-06-16 10:00:00')
  })

  it('rejects signatory names outside Sent/Routing registry', () => {
    expect(() =>
      normalizeSignatories(
        [{ Order: 1, Name: 'Unknown', Status: 'Pending', 'Date/time forwarded': '', 'Date/time signed': '', 'Duration pending/signing time': '' }],
        [],
        new Date(),
        true,
        true,
        ['Steve'],
      ),
    ).toThrow(/not in the Sent\/Routing To registry/)
  })
})

describe('mockVrmsService', () => {
  beforeEach(() => {
    resetVrmsStore()
  })

  it('loads app data with dashboard metrics', async () => {
    const data = await mockVrmsService.getAppData('carlolidres@gmail.com')
    expect(data.documents.length).toBe(112)
    expect(data.dashboard.total).toBe(112)
    expect(data.registries.Status).toContain('Routing')
  })

  it('creates a document with generated tracker', async () => {
    const data = await mockVrmsService.saveDocument(
      {
        docTracer: 'TR-NEW-001',
        equipmentProduct: 'Mixer M-1',
        category: 'Equipment',
        status: 'For Scanning',
        sentRoutingTo: '',
        reportProtocol: 'Report',
        batchNo: 'B-9999',
        clientName: 'Client A',
        department: 'Validation',
        preparedBy: 'Carlo Lidres',
        datePrepared: '2026-06-16',
        checkedBy: 'Carlo Lidres',
        dateChecked: '2026-06-16',
        signatories: [],
      },
      'carlolidres@gmail.com',
    )

    const created = data.documents.find((doc) => doc.docTracer === 'TR-NEW-001')
    expect(created?.routingTracker).toHaveLength(4)
  })

  it('requires signatories when saving Routing status', () => {
    expect(() =>
      applySaveDocument(
        {
          docTracer: 'TR-FAIL',
          equipmentProduct: 'X',
          category: 'Process',
          status: 'Routing',
          sentRoutingTo: 'Steve',
          reportProtocol: 'Report',
          batchNo: 'B-1',
          clientName: 'Client A',
          department: 'QA',
          preparedBy: 'Carlo Lidres',
          datePrepared: '2026-06-16',
          checkedBy: 'Carlo Lidres',
          dateChecked: '2026-06-16',
          signatories: [],
        },
        undefined,
        [],
        ['Steve'],
        'test@example.com',
      ),
    ).toThrow(/at least one signatory/)
  })

  it('signs active signatory on production routing document', async () => {
    const signed = await mockVrmsService.signDocumentSignatory('API8', 1, 'carlolidres@gmail.com')
    expect(signed.signedName).toBe('Ernz')
    expect(signed.appData?.documents.find((doc) => doc.routingTracker === 'API8')?.signatories[0].Status).toBe(
      'Signed',
    )
  })
})
