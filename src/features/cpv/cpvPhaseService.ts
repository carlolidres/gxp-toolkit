import { appendCpvAudit, createCpvId } from './cpvAudit'
import { findCpvBatch, findCpvProduct } from './cpvService'
import {
  evaluateAssetWindow,
  evaluateHoldTime,
  evaluateTestResult,
  holdTimeDurationHours,
  stabilityPointStatus,
  trimOrNull,
} from './cpvValidation'
import type {
  CpvAsset,
  CpvAssetUse,
  CpvHoldTimeRecord,
  CpvHoldTimeRequirement,
  CpvImprovement,
  CpvLinkedEvent,
  CpvMaterialDefinition,
  CpvMaterialUsage,
  CpvPhaseCounts,
  CpvRecommendation,
  CpvStabilityStudy,
  CpvStabilityTimePoint,
  CpvTestDefinition,
  CpvTestResult,
} from './phaseTypes'

const PHASE_KEY = 'gxp.cpv.phase.v1'

let materials: CpvMaterialDefinition[] = []
let usages: CpvMaterialUsage[] = []
let assets: CpvAsset[] = []
let assetUses: CpvAssetUse[] = []
let tests: CpvTestDefinition[] = []
let results: CpvTestResult[] = []
let studies: CpvStabilityStudy[] = []
let timePoints: CpvStabilityTimePoint[] = []
let holdReqs: CpvHoldTimeRequirement[] = []
let holdRecords: CpvHoldTimeRecord[] = []
let events: CpvLinkedEvent[] = []
let improvements: CpvImprovement[] = []
let recommendations: CpvRecommendation[] = []

function persist() {
  try {
    sessionStorage.setItem(
      PHASE_KEY,
      JSON.stringify({
        materials,
        usages,
        assets,
        assetUses,
        tests,
        results,
        studies,
        timePoints,
        holdReqs,
        holdRecords,
        events,
        improvements,
        recommendations,
      }),
    )
  } catch {
    // ponytail: session quota
  }
}

function hydrate() {
  try {
    const raw = sessionStorage.getItem(PHASE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, unknown>
    materials = (parsed.materials as CpvMaterialDefinition[]) ?? []
    usages = (parsed.usages as CpvMaterialUsage[]) ?? []
    assets = (parsed.assets as CpvAsset[]) ?? []
    assetUses = (parsed.assetUses as CpvAssetUse[]) ?? []
    tests = (parsed.tests as CpvTestDefinition[]) ?? []
    results = (parsed.results as CpvTestResult[]) ?? []
    studies = (parsed.studies as CpvStabilityStudy[]) ?? []
    timePoints = (parsed.timePoints as CpvStabilityTimePoint[]) ?? []
    holdReqs = (parsed.holdReqs as CpvHoldTimeRequirement[]) ?? []
    holdRecords = (parsed.holdRecords as CpvHoldTimeRecord[]) ?? []
    events = (parsed.events as CpvLinkedEvent[]) ?? []
    improvements = (parsed.improvements as CpvImprovement[]) ?? []
    recommendations = (parsed.recommendations as CpvRecommendation[]) ?? []
  } catch {
    // ignore
  }
}

hydrate()

export function resetCpvPhaseStoreForTests() {
  materials = []
  usages = []
  assets = []
  assetUses = []
  tests = []
  results = []
  studies = []
  timePoints = []
  holdReqs = []
  holdRecords = []
  events = []
  improvements = []
  recommendations = []
  try {
    sessionStorage.removeItem(PHASE_KEY)
  } catch {
    // jsdom
  }
}

function requireProduct(productId: string) {
  const product = findCpvProduct(productId)
  if (!product) throw new Error('Product not found.')
  return product
}

function requireRegisteredBatch(batchId: string) {
  const batch = findCpvBatch(batchId)
  if (!batch) throw new Error('Raw Materials, Packaging Materials, Equipment, IPC, and Analytical Reports must reference a Product Batch Register id.')
  return batch
}

function audit(module: string, recordType: string, record: { id: string; label: string }, field: string, next: string, productId: string, batchId?: string | null) {
  appendCpvAudit({
    action_type: 'create',
    module,
    record_type: recordType,
    record_id: record.id,
    record_label: record.label,
    field_name: field,
    old_value: '(empty)',
    new_value: next,
    product_id: productId,
    batch_id: batchId,
  })
}

export async function saveMaterialDefinition(
  productId: string,
  input: Omit<CpvMaterialDefinition, 'id' | 'product_id' | 'retire_reason' | 'row_version' | 'status'> & { status?: CpvMaterialDefinition['status'] },
  existingId?: string,
): Promise<CpvMaterialDefinition> {
  requireProduct(productId)
  if (!input.description.trim() || !input.item_number.trim()) throw new Error('Material description and item number are required.')
  if (existingId) {
    const idx = materials.findIndex((row) => row.id === existingId && row.product_id === productId)
    if (idx === -1) throw new Error('Material not found.')
    materials[idx] = { ...materials[idx], ...input, description: input.description.trim(), item_number: input.item_number.trim() }
    persist()
    return materials[idx]
  }
  const created: CpvMaterialDefinition = {
    ...input,
    id: createCpvId('mat'),
    product_id: productId,
    description: input.description.trim(),
    item_number: input.item_number.trim(),
    status: input.status ?? 'Active',
    retire_reason: null,
    row_version: 1,
  }
  materials.push(created)
  audit(input.kind === 'rm' ? 'Raw Materials' : 'Packaging Materials', 'material', { id: created.id, label: created.item_number }, 'Item Number', created.item_number, productId)
  persist()
  return created
}

export async function listMaterialDefinitions(productId: string, kind: 'rm' | 'pm') {
  return materials.filter((row) => row.product_id === productId && row.kind === kind)
}

export async function saveMaterialUsage(input: Omit<CpvMaterialUsage, 'id'>): Promise<CpvMaterialUsage> {
  const material = materials.find((row) => row.id === input.material_id)
  if (!material) throw new Error('Material definition not found.')
  requireRegisteredBatch(input.batch_id)
  if (!input.lot_number.trim()) throw new Error('Lot/control number is required.')
  const created: CpvMaterialUsage = {
    ...input,
    id: createCpvId('usage'),
    lot_number: input.lot_number.trim(),
    supplier: trimOrNull(input.supplier),
    quantity: trimOrNull(input.quantity),
    comments: trimOrNull(input.comments),
  }
  usages.push(created)
  audit(material.kind === 'rm' ? 'Raw Materials' : 'Packaging Materials', 'material_usage', { id: created.id, label: created.lot_number }, 'Lot Number', created.lot_number, material.product_id, created.batch_id)
  persist()
  return created
}

export async function listMaterialUsages(productId: string, kind: 'rm' | 'pm') {
  const ids = new Set(materials.filter((row) => row.product_id === productId && row.kind === kind).map((row) => row.id))
  return usages.filter((row) => ids.has(row.material_id))
}

export async function saveAsset(productId: string, input: Omit<CpvAsset, 'id' | 'product_id' | 'retire_reason' | 'status'> & { status?: CpvAsset['status'] }, existingId?: string): Promise<CpvAsset> {
  requireProduct(productId)
  if (!input.name.trim()) throw new Error('Asset name is required.')
  if (existingId) {
    const idx = assets.findIndex((row) => row.id === existingId && row.product_id === productId)
    if (idx === -1) throw new Error('Asset not found.')
    assets[idx] = { ...assets[idx], ...input, name: input.name.trim() }
    persist()
    return assets[idx]
  }
  const created: CpvAsset = {
    ...input,
    id: createCpvId('asset'),
    product_id: productId,
    name: input.name.trim(),
    status: input.status ?? 'Active',
    retire_reason: null,
  }
  assets.push(created)
  audit('Equipment / Rooms / Lines', 'asset', { id: created.id, label: created.name }, 'Name', created.name, productId)
  persist()
  return created
}

export async function listAssets(productId: string) {
  return assets.filter((row) => row.product_id === productId)
}

export async function saveAssetUse(input: Omit<CpvAssetUse, 'id' | 'window_status'>): Promise<CpvAssetUse> {
  const asset = assets.find((row) => row.id === input.asset_id)
  if (!asset) throw new Error('Asset not found.')
  requireRegisteredBatch(input.batch_id)
  if (!input.used_at.trim()) throw new Error('Date of use is required.')
  const dues = [asset.requal_due, asset.cleaning_review_due, asset.facility_requal_due].filter(Boolean) as string[]
  const earliestDue = dues.sort()[0] ?? null
  const created: CpvAssetUse = {
    ...input,
    id: createCpvId('ause'),
    used_at: input.used_at,
    window_status: evaluateAssetWindow(input.used_at, earliestDue),
  }
  assetUses.push(created)
  audit('Equipment / Rooms / Lines', 'asset_use', { id: created.id, label: asset.name }, 'Date of Use', created.used_at, asset.product_id, created.batch_id)
  persist()
  return created
}

export async function listAssetUses(productId: string) {
  const ids = new Set(assets.filter((row) => row.product_id === productId).map((row) => row.id))
  return assetUses.filter((row) => ids.has(row.asset_id))
}

export async function saveTestDefinition(
  productId: string,
  input: Omit<CpvTestDefinition, 'id' | 'product_id' | 'retire_reason' | 'status'> & { status?: CpvTestDefinition['status'] },
): Promise<CpvTestDefinition> {
  requireProduct(productId)
  if (!input.name.trim()) throw new Error('Testing parameter is required.')
  const created: CpvTestDefinition = {
    ...input,
    id: createCpvId('test'),
    product_id: productId,
    name: input.name.trim(),
    status: input.status ?? 'Active',
    retire_reason: null,
  }
  tests.push(created)
  audit(input.kind === 'ipc' ? 'IPC' : 'Analytical Reports', 'test', { id: created.id, label: created.name }, 'Parameter', created.name, productId)
  persist()
  return created
}

export async function listTestDefinitions(productId: string, kind: 'ipc' | 'analytical') {
  return tests.filter((row) => row.product_id === productId && row.kind === kind)
}

export async function saveTestResult(input: Omit<CpvTestResult, 'id' | 'evaluation' | 'spec_version_applied'>): Promise<CpvTestResult> {
  const definition = tests.find((row) => row.id === input.definition_id)
  if (!definition) throw new Error('Test definition not found.')
  requireRegisteredBatch(input.batch_id)
  const evaluation = evaluateTestResult({
    dataType: definition.data_type,
    result: input.result,
    lsl: definition.lsl,
    usl: definition.usl,
    warningLow: definition.warning_low,
    warningHigh: definition.warning_high,
    notApplicable: input.not_applicable,
    naJustification: input.na_justification,
    officialEvent: input.official_event,
    investigationLink: input.investigation_link,
  })
  const created: CpvTestResult = {
    ...input,
    id: createCpvId('tres'),
    result: trimOrNull(input.result),
    evaluation,
    spec_version_applied: definition.method_version,
  }
  results.push(created)
  audit(definition.kind === 'ipc' ? 'IPC' : 'Analytical Reports', 'test_result', { id: created.id, label: definition.name }, 'Result', created.result ?? '(empty)', definition.product_id, created.batch_id)
  persist()
  return created
}

export async function listTestResults(productId: string, kind: 'ipc' | 'analytical') {
  const ids = new Set(tests.filter((row) => row.product_id === productId && row.kind === kind).map((row) => row.id))
  return results.filter((row) => ids.has(row.definition_id))
}

export async function saveStabilityStudy(productId: string, input: Omit<CpvStabilityStudy, 'id' | 'product_id'>): Promise<CpvStabilityStudy> {
  requireProduct(productId)
  if (!input.protocol_ref.trim() || !input.stability_batch.trim()) throw new Error('Stability protocol and stability batch number are required.')
  if (input.product_batch_id) requireRegisteredBatch(input.product_batch_id)
  const created: CpvStabilityStudy = {
    ...input,
    id: createCpvId('stab'),
    product_id: productId,
    protocol_ref: input.protocol_ref.trim(),
    stability_batch: input.stability_batch.trim(),
  }
  studies.push(created)
  audit('Stability', 'stability_study', { id: created.id, label: created.stability_batch }, 'Stability Batch', created.stability_batch, productId, created.product_batch_id)
  persist()
  return created
}

export async function listStabilityStudies(productId: string) {
  return studies.filter((row) => row.product_id === productId)
}

export async function addStabilityTimePoint(input: Omit<CpvStabilityTimePoint, 'id' | 'status'> & { copyFromId?: string }): Promise<CpvStabilityTimePoint> {
  const study = studies.find((row) => row.id === input.study_id)
  if (!study) throw new Error('Stability study not found.')
  const template = input.copyFromId ? timePoints.find((row) => row.id === input.copyFromId) : null
  const created: CpvStabilityTimePoint = {
    id: createCpvId('stp'),
    study_id: input.study_id,
    condition_label: input.condition_label,
    months: input.months,
    due_date: input.due_date,
    parameter: input.parameter ?? template?.parameter ?? null,
    lsl: input.lsl ?? template?.lsl ?? null,
    usl: input.usl ?? template?.usl ?? null,
    unit: input.unit ?? template?.unit ?? null,
    result: null,
    pull_date: null,
    test_date: null,
    method_version: input.method_version ?? template?.method_version ?? null,
    status: stabilityPointStatus(input.due_date, null),
  }
  timePoints.push(created)
  persist()
  return created
}

export async function saveStabilityResult(timePointId: string, input: Pick<CpvStabilityTimePoint, 'result' | 'pull_date' | 'test_date' | 'parameter' | 'lsl' | 'usl' | 'unit' | 'method_version'>): Promise<CpvStabilityTimePoint> {
  const idx = timePoints.findIndex((row) => row.id === timePointId)
  if (idx === -1) throw new Error('Time point not found.')
  timePoints[idx] = {
    ...timePoints[idx],
    ...input,
    status: stabilityPointStatus(timePoints[idx].due_date, input.result),
  }
  persist()
  return timePoints[idx]
}

export async function listStabilityTimePoints(studyId: string) {
  return timePoints
    .filter((row) => row.study_id === studyId)
    .map((row) => ({ ...row, status: row.status === 'Cancelled' ? row.status : stabilityPointStatus(row.due_date, row.result) }))
}

export async function saveHoldRequirement(productId: string, input: Omit<CpvHoldTimeRequirement, 'id' | 'product_id' | 'status'> & { status?: CpvHoldTimeRequirement['status'] }): Promise<CpvHoldTimeRequirement> {
  requireProduct(productId)
  if (!input.transition.trim()) throw new Error('Hold-time transition is required.')
  if (!input.study_ref.trim()) throw new Error('Hold-time requirements require a study, protocol, report, or SOP reference.')
  if (!input.max_duration.trim()) throw new Error('Maximum hold-time is required.')
  const created: CpvHoldTimeRequirement = {
    ...input,
    id: createCpvId('holdq'),
    product_id: productId,
    transition: input.transition.trim(),
    study_ref: input.study_ref.trim(),
    status: input.status ?? 'Active',
  }
  holdReqs.push(created)
  audit('Hold-Time Monitoring', 'hold_requirement', { id: created.id, label: created.transition }, 'Study/SOP Reference', created.study_ref, productId)
  persist()
  return created
}

export async function listHoldRequirements(productId: string) {
  return holdReqs.filter((row) => row.product_id === productId)
}

export async function saveHoldRecord(input: Omit<CpvHoldTimeRecord, 'id' | 'duration_hours' | 'evaluation'>): Promise<CpvHoldTimeRecord> {
  const requirement = holdReqs.find((row) => row.id === input.requirement_id)
  if (!requirement) throw new Error('Hold-time requirement not found.')
  if (input.batch_id) requireRegisteredBatch(input.batch_id)
  if (!input.batch_id && !input.study_batch?.trim()) throw new Error('Link a product batch or enter a study batch identifier.')
  const duration = holdTimeDurationHours(input.start_at, input.end_at)
  const created: CpvHoldTimeRecord = {
    ...input,
    id: createCpvId('holdr'),
    duration_hours: duration,
    evaluation: evaluateHoldTime(duration, requirement.max_duration, requirement.unit, requirement.min_duration),
  }
  holdRecords.push(created)
  audit('Hold-Time Monitoring', 'hold_record', { id: created.id, label: requirement.transition }, 'Evaluation', created.evaluation, input.product_id, created.batch_id)
  persist()
  return created
}

export async function listHoldRecords(productId: string) {
  return holdRecords.filter((row) => row.product_id === productId)
}

export async function saveLinkedEvent(productId: string, input: Omit<CpvLinkedEvent, 'id' | 'product_id'>): Promise<CpvLinkedEvent> {
  requireProduct(productId)
  if (!input.number.trim() || !input.title.trim() || !input.description.trim()) throw new Error('Number, title, and description are required.')
  if (input.status === 'Cancelled' && !input.cancel_or_nfa_reason?.trim()) throw new Error('Cancellation requires a reason.')
  if (input.status === 'No Further Action' && !input.cancel_or_nfa_reason?.trim()) throw new Error('No Further Action requires a documented justification.')
  for (const batchId of input.batch_ids) requireRegisteredBatch(batchId)
  const created: CpvLinkedEvent = {
    ...input,
    id: createCpvId(input.kind),
    product_id: productId,
    number: input.number.trim(),
    title: input.title.trim(),
    description: input.description.trim(),
  }
  events.push(created)
  audit(input.kind === 'cnf' ? 'CNF' : input.kind === 'complaint' ? 'Product Complaints' : 'Deviation Reports', 'event', { id: created.id, label: created.number }, 'Number', created.number, productId)
  persist()
  return created
}

export async function listLinkedEvents(productId: string, kind: CpvLinkedEvent['kind']) {
  return events.filter((row) => row.product_id === productId && row.kind === kind)
}

export async function saveImprovement(productId: string, input: Omit<CpvImprovement, 'id' | 'product_id'>): Promise<CpvImprovement> {
  requireProduct(productId)
  if (!input.number.trim() || !input.summary.trim()) throw new Error('Endorsement number and summary are required.')
  const created: CpvImprovement = {
    ...input,
    id: createCpvId('imp'),
    product_id: productId,
    number: input.number.trim(),
    summary: input.summary.trim(),
  }
  improvements.push(created)
  audit('Process Improvement Monitoring', 'improvement', { id: created.id, label: created.number }, 'Number', created.number, productId)
  persist()
  return created
}

export async function listImprovements(productId: string) {
  return improvements.filter((row) => row.product_id === productId)
}

export async function saveRecommendation(input: Omit<CpvRecommendation, 'id'>): Promise<CpvRecommendation> {
  const parent = improvements.find((row) => row.id === input.improvement_id)
  if (!parent) throw new Error('Endorsement report not found.')
  if (!input.text.trim()) throw new Error('Recommendation text is required.')
  const created: CpvRecommendation = {
    ...input,
    id: createCpvId('reco'),
    text: input.text.trim(),
  }
  recommendations.push(created)
  audit('Process Improvement Monitoring', 'recommendation', { id: created.id, label: `${parent.number}-${created.sequence}` }, 'Recommendation', created.text, parent.product_id)
  persist()
  return created
}

export async function listRecommendations(improvementId: string) {
  return recommendations.filter((row) => row.improvement_id === improvementId)
}

export async function listProductProfileFacts(): Promise<{
  holdReqs: CpvHoldTimeRequirement[]
  tests: CpvTestDefinition[]
  results: CpvTestResult[]
}> {
  return {
    holdReqs: holdReqs.filter((row) => row.status !== 'Retired'),
    tests: tests.filter((row) => row.status !== 'Retired'),
    results: results.slice(),
  }
}

export async function listPhaseCounts(productId: string): Promise<CpvPhaseCounts> {
  return {
    raw_materials: usages.filter((row) => materials.some((item) => item.id === row.material_id && item.product_id === productId && item.kind === 'rm')).length,
    packaging_materials: usages.filter((row) => materials.some((item) => item.id === row.material_id && item.product_id === productId && item.kind === 'pm')).length,
    equipment: assetUses.filter((row) => assets.some((item) => item.id === row.asset_id && item.product_id === productId)).length,
    ipc: results.filter((row) => tests.some((item) => item.id === row.definition_id && item.product_id === productId && item.kind === 'ipc')).length,
    analytical: results.filter((row) => tests.some((item) => item.id === row.definition_id && item.product_id === productId && item.kind === 'analytical')).length,
    stability: studies.filter((row) => row.product_id === productId).length,
    hold_time: holdRecords.filter((row) => row.product_id === productId).length,
    cnf: events.filter((row) => row.product_id === productId && row.kind === 'cnf').length,
    complaints: events.filter((row) => row.product_id === productId && row.kind === 'complaint').length,
    deviations: events.filter((row) => row.product_id === productId && row.kind === 'deviation').length,
    improvements: improvements.filter((row) => row.product_id === productId).length,
  }
}
