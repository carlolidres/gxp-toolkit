import { describe, expect, it, beforeEach } from 'vitest'
import { mockVrmsService } from '../services/mockVrmsService'
import { resetVrmsStore } from '../services/vrmsStore'
import type { RoutingDocument } from '../types/vrms'
import { generateUniqueTracker, normalizeSignatories, applySaveDocument, validateRoutingPayload, buildDocumentSearchHaystack } from './vrmsLogic'

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

  it('rejects save when required routing fields are missing', () => {
    expect(() =>
      validateRoutingPayload({
        docTracer: 'TR-1',
        equipmentProduct: '',
        category: 'Equipment',
        status: 'For Scanning',
        sentRoutingTo: 'Steve',
        reportProtocol: 'Report',
        batchNo: 'B-1',
        clientName: 'Client',
        department: 'Validation',
        preparedBy: 'Preparer',
        datePrepared: '2026-06-16',
        checkedBy: 'Checker',
        dateChecked: '2026-06-16',
      }),
    ).toThrow(/Equipment\/Product/)
  })

  it('includes signatory names in document search haystack', () => {
    const haystack = buildDocumentSearchHaystack({
      routingTracker: 'aB3x',
      docTracer: 'TR-1',
      equipmentProduct: 'Mixer',
      category: 'Equipment',
      ilTag: '',
      status: 'Routing',
      sentRoutingTo: 'Steve',
      email: '',
      dateSent: '',
      reportProtocol: 'Report',
      batchNo: 'B-1',
      clientName: 'Client',
      department: 'Validation',
      preparedBy: 'Preparer',
      datePrepared: '2026-06-16',
      checkedBy: 'Checker',
      dateChecked: '2026-06-16',
      targetCompletionDate: '',
      remarks: '',
      signatories: [
        {
          Order: 1,
          Name: 'Isaiah',
          Status: 'Active',
          'Date/time forwarded': '',
          'Date/time signed': '',
          'Duration pending/signing time': '',
        },
      ],
      totalRoutingDuration: '',
      routingCompletedAt: '',
      createdAt: '',
      updatedAt: '',
      updatedBy: '',
    } as RoutingDocument)

    expect(haystack).toContain('isaiah')
    expect(haystack).not.toContain('[object object]')
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
        sentRoutingTo: 'Steve',
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

  it('updates Sent/Routing To on loaded non-routing documents', () => {
    const existing: RoutingDocument = {
      routingTracker: 'krkG',
      docTracer: 'DOC-1',
      equipmentProduct: 'Mixer',
      category: 'Equipment',
      ilTag: 'n/a',
      status: 'Sent',
      sentRoutingTo: 'Fong',
      email: '',
      dateSent: '2026-06-16',
      reportProtocol: 'Protocol',
      batchNo: 'B-1',
      clientName: 'Client',
      department: 'Validation',
      preparedBy: 'Carlo Lidres',
      datePrepared: '2026-06-16',
      checkedBy: 'Carlo Lidres',
      dateChecked: '2026-06-16',
      targetCompletionDate: '',
      remarks: 'n/a',
      signatories: [],
      totalRoutingDuration: '',
      routingCompletedAt: '',
      createdAt: '2026-06-16 08:00:00',
      updatedAt: '2026-06-16 08:00:00',
      updatedBy: 'test@example.com',
    }

    const result = applySaveDocument(
      { ...existing, sentRoutingTo: 'Client', __originalTracker: 'krkG' },
      existing,
      [existing],
      ['Fong', 'Client'],
      'test@example.com',
      new Date('2026-06-16T09:00:00'),
    )

    expect(result.document.sentRoutingTo).toBe('Client')
  })

  it('signs active signatory on production routing document', async () => {
    const signed = await mockVrmsService.signDocumentSignatory('API8', 1, 'carlolidres@gmail.com')
    expect(signed.signedName).toBe('Ernz')
    expect(signed.appData?.documents.find((doc) => doc.routingTracker === 'API8')?.signatories[0].Status).toBe(
      'Signed',
    )
  })
})
