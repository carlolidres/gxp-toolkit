import { describe, expect, it } from 'vitest'
import { buildVrmsDashboard } from './mockVrms'
import type { RoutingDocument } from '../types/vrms'

function documentWithSignatories(signatories: RoutingDocument['signatories']): RoutingDocument {
  return {
    routingTracker: 'TEST',
    docTracer: 'DOC-1',
    equipmentProduct: 'Equipment',
    category: 'Category',
    ilTag: '',
    status: 'Routing',
    sentRoutingTo: 'Steve',
    email: '',
    dateSent: '2026-06-01',
    reportProtocol: 'Report',
    batchNo: '',
    clientName: '',
    department: '',
    preparedBy: '',
    datePrepared: '',
    checkedBy: '',
    dateChecked: '',
    targetCompletionDate: '',
    remarks: '',
    signatories,
    totalRoutingDuration: '',
    routingCompletedAt: '',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    updatedBy: '',
  }
}

describe('buildVrmsDashboard', () => {
  it('averages signed signatory pending durations by person', () => {
    const dashboard = buildVrmsDashboard([
      documentWithSignatories([
        {
          Order: 1,
          Name: 'Steve',
          Status: 'Signed',
          'Date/time forwarded': '2026-06-01 08:00:00',
          'Date/time signed': '2026-06-02 10:30:00',
          'Duration pending/signing time': '1 day 2 hrs 30 mins',
        },
        {
          Order: 2,
          Name: 'Fong',
          Status: 'Pending',
          'Date/time forwarded': '',
          'Date/time signed': '',
          'Duration pending/signing time': '',
        },
      ]),
      documentWithSignatories([
        {
          Order: 1,
          Name: 'Steve',
          Status: 'Signed',
          'Date/time forwarded': '2026-06-03 08:00:00',
          'Date/time signed': '2026-06-03 08:30:00',
          'Duration pending/signing time': '30 mins',
        },
      ]),
    ])

    const steve = dashboard.kpi.find((row) => row.name === 'Steve')
    const fong = dashboard.kpi.find((row) => row.name === 'Fong')

    expect(steve).toMatchObject({
      signed: 2,
      avgDurationMinutes: 810,
      avgDuration: '13 hrs 30 mins',
      pending: 0,
    })
    expect(fong).toMatchObject({
      signed: 0,
      avgDurationMinutes: -1,
      avgDuration: 'N/A',
      pending: 1,
    })
  })
})
