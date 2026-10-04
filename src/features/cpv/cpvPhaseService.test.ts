import { beforeEach, describe, expect, it } from 'vitest'

import { resetCpvPhaseStoreForTests, saveAsset, saveAssetUse, saveHoldRecord, saveHoldRequirement, saveLinkedEvent, saveMaterialDefinition, saveMaterialUsage, saveRecommendation, saveImprovement, saveStabilityStudy, addStabilityTimePoint, saveTestDefinition, saveTestResult } from './cpvPhaseService'
import { resetCpvStoreForTests, saveCpvBatch, saveCpvProduct } from './cpvService'
import { evaluateTestResult, holdTimeDurationHours } from './cpvValidation'

async function seed() {
  const { product } = await saveCpvProduct({
    product_code: 'ACTQ',
    product_name: 'Actiq',
    dosage_form: 'Tablet',
    review_frequency: 'Annual',
  })
  const batch = await saveCpvBatch(product.id, { batch_number: 'B001', status: 'Released', fg_release_date: '2026-03-01' })
  return { product, batch }
}

describe('cpvPhaseService', () => {
  beforeEach(() => {
    resetCpvStoreForTests()
    resetCpvPhaseStoreForTests()
  })

  it('requires a Product Batch Register id for RM usage and allows multiple lots on one batch', async () => {
    const { product, batch } = await seed()
    const material = await saveMaterialDefinition(product.id, {
      kind: 'rm',
      description: 'API',
      item_number: 'RM-1',
      spec_number: 'SPEC-1',
      amount: '10',
      unit: 'kg',
      function_in_formulation: 'Active',
      packaging_level: null,
      approved_suppliers: 'Supplier A',
      critical: true,
      effective_from: '2026-01-01',
      effective_to: null,
    })
    await expect(
      saveMaterialUsage({ material_id: material.id, batch_id: 'missing', po_id: null, lot_number: 'L1', supplier: 'A', quantity: '1', comments: null }),
    ).rejects.toThrow(/Product Batch Register/)
    const first = await saveMaterialUsage({ material_id: material.id, batch_id: batch.id, po_id: null, lot_number: 'L1', supplier: 'A', quantity: '4', comments: null })
    const second = await saveMaterialUsage({ material_id: material.id, batch_id: batch.id, po_id: null, lot_number: 'L2', supplier: 'A', quantity: '6', comments: null })
    expect(first.batch_id).toBe(second.batch_id)
    expect(first.lot_number).not.toBe(second.lot_number)
  })

  it('does not treat a missing numeric result as zero and requires an investigation link for official OOS', async () => {
    expect(evaluateTestResult({ dataType: 'Numeric', result: null, lsl: '0', usl: '10' })).toBe('Not Evaluated')
    expect(evaluateTestResult({ dataType: 'Numeric', result: '12', lsl: '0', usl: '10' })).toBe('Fail')
    expect(() =>
      evaluateTestResult({ dataType: 'Numeric', result: '12', lsl: '0', usl: '10', officialEvent: 'OOS', investigationLink: null }),
    ).toThrow(/investigation link/)
    const { product, batch } = await seed()
    const test = await saveTestDefinition(product.id, {
      kind: 'analytical',
      name: 'Assay',
      classification: 'Finished Product',
      data_type: 'Numeric',
      lsl: '95',
      usl: '105',
      target: '100',
      warning_low: '97',
      warning_high: '103',
      unit: '%',
      method_ref: 'STM-1',
      method_version: 'v2',
      criticality: 'CQA',
      instrument_type: 'HPLC',
      effective_from: '2026-01-01',
      effective_to: null,
    })
    const missing = await saveTestResult({
      definition_id: test.id,
      batch_id: batch.id,
      result: null,
      test_at: '2026-03-02',
      sample_id: 'S1',
      report_ref: 'AR-1',
      instrument: 'HPLC-1',
      csv_ref: null,
      investigation_link: null,
      official_event: null,
      not_applicable: false,
      na_justification: null,
      comments: null,
    })
    expect(missing.evaluation).toBe('Not Evaluated')
    expect(missing.spec_version_applied).toBe('v2')
  })

  it('flags equipment use outside the approved window as of the use date', async () => {
    const { product, batch } = await seed()
    const asset = await saveAsset(product.id, {
      asset_type: 'Equipment',
      name: 'Blender',
      tag: 'EQ-1',
      room: 'R1',
      line: 'L1',
      stage: 'Manufacturing',
      parameter_name: 'Speed',
      lsl: '10',
      usl: '20',
      unit: 'rpm',
      trend_enabled: true,
      qual_report: 'IQOQ-1',
      qual_status: 'Qualified',
      requal_due: '2026-01-15',
      cleaning_sop: 'PECSP-1',
      cleaning_val_ref: 'CV-1',
      cleaning_review_due: '2026-06-01',
      facility_qual_ref: null,
      facility_requal_due: null,
      effective_from: '2025-01-01',
      effective_to: null,
    })
    const use = await saveAssetUse({ asset_id: asset.id, batch_id: batch.id, used_at: '2026-03-01T00:00:00.000Z', parameter_result: '15', comments: null })
    expect(use.window_status).toBe('Overdue')
  })

  it('calculates hold-time duration and excursion against the requirement', async () => {
    expect(holdTimeDurationHours('2026-01-01T00:00:00.000Z', '2026-01-01T08:00:00.000Z')).toBe(8)
    const { product, batch } = await seed()
    await expect(
      saveHoldRequirement(product.id, {
        transition: 'End of manufacturing → Start of packaging',
        min_duration: null,
        max_duration: '4',
        unit: 'hours',
        study_ref: '',
        effective_from: '2026-01-01',
      }),
    ).rejects.toThrow(/SOP reference/)
    const req = await saveHoldRequirement(product.id, {
      transition: 'End of manufacturing → Start of packaging',
      min_duration: null,
      max_duration: '4',
      unit: 'hours',
      study_ref: 'HT-SOP-1',
      effective_from: '2026-01-01',
    })
    const record = await saveHoldRecord({
      product_id: product.id,
      requirement_id: req.id,
      batch_id: batch.id,
      study_batch: null,
      start_at: '2026-03-01T00:00:00.000Z',
      end_at: '2026-03-01T08:00:00.000Z',
    })
    expect(record.duration_hours).toBe(8)
    expect(record.evaluation).toBe('Excursion')
  })

  it('keeps stability copy-forward from copying results and links independent events to batches', async () => {
    const { product, batch } = await seed()
    const study = await saveStabilityStudy(product.id, {
      protocol_ref: 'STB-P-1',
      stability_batch: 'STB-001',
      product_batch_id: batch.id,
      packaging: 'Blister',
      market: 'PH',
      start_date: '2026-01-01',
      status: 'Open',
    })
    const source = await addStabilityTimePoint({
      study_id: study.id,
      condition_label: '30 °C / 75% RH',
      months: 0,
      due_date: '2026-01-01',
      parameter: 'Assay',
      lsl: '95',
      usl: '105',
      unit: '%',
      result: null,
      pull_date: null,
      test_date: null,
      method_version: 'v1',
    })
    const copied = await addStabilityTimePoint({
      study_id: study.id,
      condition_label: '30 °C / 75% RH',
      months: 3,
      due_date: '2026-04-01',
      parameter: null,
      lsl: null,
      usl: null,
      unit: null,
      result: '99',
      pull_date: '2026-04-01',
      test_date: '2026-04-02',
      method_version: null,
      copyFromId: source.id,
    })
    expect(copied.parameter).toBe('Assay')
    expect(copied.result).toBeNull()

    await expect(
      saveLinkedEvent(product.id, {
        kind: 'cnf',
        number: 'CNF-1',
        title: 'Change',
        description: 'Desc',
        category: 'Process',
        risk: 'Minor',
        status: 'Cancelled',
        initiated_at: '2026-01-01',
        target_at: null,
        closed_at: null,
        conclusion: null,
        cancel_or_nfa_reason: null,
        capa_ref: null,
        owner: 'QA',
        batch_ids: [batch.id],
      }),
    ).rejects.toThrow(/Cancellation requires a reason/)

    const complaint = await saveLinkedEvent(product.id, {
      kind: 'complaint',
      number: 'PC-1',
      title: 'Complaint',
      description: 'Odor',
      category: 'Quality',
      risk: 'Major',
      status: 'No Further Action',
      initiated_at: '2026-02-01',
      target_at: null,
      closed_at: '2026-02-10',
      conclusion: 'Not confirmed',
      cancel_or_nfa_reason: 'No retain sample remaining; QA approved NFA.',
      capa_ref: null,
      owner: 'QA',
      batch_ids: [batch.id],
    })
    expect(complaint.batch_ids).toEqual([batch.id])

    const endorsement = await saveImprovement(product.id, {
      number: 'PI-1',
      source_ref: 'CPV-R-1',
      endorsed_at: '2026-04-01',
      summary: 'Tighten IPC',
      owner: 'QA',
      status: 'Open',
    })
    const reco = await saveRecommendation({
      improvement_id: endorsement.id,
      sequence: 1,
      text: 'Add blend uniformity IPC',
      category: 'IPC',
      priority: 'High',
      owner: 'Production',
      target_at: '2026-06-01',
      status: 'Open',
    })
    expect(reco.improvement_id).toBe(endorsement.id)
  })
})
