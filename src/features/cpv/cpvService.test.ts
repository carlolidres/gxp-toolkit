import { beforeEach, describe, expect, it } from 'vitest'

import { listCpvAuditEvents, setCpvActor } from './cpvAudit'
import {
  addCpvPackagingOrder,
  approveCpvProtocol,
  approveCpvReport,
  approveOfficialPosture,
  copyCpvBatch,
  generateCpvReport,
  getFrozenReportSnapshot,
  ensureCpvProductFromApqr,
  listCpvBatches,
  listCpvProducts,
  resetCpvStoreForTests,
  retireCpvProduct,
  reviseCpvProtocol,
  saveCpvBatch,
  saveCpvProduct,
  saveCpvProtocol,
  submitCpvProtocol,
  submitCpvReport,
} from './cpvService'
import { chronologyIssues } from './cpvValidation'

const signoff = { printedName: 'QA Reviewer', meaning: 'Approval of this controlled CPV record' }

async function seedProduct() {
  const { product } = await saveCpvProduct({
    product_code: 'TAB-001',
    product_name: 'Example Tablet',
    dosage_form: 'Tablet',
    review_frequency: 'Annual',
    effective_date: '2026-01-01',
  })
  return product
}

describe('cpvService', () => {
  beforeEach(() => {
    resetCpvStoreForTests()
  })

  it('rejects duplicate product codes and warns on duplicate names', async () => {
    await seedProduct()
    await expect(
      saveCpvProduct({
        product_code: 'TAB-001',
        product_name: 'Different Name',
        dosage_form: 'Tablet',
        review_frequency: 'Annual',
      }),
    ).rejects.toThrow(/Duplicate product code/)

    const second = await saveCpvProduct({
      product_code: 'TAB-002',
      product_name: 'Example Tablet',
      dosage_form: 'Tablet',
      review_frequency: 'Annual',
    })
    expect(second.nameWarning).toMatch(/warning only/i)
  })

  it('opens an APQR product into an existing CPV profile instead of creating a duplicate', async () => {
    const first = await ensureCpvProductFromApqr({
      product_code: 'abc-1',
      product_name: 'Current Name',
      client_name: 'Zuellig Pharma',
    })
    const second = await ensureCpvProductFromApqr({
      product_code: 'ABC-1',
      product_name: 'Should Not Replace',
      client_name: 'Other',
    })
    expect(second.product.id).toBe(first.product.id)
    expect(second.product.product_name).toBe('Current Name')
    expect((await listCpvProducts()).filter((row) => row.product_code === 'ABC-1')).toHaveLength(1)
  })

  it('keeps unique product+batch numbers and stores multiple POs on one batch', async () => {
    const product = await seedProduct()
    const batch = await saveCpvBatch(product.id, { batch_number: 'B001', status: 'Planned' })
    await expect(saveCpvBatch(product.id, { batch_number: 'B001', status: 'Planned' })).rejects.toThrow(
      /already has that unique batch number/,
    )
    await addCpvPackagingOrder(batch.id, 'PO-1')
    await addCpvPackagingOrder(batch.id, 'PO-2')
    const listed = await listCpvBatches(product.id)
    expect(listed).toHaveLength(1)
    expect(listed[0].packaging_orders.map((po) => po.po_control_number)).toEqual(['PO-1', 'PO-2'])
  })

  it('requires a date exception when chronology is inverted', async () => {
    expect(
      chronologyIssues({
        batch_number: 'B001',
        status: 'Planned',
        manufacturing_start_at: '2026-02-02T00:00:00.000Z',
        manufacturing_end_at: '2026-02-01T00:00:00.000Z',
      }),
    ).not.toHaveLength(0)

    const product = await seedProduct()
    await expect(
      saveCpvBatch(product.id, {
        batch_number: 'B002',
        status: 'In Process',
        manufacturing_start_at: '2026-02-02T00:00:00.000Z',
        manufacturing_end_at: '2026-02-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(/date exception reason/)

    const saved = await saveCpvBatch(product.id, {
      batch_number: 'B002',
      status: 'In Process',
      manufacturing_start_at: '2026-02-02T00:00:00.000Z',
      manufacturing_end_at: '2026-02-01T00:00:00.000Z',
      date_exception_reason: 'Campaign overlap documented in deviation DR-1',
    })
    expect(saved.date_exception_reason).toContain('DR-1')
  })

  it('copy-forward defaults to comments and does not copy dates unless selected', async () => {
    const product = await seedProduct()
    const source = await saveCpvBatch(product.id, {
      batch_number: 'B010',
      status: 'Released',
      comments: 'Template comments',
      fg_release_date: '2026-03-01',
      mo_control_number: 'MO-9',
    })
    await expect(
      copyCpvBatch(product.id, {
        sourceBatchId: source.id,
        target: { batch_number: 'B011', status: 'Planned' },
        confirmed: false,
        selectedFields: ['comments'],
      }),
    ).rejects.toThrow(/confirmation/)

    const copied = await copyCpvBatch(product.id, {
      sourceBatchId: source.id,
      target: { batch_number: 'B011', status: 'Planned' },
      confirmed: true,
      selectedFields: ['comments'],
    })
    expect(copied.comments).toBe('Template comments')
    expect(copied.fg_release_date).toBeNull()
    expect(copied.mo_control_number).toBeNull()
    expect(copied.status).toBe('Planned')
  })

  it('blocks Admin and authors from approving protocols and reports', async () => {
    const product = await seedProduct()
    const protocol = await saveCpvProtocol({
      product_id: product.id,
      title: 'Annual CPV protocol',
      review_period_start: '2026-01-01',
      review_period_end: '2026-12-31',
    })
    await submitCpvProtocol(protocol.id)

    setCpvActor({ id: 'tester', name: 'Test User', email: 'tester@local', role: 'Manager' })
    await expect(approveCpvProtocol(protocol.id, signoff)).rejects.toThrow(/author cannot approve/)

    setCpvActor({ id: 'admin', name: 'Admin', email: 'admin@local', role: 'Admin' })
    await expect(approveCpvProtocol(protocol.id, signoff)).rejects.toThrow(/System administration/)

    setCpvActor({ id: 'qa', name: 'QA Approver', email: 'qa@local', role: 'Manager' })
    const approved = await approveCpvProtocol(protocol.id, signoff)
    expect(approved.status).toBe('Approved/Effective')
    await expect(saveCpvProtocol({ product_id: product.id, title: 'tamper' }, approved.id)).rejects.toThrow(
      /immutable/,
    )
  })

  it('freezes report snapshots on generation and keeps them after approval', async () => {
    const product = await seedProduct()
    await saveCpvBatch(product.id, { batch_number: 'B100', status: 'Released', fg_release_date: '2026-06-01' })
    const protocol = await saveCpvProtocol({
      product_id: product.id,
      title: 'Annual CPV protocol',
      review_period_start: '2026-01-01',
      review_period_end: '2026-12-31',
    })
    await submitCpvProtocol(protocol.id)
    setCpvActor({ id: 'qa', name: 'QA Approver', email: 'qa@local', role: 'Manager' })
    const approvedProtocol = await approveCpvProtocol(protocol.id, signoff)

    setCpvActor({ id: 'author-2', name: 'Report Author', email: 'author2@local', role: 'Editor' })
    const report = await generateCpvReport(approvedProtocol.id)
    expect(report.included_batch_count).toBe(1)
    const frozen = getFrozenReportSnapshot(report.id)
    expect(frozen?.included_batch_ids).toHaveLength(1)

    await saveCpvBatch(product.id, { batch_number: 'B101', status: 'Released', fg_release_date: '2026-07-01' })
    expect(getFrozenReportSnapshot(report.id)?.included_batch_ids).toEqual(frozen?.included_batch_ids)

    await submitCpvReport(report.id)
    setCpvActor({ id: 'qa', name: 'QA Approver', email: 'qa@local', role: 'Manager' })
    const approvedReport = await approveCpvReport(report.id, signoff)
    expect(approvedReport.status).toBe('Approved/Effective')
    expect(approvedReport.snapshot?.included_batch_ids).toEqual(frozen?.included_batch_ids)
  })

  it('records audit old/new values and retire reasons, and revisions supersede approved protocols', async () => {
    const product = await seedProduct()
    await retireCpvProduct(product.id, 'End of commercial supply')
    const events = listCpvAuditEvents({ recordType: 'product', actionType: 'retire' })
    expect(events[0]?.old_value).toBe('Draft')
    expect(events[0]?.new_value).toBe('Retired')
    expect(events[0]?.reason).toBe('End of commercial supply')

    const live = await saveCpvProduct({
      product_code: 'CAP-009',
      product_name: 'Capsule Nine',
      dosage_form: 'Capsule',
      review_frequency: 'Quarterly',
    })
    const protocol = await saveCpvProtocol({ product_id: live.product.id, title: 'Q protocol' })
    await submitCpvProtocol(protocol.id)
    setCpvActor({ id: 'qa', name: 'QA Approver', email: 'qa@local', role: 'Manager' })
    await approveCpvProtocol(protocol.id, signoff)
    const revision = await reviseCpvProtocol(protocol.id)
    expect(revision.version).toBe(2)
    expect(revision.status).toBe('Draft')
    expect(revision.superseded_protocol_id).toBe(protocol.id)
  })

  it('prevents Admin from approving official posture', async () => {
    const product = await seedProduct()
    setCpvActor({ id: 'admin', name: 'Admin', email: 'admin@local', role: 'Admin' })
    await expect(
      approveOfficialPosture(product.id, 'Valid', 'Looks complete', signoff),
    ).rejects.toThrow(/System administration/)
  })
})
