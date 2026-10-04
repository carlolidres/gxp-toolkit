import type { UserRole } from '../../types/auth'
import {
  appendCpvAudit,
  auditFieldChanges,
  createCpvId,
  getCpvActor,
  listCpvAuditEvents,
  nowUtcIso,
  resetCpvAuditForTests,
  setCpvActor,
} from './cpvAudit'
import { formatBatchSizeLabel, normalizeBatchSizes } from './batchSizes'
import { normalizeReportEntries } from './reportEntries'
import { normalizeHoldEntries } from './holdEntries'
import { emptyCppMonitoring, normalizeCppMonitoring } from './cppMonitoring'
import {
  calculateProposedPosture,
  chronologyIssues,
  nextReviewDue,
  normalizeCode,
  requireDateException,
  trimOrNull,
} from './cpvValidation'
import type {
  CpvActor,
  CpvAuditFilter,
  CpvBatch,
  CpvBatchInput,
  CpvCopyForwardRequest,
  CpvPackagingOrder,
  CpvProduct,
  CpvProductInput,
  CpvProductSaveResult,
  CpvProtocol,
  CpvProtocolInput,
  CpvReport,
  CpvReportSnapshot,
  CpvSignoff,
} from './types'
import { COPY_FORWARD_RESTRICTED_FIELDS, COPY_FORWARD_SAFE_FIELDS } from './types'

let products: CpvProduct[] = []
let batches: CpvBatch[] = []
let packagingOrders: CpvPackagingOrder[] = []
let protocols: CpvProtocol[] = []
let reports: CpvReport[] = []

const CPV_MEMORY_KEY = 'gxp.cpv.memory.v1'

function persistCpvStore() {
  try {
    sessionStorage.setItem(
      CPV_MEMORY_KEY,
      JSON.stringify({ products, batches, packagingOrders, protocols, reports }),
    )
  } catch {
    // ponytail: session quota; in-memory remains until Supabase
  }
}

function hydrateCpvStore() {
  try {
    const raw = sessionStorage.getItem(CPV_MEMORY_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as {
      products?: CpvProduct[]
      batches?: CpvBatch[]
      packagingOrders?: CpvPackagingOrder[]
      protocols?: CpvProtocol[]
      reports?: CpvReport[]
    }
    products = (parsed.products ?? []).map((product) => ({
      ...product,
      alternate_batch_sizes: Array.isArray(product.alternate_batch_sizes) ? product.alternate_batch_sizes : [],
      report_entries: Array.isArray(product.report_entries) ? product.report_entries : [],
      hold_entries: Array.isArray(product.hold_entries)
        ? product.hold_entries.map((entry) => ({
            report_ref: entry.report_ref ?? '',
            issued_date: entry.issued_date ?? '',
            hold_time: entry.hold_time ?? '',
          }))
        : [],
      cpp_monitoring:
        product.cpp_monitoring && Array.isArray(product.cpp_monitoring.steps)
          ? {
              vmp_report_no: product.cpp_monitoring.vmp_report_no ?? '',
              issued_date: product.cpp_monitoring.issued_date ?? '',
              steps: product.cpp_monitoring.steps,
            }
          : emptyCppMonitoring(),
    }))
    batches = parsed.batches ?? []
    packagingOrders = parsed.packagingOrders ?? []
    protocols = parsed.protocols ?? []
    reports = parsed.reports ?? []
  } catch {
    // ignore corrupt session cache
  }
}

hydrateCpvStore()

const PRODUCT_FIELDS = [
  { key: 'product_code', label: 'Product Code' },
  { key: 'product_name', label: 'Product Name' },
  { key: 'generic_name', label: 'Generic Name' },
  { key: 'dosage_form', label: 'Dosage Form' },
  { key: 'strength', label: 'Strength' },
  { key: 'batch_size', label: 'Batch Size' },
  { key: 'batch_size_unit', label: 'Batch Size Unit' },
  { key: 'client_owner', label: 'Client/Owner' },
  { key: 'manufacturing_site', label: 'Manufacturing Site' },
  { key: 'packaging_site', label: 'Packaging Site' },
  { key: 'markets', label: 'Markets' },
  { key: 'registration_number', label: 'Registration Number' },
  { key: 'review_frequency', label: 'CPV Review Frequency' },
  { key: 'pv_protocol_ref', label: 'Process Validation Protocol' },
  { key: 'pv_report_ref', label: 'Process Validation Report' },
  { key: 'effective_date', label: 'Effective Date' },
  { key: 'status', label: 'Status' },
  { key: 'review_period_start', label: 'Review Period Start' },
  { key: 'review_period_end', label: 'Review Period End' },
  { key: 'next_review_due', label: 'Next Review Due' },
]

const BATCH_FIELDS = [
  { key: 'batch_number', label: 'Batch Number' },
  { key: 'mo_control_number', label: 'MO Control Number' },
  { key: 'manufacturing_start_at', label: 'Manufacturing Start' },
  { key: 'manufacturing_end_at', label: 'Manufacturing End' },
  { key: 'packaging_start_at', label: 'Packaging Start' },
  { key: 'packaging_end_at', label: 'Packaging End' },
  { key: 'fg_release_date', label: 'FG Release Date' },
  { key: 'status', label: 'Batch Status' },
  { key: 'comments', label: 'Comments' },
  { key: 'date_exception_reason', label: 'Date Exception Reason' },
]

function actor(): CpvActor {
  return getCpvActor()
}

function assertNotViewer(action: string) {
  if (actor().role === 'Viewer') throw new Error(`Viewers cannot ${action}.`)
}

function assertCanMutate(action: string) {
  assertNotViewer(action)
}

function assertCanApprove(authorId: string | null, recordLabel: string) {
  const who = actor()
  if (who.role === 'Admin') {
    throw new Error('System administration does not grant CPV protocol, report, or posture approval.')
  }
  if (who.role === 'Viewer' || who.role === 'Editor') {
    throw new Error(`You do not have permission to approve ${recordLabel}.`)
  }
  if (authorId && who.id === authorId) {
    throw new Error(`The author cannot approve ${recordLabel}.`)
  }
}

function requireSignoff(signoff: CpvSignoff | undefined, action: string) {
  if (!signoff?.printedName.trim() || !signoff.meaning.trim()) {
    throw new Error(`${action} requires typed name and meaning of signature.`)
  }
}

function hydrateBatch(batch: CpvBatch): CpvBatch {
  return {
    ...batch,
    packaging_orders: packagingOrders.filter((po) => po.batch_id === batch.id),
  }
}

function refreshProductDerived(product: CpvProduct): CpvProduct {
  const liveBatches = batches.filter((batch) => batch.product_id === product.id && !batch.voided)
  const hasOfficial = product.official_posture_approved_at != null
  product.open_critical_items = liveBatches.length === 0 ? 1 : 0
  product.proposed_posture = calculateProposedPosture(liveBatches.length, hasOfficial)
  return product
}

function assertRowVersion(current: number, incoming?: number) {
  if (incoming != null && incoming !== current) {
    throw new Error('This record was updated by someone else. Reload and try again.')
  }
}

function nextDocumentNumber(prefix: string, existing: Array<{ protocol_number?: string; report_number?: string }>, key: 'protocol_number' | 'report_number') {
  const year = new Date().getUTCFullYear()
  let max = 0
  for (const row of existing) {
    const value = row[key]
    const match = new RegExp(`^${prefix}-${year}-(\\d+)$`).exec(value ?? '')
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `${prefix}-${year}-${String(max + 1).padStart(3, '0')}`
}

function batchesInReviewPeriod(product: CpvProduct, start: string | null, end: string | null) {
  const productBatches = batches.filter((batch) => batch.product_id === product.id && !batch.voided)
  if (!start || !end) {
    return { included: productBatches, excluded: [] as CpvBatch[] }
  }
  const included = productBatches.filter((batch) => {
    if (!batch.fg_release_date) return false
    return batch.fg_release_date >= start && batch.fg_release_date <= end
  })
  const excluded = productBatches.filter((batch) => !included.includes(batch))
  return { included, excluded }
}

export function resetCpvStoreForTests() {
  products = []
  batches = []
  packagingOrders = []
  protocols = []
  reports = []
  try {
    sessionStorage.removeItem(CPV_MEMORY_KEY)
  } catch {
    // jsdom may omit sessionStorage
  }
  resetCpvAuditForTests()
  setCpvActor({ id: 'tester', name: 'Test User', email: 'tester@local', role: 'Manager' })
}

export async function listCpvProducts(): Promise<CpvProduct[]> {
  return products.map((product) => ({ ...refreshProductDerived(product) }))
}

export async function ensureCpvProductFromApqr(input: {
  product_code: string
  product_name: string
  client_name?: string | null
}): Promise<CpvProductSaveResult> {
  const product_code = normalizeCode(input.product_code).toUpperCase()
  const existing = products.find((row) => row.product_code.toLowerCase() === product_code.toLowerCase())
  if (existing) return { product: refreshProductDerived(existing) }
  return saveCpvProduct({
    product_code,
    product_name: input.product_name,
    client_owner: input.client_name,
    dosage_form: 'Other',
    review_frequency: 'Annual',
    status: 'Active',
  })
}

/** Keeps the CPV row joined to an APQR product after its name or code changes. */
export function renameCpvProductIdentity(currentCode: string, productCode: string, productName: string): void {
  const from = currentCode.trim().toUpperCase()
  const nextCode = productCode.trim().toUpperCase()
  const nextName = productName.trim()
  const idx = products.findIndex((row) => row.product_code.toUpperCase() === from)
  if (idx === -1) return
  assertCanMutate('update product details')
  if (!nextCode) throw new Error('Product code is required.')
  if (!nextName) throw new Error('Product name is required.')
  const duplicate = products.find((row) => row.product_code.toUpperCase() === nextCode && row.id !== products[idx].id)
  if (duplicate) throw new Error('That product code is already used.')
  const previous = products[idx]
  if (previous.product_code === nextCode && previous.product_name === nextName) return
  const updated: CpvProduct = {
    ...previous,
    product_code: nextCode,
    product_name: nextName,
    row_version: previous.row_version + 1,
    updated_at: nowUtcIso(),
    updated_by: actor().id,
  }
  products[idx] = updated
  auditFieldChanges('product', updated.id, updated.product_code, previous as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, PRODUCT_FIELDS, {
    productId: updated.id,
    module: 'Product Profile',
  })
  persistCpvStore()
}

export async function getCpvProduct(productId: string): Promise<CpvProduct | null> {
  const product = products.find((row) => row.id === productId)
  return product ? { ...refreshProductDerived(product) } : null
}

export async function saveCpvProduct(input: CpvProductInput, existingId?: string): Promise<CpvProductSaveResult> {
  assertCanMutate('save products')
  const product_code = normalizeCode(input.product_code).toUpperCase()
  const product_name = input.product_name.trim()
  if (!product_code) throw new Error('Product code is required.')
  if (!product_name) throw new Error('Product name is required.')
  if (!input.dosage_form.trim()) throw new Error('Dosage form is required.')

  const duplicateCode = products.find((row) => row.product_code.toLowerCase() === product_code.toLowerCase() && row.id !== existingId)
  if (duplicateCode) throw new Error('Duplicate product code is not allowed.')

  const nameWarning = products.some(
    (row) => row.product_name.toLowerCase() === product_name.toLowerCase() && row.id !== existingId,
  )
    ? 'A product with this name already exists. The record was saved because duplicate names are a warning only.'
    : undefined

  const ts = nowUtcIso()
  const who = actor()
  const nextReview = input.next_review_due?.trim() || nextReviewDue(input.effective_date ?? null, input.review_frequency)

  if (existingId) {
    const idx = products.findIndex((row) => row.id === existingId)
    if (idx === -1) throw new Error('Product not found.')
    const previous = products[idx]
    if (previous.status === 'Retired' && input.status !== 'Retired') {
      throw new Error('Retired products cannot be reactivated in this release. Create a new product record.')
    }
    const updated: CpvProduct = {
      ...previous,
      product_code,
      product_name,
      generic_name: trimOrNull(input.generic_name),
      dosage_form: input.dosage_form.trim(),
      strength: trimOrNull(input.strength),
      batch_size: trimOrNull(input.batch_size),
      batch_size_unit: trimOrNull(input.batch_size_unit),
      alternate_batch_sizes: input.alternate_batch_sizes ?? previous.alternate_batch_sizes ?? [],
      client_owner: trimOrNull(input.client_owner),
      manufacturing_site: trimOrNull(input.manufacturing_site),
      packaging_site: trimOrNull(input.packaging_site),
      markets: trimOrNull(input.markets),
      registration_number: trimOrNull(input.registration_number),
      review_frequency: input.review_frequency,
      pv_protocol_ref: trimOrNull(input.pv_protocol_ref),
      pv_report_ref: trimOrNull(input.pv_report_ref),
      effective_date: trimOrNull(input.effective_date),
      status: input.status ?? previous.status,
      review_period_start: trimOrNull(input.review_period_start),
      review_period_end: trimOrNull(input.review_period_end),
      next_review_due: nextReview,
      row_version: previous.row_version + 1,
      updated_at: ts,
      updated_by: who.id,
    }
    products[idx] = updated
    auditFieldChanges('product', updated.id, updated.product_code, previous as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, PRODUCT_FIELDS, {
      productId: updated.id,
      module: 'Product Profile',
    })
    persistCpvStore()
    return { product: refreshProductDerived(updated), nameWarning }
  }

  const created: CpvProduct = {
    id: createCpvId('product'),
    product_code,
    product_name,
    generic_name: trimOrNull(input.generic_name),
    dosage_form: input.dosage_form.trim(),
    strength: trimOrNull(input.strength),
    batch_size: trimOrNull(input.batch_size),
    batch_size_unit: trimOrNull(input.batch_size_unit),
    alternate_batch_sizes: input.alternate_batch_sizes ?? [],
    report_entries: input.report_entries ?? [],
    hold_entries: input.hold_entries ?? [],
    cpp_monitoring: input.cpp_monitoring ?? emptyCppMonitoring(),
    client_owner: trimOrNull(input.client_owner),
    manufacturing_site: trimOrNull(input.manufacturing_site),
    packaging_site: trimOrNull(input.packaging_site),
    markets: trimOrNull(input.markets),
    registration_number: trimOrNull(input.registration_number),
    review_frequency: input.review_frequency,
    pv_protocol_ref: trimOrNull(input.pv_protocol_ref),
    pv_report_ref: trimOrNull(input.pv_report_ref),
    effective_date: trimOrNull(input.effective_date),
    status: input.status ?? 'Draft',
    retire_reason: null,
    proposed_posture: 'Not Assessed',
    official_posture: 'Not Assessed',
    official_posture_rationale: null,
    official_posture_approved_by: null,
    official_posture_approved_at: null,
    review_period_start: trimOrNull(input.review_period_start),
    review_period_end: trimOrNull(input.review_period_end),
    next_review_due: nextReview,
    last_assessment_at: null,
    open_critical_items: 1,
    row_version: 1,
    created_at: ts,
    updated_at: ts,
    created_by: who.id,
    updated_by: who.id,
  }
  products.push(created)
  appendCpvAudit({
    action_type: 'create',
    product_id: created.id,
    module: 'Product Profile',
    record_type: 'product',
    record_id: created.id,
    record_label: created.product_code,
    field_name: 'Product Code',
    old_value: '(empty)',
    new_value: created.product_code,
  })
  persistCpvStore()
  return { product: refreshProductDerived(created), nameWarning }
}

export async function saveCpvBatchSizes(
  productId: string,
  commercialSize: string,
  commercialUnit: string,
  alternates: Array<{ size: string; unit: string }>,
): Promise<CpvProduct> {
  assertCanMutate('save batch sizes')
  const parsed = normalizeBatchSizes(commercialSize, commercialUnit, alternates)
  const idx = products.findIndex((row) => row.id === productId)
  if (idx === -1) throw new Error('Product not found.')
  const previous = products[idx]
  const ts = nowUtcIso()
  const who = actor()
  const updated: CpvProduct = {
    ...previous,
    batch_size: parsed.batch_size,
    batch_size_unit: parsed.batch_size_unit,
    alternate_batch_sizes: parsed.alternate_batch_sizes,
    row_version: previous.row_version + 1,
    updated_at: ts,
    updated_by: who.id,
  }
  products[idx] = updated
  const oldLabel = formatBatchSizeLabel(previous.batch_size, previous.batch_size_unit, previous.alternate_batch_sizes ?? [])
  const newLabel = formatBatchSizeLabel(updated.batch_size, updated.batch_size_unit, updated.alternate_batch_sizes)
  if (oldLabel !== newLabel) {
    appendCpvAudit({
      action_type: 'edit',
      product_id: updated.id,
      module: 'Product Profile',
      record_type: 'product',
      record_id: updated.id,
      record_label: updated.product_code,
      field_name: 'Batch Size',
      old_value: oldLabel === '—' ? '(empty)' : oldLabel,
      new_value: newLabel === '—' ? '(empty)' : newLabel,
    })
  }
  persistCpvStore()
  return refreshProductDerived(updated)
}

function reportLogLabel(entries: Array<{ tracer_no: string; issued_date: string; remarks: string }>): string {
  if (!entries.length) return '(empty)'
  return entries.map((entry) => `${entry.tracer_no} · ${entry.issued_date}${entry.remarks ? ` · ${entry.remarks}` : ''}`).join('; ')
}

export async function saveCpvReportEntries(
  productId: string,
  rows: Array<{ tracer_no: string; issued_date: string; remarks: string }>,
): Promise<CpvProduct> {
  assertCanMutate('save report entries')
  const parsed = normalizeReportEntries(rows)
  const idx = products.findIndex((row) => row.id === productId)
  if (idx === -1) throw new Error('Product not found.')
  const previous = products[idx]
  const ts = nowUtcIso()
  const who = actor()
  const updated: CpvProduct = {
    ...previous,
    report_entries: parsed,
    row_version: previous.row_version + 1,
    updated_at: ts,
    updated_by: who.id,
  }
  products[idx] = updated
  const oldLabel = reportLogLabel(previous.report_entries ?? [])
  const newLabel = reportLogLabel(parsed)
  if (oldLabel !== newLabel) {
    appendCpvAudit({
      action_type: 'edit',
      product_id: updated.id,
      module: 'Product Profile',
      record_type: 'product',
      record_id: updated.id,
      record_label: updated.product_code,
      field_name: 'Report Entries',
      old_value: oldLabel,
      new_value: newLabel,
    })
  }
  persistCpvStore()
  return refreshProductDerived(updated)
}

function holdLogLabel(entries: Array<{ report_ref: string; issued_date?: string; hold_time: string }>): string {
  if (!entries.length) return '(empty)'
  return entries.map((entry) => [entry.report_ref, entry.issued_date, entry.hold_time].filter(Boolean).join(' · ')).join('; ')
}

export async function saveCpvHoldEntries(
  productId: string,
  rows: Array<{ report_ref: string; issued_date?: string; hold_time: string }>,
): Promise<CpvProduct> {
  assertCanMutate('save hold entries')
  const parsed = normalizeHoldEntries(rows)
  const idx = products.findIndex((row) => row.id === productId)
  if (idx === -1) throw new Error('Product not found.')
  const previous = products[idx]
  const ts = nowUtcIso()
  const who = actor()
  const updated: CpvProduct = {
    ...previous,
    hold_entries: parsed,
    row_version: previous.row_version + 1,
    updated_at: ts,
    updated_by: who.id,
  }
  products[idx] = updated
  const oldLabel = holdLogLabel(previous.hold_entries ?? [])
  const newLabel = holdLogLabel(parsed)
  if (oldLabel !== newLabel) {
    appendCpvAudit({
      action_type: 'edit',
      product_id: updated.id,
      module: 'Product Profile',
      record_type: 'product',
      record_id: updated.id,
      record_label: updated.product_code,
      field_name: 'Hold Entries',
      old_value: oldLabel,
      new_value: newLabel,
    })
  }
  persistCpvStore()
  return refreshProductDerived(updated)
}

export async function saveCpvCppMonitoring(
  productId: string,
  input: { vmp_report_no: string; issued_date: string; steps: Array<{ step_no: string; description: string; cpp: string }> },
): Promise<CpvProduct> {
  assertCanMutate('save CPP monitoring')
  const parsed = normalizeCppMonitoring(input)
  const idx = products.findIndex((row) => row.id === productId)
  if (idx === -1) throw new Error('Product not found.')
  const previous = products[idx]
  const ts = nowUtcIso()
  const who = actor()
  const updated: CpvProduct = {
    ...previous,
    cpp_monitoring: parsed,
    row_version: previous.row_version + 1,
    updated_at: ts,
    updated_by: who.id,
  }
  products[idx] = updated
  const oldParts = [
    previous.cpp_monitoring?.vmp_report_no,
    previous.cpp_monitoring?.issued_date,
    previous.cpp_monitoring?.steps.length ? `${previous.cpp_monitoring.steps.length} steps` : '',
  ].filter(Boolean)
  const newParts = [parsed.vmp_report_no, parsed.issued_date, parsed.steps.length ? `${parsed.steps.length} steps` : ''].filter(Boolean)
  const oldLabel = oldParts.length ? oldParts.join(' · ') : '(empty)'
  const newLabel = newParts.length ? newParts.join(' · ') : '(empty)'
  if (oldLabel !== newLabel) {
    appendCpvAudit({
      action_type: 'edit',
      product_id: updated.id,
      module: 'Product Profile',
      record_type: 'product',
      record_id: updated.id,
      record_label: updated.product_code,
      field_name: 'CPP Monitoring',
      old_value: oldLabel,
      new_value: newLabel,
    })
  }
  persistCpvStore()
  return refreshProductDerived(updated)
}

export async function retireCpvProduct(productId: string, reason: string): Promise<CpvProduct> {
  assertCanMutate('retire products')
  if (!reason.trim()) throw new Error('Retire requires a reason.')
  const idx = products.findIndex((row) => row.id === productId)
  if (idx === -1) throw new Error('Product not found.')
  const previous = products[idx]
  const updated: CpvProduct = {
    ...previous,
    status: 'Retired',
    retire_reason: reason.trim(),
    row_version: previous.row_version + 1,
    updated_at: nowUtcIso(),
    updated_by: actor().id,
  }
  products[idx] = updated
  appendCpvAudit({
    action_type: 'retire',
    product_id: updated.id,
    module: 'Product Profile',
    record_type: 'product',
    record_id: updated.id,
    record_label: updated.product_code,
    field_name: 'Status',
    old_value: previous.status,
    new_value: 'Retired',
    reason: reason.trim(),
  })
  persistCpvStore()
  return refreshProductDerived(updated)
}

export async function approveOfficialPosture(
  productId: string,
  posture: CpvProduct['official_posture'],
  rationale: string,
  signoff: CpvSignoff,
): Promise<CpvProduct> {
  requireSignoff(signoff, 'Official posture approval')
  if (!rationale.trim()) throw new Error('Official posture requires a rationale.')
  const idx = products.findIndex((row) => row.id === productId)
  if (idx === -1) throw new Error('Product not found.')
  const previous = products[idx]
  assertCanApprove(previous.created_by, 'official validation posture')
  const ts = nowUtcIso()
  const updated: CpvProduct = {
    ...previous,
    official_posture: posture,
    official_posture_rationale: rationale.trim(),
    official_posture_approved_by: actor().name,
    official_posture_approved_at: ts,
    last_assessment_at: ts,
    row_version: previous.row_version + 1,
    updated_at: ts,
    updated_by: actor().id,
  }
  products[idx] = updated
  appendCpvAudit({
    action_type: 'approve',
    product_id: updated.id,
    module: 'Product Profile',
    record_type: 'product',
    record_id: updated.id,
    record_label: updated.product_code,
    field_name: 'Official Posture',
    old_value: previous.official_posture,
    new_value: posture,
    reason: `${signoff.meaning.trim()} — ${rationale.trim()}`,
  })
  persistCpvStore()
  return refreshProductDerived(updated)
}

export async function listCpvBatches(productId: string): Promise<CpvBatch[]> {
  return batches.filter((batch) => batch.product_id === productId).map(hydrateBatch)
}

export function findCpvProduct(productId: string): CpvProduct | null {
  const product = products.find((row) => row.id === productId)
  return product ? refreshProductDerived(product) : null
}

export function findCpvBatch(batchId: string): CpvBatch | null {
  const batch = batches.find((row) => row.id === batchId)
  return batch ? hydrateBatch(batch) : null
}

export async function saveCpvBatch(productId: string, input: CpvBatchInput, existingId?: string): Promise<CpvBatch> {
  assertCanMutate('save batches')
  const product = products.find((row) => row.id === productId)
  if (!product) throw new Error('Product not found.')
  if (product.status === 'Retired') throw new Error('Cannot add batches to a retired product.')
  const batch_number = normalizeCode(input.batch_number)
  if (!batch_number) throw new Error('Batch number is required.')
  requireDateException(input)

  const duplicate = batches.find(
    (row) => row.product_id === productId && row.batch_number.toLowerCase() === batch_number.toLowerCase() && row.id !== existingId,
  )
  if (duplicate) throw new Error('This product already has that unique batch number.')

  const ts = nowUtcIso()
  const who = actor()
  if (existingId) {
    const idx = batches.findIndex((row) => row.id === existingId && row.product_id === productId)
    if (idx === -1) throw new Error('Batch not found.')
    const previous = batches[idx]
    if (previous.voided) throw new Error('Voided batches cannot be edited.')
    assertRowVersion(previous.row_version, input.row_version)
    const updated: CpvBatch = {
      ...previous,
      batch_number,
      mo_control_number: trimOrNull(input.mo_control_number),
      manufacturing_start_at: trimOrNull(input.manufacturing_start_at),
      manufacturing_end_at: trimOrNull(input.manufacturing_end_at),
      packaging_start_at: trimOrNull(input.packaging_start_at),
      packaging_end_at: trimOrNull(input.packaging_end_at),
      fg_release_date: trimOrNull(input.fg_release_date),
      status: input.status,
      comments: trimOrNull(input.comments),
      date_exception_reason: trimOrNull(input.date_exception_reason),
      row_version: previous.row_version + 1,
      updated_at: ts,
      updated_by: who.id,
      packaging_orders: [],
    }
    batches[idx] = updated
    auditFieldChanges('batch', updated.id, updated.batch_number, previous as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, BATCH_FIELDS, {
      productId,
      batchId: updated.id,
      module: 'Product Batches',
    })
    persistCpvStore()
    return hydrateBatch(updated)
  }

  const created: CpvBatch = {
    id: createCpvId('batch'),
    product_id: productId,
    batch_number,
    mo_control_number: trimOrNull(input.mo_control_number),
    manufacturing_start_at: trimOrNull(input.manufacturing_start_at),
    manufacturing_end_at: trimOrNull(input.manufacturing_end_at),
    packaging_start_at: trimOrNull(input.packaging_start_at),
    packaging_end_at: trimOrNull(input.packaging_end_at),
    fg_release_date: trimOrNull(input.fg_release_date),
    status: input.status,
    comments: trimOrNull(input.comments),
    date_exception_reason: trimOrNull(input.date_exception_reason),
    voided: false,
    void_reason: null,
    row_version: 1,
    created_at: ts,
    updated_at: ts,
    created_by: who.id,
    updated_by: who.id,
    packaging_orders: [],
  }
  batches.push(created)
  appendCpvAudit({
    action_type: 'create',
    product_id: productId,
    batch_id: created.id,
    module: 'Product Batches',
    record_type: 'batch',
    record_id: created.id,
    record_label: created.batch_number,
    field_name: 'Batch Number',
    old_value: '(empty)',
    new_value: created.batch_number,
    reason: chronologyIssues(input).length ? created.date_exception_reason : null,
  })
  persistCpvStore()
  return hydrateBatch(created)
}

export async function copyCpvBatch(productId: string, request: CpvCopyForwardRequest): Promise<CpvBatch> {
  if (!request.confirmed) throw new Error('Copy-forward requires confirmation.')
  const source = batches.find((row) => row.id === request.sourceBatchId && row.product_id === productId)
  if (!source) throw new Error('Source batch not found.')
  const selected = new Set(request.selectedFields)
  const target: CpvBatchInput = { ...request.target }
  const writable = target as unknown as Record<string, unknown>
  for (const field of COPY_FORWARD_SAFE_FIELDS) {
    if (selected.has(field)) writable[field] = source[field]
  }
  for (const field of COPY_FORWARD_RESTRICTED_FIELDS) {
    if (selected.has(field)) writable[field] = source[field]
  }
  const created = await saveCpvBatch(productId, target)
  appendCpvAudit({
    action_type: 'copy',
    product_id: productId,
    batch_id: created.id,
    module: 'Product Batches',
    record_type: 'batch',
    record_id: created.id,
    record_label: created.batch_number,
    source_record_id: source.id,
    reason: `Copied from ${source.batch_number}: ${[...selected].join(', ') || 'no fields'}`,
  })
  return created
}

export async function addCpvPackagingOrder(batchId: string, poControlNumber: string, comments?: string): Promise<CpvPackagingOrder> {
  assertCanMutate('add packaging orders')
  const batch = batches.find((row) => row.id === batchId)
  if (!batch) throw new Error('Batch not found.')
  const po = normalizeCode(poControlNumber)
  if (!po) throw new Error('PO control number is required.')
  const duplicate = packagingOrders.find(
    (row) => row.batch_id === batchId && row.po_control_number.toLowerCase() === po.toLowerCase(),
  )
  if (duplicate) throw new Error('This batch already has that PO control number.')
  const ts = nowUtcIso()
  const created: CpvPackagingOrder = {
    id: createCpvId('po'),
    batch_id: batchId,
    po_control_number: po,
    comments: trimOrNull(comments),
    created_at: ts,
    updated_at: ts,
  }
  packagingOrders.push(created)
  appendCpvAudit({
    action_type: 'create',
    product_id: batch.product_id,
    batch_id: batchId,
    module: 'Product Batches',
    record_type: 'packaging_order',
    record_id: created.id,
    record_label: po,
    field_name: 'PO Control Number',
    old_value: '(empty)',
    new_value: po,
  })
  persistCpvStore()
  return created
}

export async function listCpvProtocols(): Promise<CpvProtocol[]> {
  return protocols.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export async function saveCpvProtocol(input: CpvProtocolInput, existingId?: string): Promise<CpvProtocol> {
  assertCanMutate('save protocols')
  const product = products.find((row) => row.id === input.product_id)
  if (!product) throw new Error('Product not found.')
  if (!input.title.trim()) throw new Error('Protocol title is required.')
  const ts = nowUtcIso()
  const who = actor()

  if (existingId) {
    const idx = protocols.findIndex((row) => row.id === existingId)
    if (idx === -1) throw new Error('Protocol not found.')
    const previous = protocols[idx]
    if (previous.status === 'Approved/Effective' || previous.status === 'Superseded') {
      throw new Error('Approved protocol versions are immutable. Create a revision.')
    }
    if (previous.status !== 'Draft' && previous.status !== 'Rejected') {
      throw new Error('Only draft or rejected protocols can be edited.')
    }
    const updated: CpvProtocol = {
      ...previous,
      title: input.title.trim(),
      review_period_start: trimOrNull(input.review_period_start),
      review_period_end: trimOrNull(input.review_period_end),
      scope: trimOrNull(input.scope),
      batch_selection_rule: trimOrNull(input.batch_selection_rule),
      objective: trimOrNull(input.objective),
      status: 'Draft',
      reject_comment: null,
      row_version: previous.row_version + 1,
      updated_at: ts,
    }
    protocols[idx] = updated
    appendCpvAudit({
      action_type: 'edit',
      product_id: updated.product_id,
      module: 'Protocol',
      record_type: 'protocol',
      record_id: updated.id,
      record_label: `${updated.protocol_number} v${updated.version}`,
      field_name: 'Title',
      old_value: previous.title,
      new_value: updated.title,
    })
    return updated
  }

  const created: CpvProtocol = {
    id: createCpvId('protocol'),
    protocol_number: nextDocumentNumber('CPV-P', protocols, 'protocol_number'),
    version: 1,
    product_id: input.product_id,
    title: input.title.trim(),
    review_period_start: trimOrNull(input.review_period_start),
    review_period_end: trimOrNull(input.review_period_end),
    scope: trimOrNull(input.scope),
    batch_selection_rule: trimOrNull(input.batch_selection_rule) ?? 'FG release date within the review period',
    status: 'Draft',
    author_id: who.id,
    author_name: who.name,
    reviewer_name: null,
    approver_name: null,
    signoff_printed_name: null,
    signoff_meaning: null,
    effective_date: null,
    superseded_protocol_id: null,
    linked_report_id: null,
    objective: trimOrNull(input.objective),
    reject_comment: null,
    row_version: 1,
    created_at: ts,
    updated_at: ts,
  }
  protocols.push(created)
  appendCpvAudit({
    action_type: 'create',
    product_id: created.product_id,
    module: 'Protocol',
    record_type: 'protocol',
    record_id: created.id,
    record_label: `${created.protocol_number} v${created.version}`,
    field_name: 'Protocol Number',
    old_value: '(empty)',
    new_value: created.protocol_number,
  })
  return created
}

export async function submitCpvProtocol(protocolId: string): Promise<CpvProtocol> {
  assertCanMutate('submit protocols')
  const idx = protocols.findIndex((row) => row.id === protocolId)
  if (idx === -1) throw new Error('Protocol not found.')
  const previous = protocols[idx]
  if (previous.status !== 'Draft' && previous.status !== 'Rejected') {
    throw new Error('Only draft or rejected protocols can be submitted.')
  }
  const updated: CpvProtocol = {
    ...previous,
    status: 'Pending Approval',
    reviewer_name: actor().name,
    updated_at: nowUtcIso(),
    row_version: previous.row_version + 1,
  }
  protocols[idx] = updated
  appendCpvAudit({
    action_type: 'submit',
    product_id: updated.product_id,
    module: 'Protocol',
    record_type: 'protocol',
    record_id: updated.id,
    record_label: `${updated.protocol_number} v${updated.version}`,
    field_name: 'Status',
    old_value: previous.status,
    new_value: updated.status,
  })
  return updated
}

export async function approveCpvProtocol(protocolId: string, signoff: CpvSignoff): Promise<CpvProtocol> {
  requireSignoff(signoff, 'Protocol approval')
  const idx = protocols.findIndex((row) => row.id === protocolId)
  if (idx === -1) throw new Error('Protocol not found.')
  const previous = protocols[idx]
  assertCanApprove(previous.author_id, 'this protocol version')
  if (previous.status !== 'Pending Approval' && previous.status !== 'In Review') {
    throw new Error('Protocol is not awaiting approval.')
  }
  const ts = nowUtcIso()
  const updated: CpvProtocol = {
    ...previous,
    status: 'Approved/Effective',
    approver_name: actor().name,
    signoff_printed_name: signoff.printedName.trim(),
    signoff_meaning: signoff.meaning.trim(),
    effective_date: ts.slice(0, 10),
    updated_at: ts,
    row_version: previous.row_version + 1,
  }
  protocols[idx] = updated
  appendCpvAudit({
    action_type: 'approve',
    product_id: updated.product_id,
    module: 'Protocol',
    record_type: 'protocol',
    record_id: updated.id,
    record_label: `${updated.protocol_number} v${updated.version}`,
    field_name: 'Status',
    old_value: previous.status,
    new_value: updated.status,
    reason: signoff.meaning.trim(),
  })
  return updated
}

export async function rejectCpvProtocol(protocolId: string, comment: string): Promise<CpvProtocol> {
  if (!comment.trim()) throw new Error('Return to draft or reject requires comments.')
  const idx = protocols.findIndex((row) => row.id === protocolId)
  if (idx === -1) throw new Error('Protocol not found.')
  const previous = protocols[idx]
  if (previous.status === 'Approved/Effective') throw new Error('Approved protocol versions cannot be rejected.')
  const updated: CpvProtocol = {
    ...previous,
    status: 'Rejected',
    reject_comment: comment.trim(),
    updated_at: nowUtcIso(),
    row_version: previous.row_version + 1,
  }
  protocols[idx] = updated
  appendCpvAudit({
    action_type: 'reject',
    product_id: updated.product_id,
    module: 'Protocol',
    record_type: 'protocol',
    record_id: updated.id,
    record_label: `${updated.protocol_number} v${updated.version}`,
    field_name: 'Status',
    old_value: previous.status,
    new_value: 'Rejected',
    reason: comment.trim(),
  })
  return updated
}

export async function reviseCpvProtocol(protocolId: string): Promise<CpvProtocol> {
  assertCanMutate('revise protocols')
  const previous = protocols.find((row) => row.id === protocolId)
  if (!previous) throw new Error('Protocol not found.')
  if (previous.status !== 'Approved/Effective') throw new Error('Only approved protocols can be revised into a new version.')
  const ts = nowUtcIso()
  previous.status = 'Superseded'
  previous.updated_at = ts
  const created: CpvProtocol = {
    ...previous,
    id: createCpvId('protocol'),
    version: previous.version + 1,
    status: 'Draft',
    author_id: actor().id,
    author_name: actor().name,
    reviewer_name: null,
    approver_name: null,
    signoff_printed_name: null,
    signoff_meaning: null,
    effective_date: null,
    superseded_protocol_id: previous.id,
    linked_report_id: null,
    reject_comment: null,
    row_version: 1,
    created_at: ts,
    updated_at: ts,
  }
  protocols.push(created)
  appendCpvAudit({
    action_type: 'create',
    product_id: created.product_id,
    module: 'Protocol',
    record_type: 'protocol',
    record_id: created.id,
    record_label: `${created.protocol_number} v${created.version}`,
    field_name: 'Version',
    old_value: String(previous.version),
    new_value: String(created.version),
    source_record_id: previous.id,
  })
  return created
}

export async function listCpvReports(): Promise<CpvReport[]> {
  return reports.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export async function generateCpvReport(protocolId: string): Promise<CpvReport> {
  assertCanMutate('generate reports')
  const protocol = protocols.find((row) => row.id === protocolId)
  if (!protocol) throw new Error('Protocol not found.')
  if (protocol.status !== 'Approved/Effective') throw new Error('Reports can only be generated from an approved protocol.')
  const product = products.find((row) => row.id === protocol.product_id)
  if (!product) throw new Error('Product not found.')
  const { included, excluded } = batchesInReviewPeriod(product, protocol.review_period_start, protocol.review_period_end)
  const ts = nowUtcIso()
  const who = actor()
  const snapshot: CpvReportSnapshot = {
    generated_at: ts,
    generated_by: who.name,
    product_id: product.id,
    protocol_id: protocol.id,
    protocol_version: protocol.version,
    review_period_start: protocol.review_period_start,
    review_period_end: protocol.review_period_end,
    included_batch_ids: included.map((batch) => batch.id),
    excluded_batch_ids: excluded.map((batch) => batch.id),
    proposed_posture: calculateProposedPosture(included.length, Boolean(product.official_posture_approved_at)),
  }
  const created: CpvReport = {
    id: createCpvId('report'),
    report_number: nextDocumentNumber('CPV-R', reports, 'report_number'),
    version: 1,
    product_id: product.id,
    protocol_id: protocol.id,
    review_period_start: protocol.review_period_start,
    review_period_end: protocol.review_period_end,
    included_batch_count: included.length,
    excluded_batch_count: excluded.length,
    proposed_posture: snapshot.proposed_posture,
    approved_posture: null,
    status: 'Draft',
    snapshot,
    author_id: who.id,
    author_name: who.name,
    reviewer_name: null,
    approver_name: null,
    signoff_printed_name: null,
    signoff_meaning: null,
    effective_date: null,
    reject_comment: null,
    row_version: 1,
    created_at: ts,
    updated_at: ts,
  }
  reports.push(created)
  protocol.linked_report_id = created.id
  appendCpvAudit({
    action_type: 'create',
    product_id: product.id,
    module: 'Report',
    record_type: 'report',
    record_id: created.id,
    record_label: `${created.report_number} v${created.version}`,
    field_name: 'Snapshot',
    old_value: '(empty)',
    new_value: `${included.length} included / ${excluded.length} excluded`,
  })
  return created
}

export async function submitCpvReport(reportId: string): Promise<CpvReport> {
  assertCanMutate('submit reports')
  const idx = reports.findIndex((row) => row.id === reportId)
  if (idx === -1) throw new Error('Report not found.')
  const previous = reports[idx]
  if (previous.status !== 'Draft' && previous.status !== 'Rejected') {
    throw new Error('Only draft or rejected reports can be submitted.')
  }
  const updated: CpvReport = {
    ...previous,
    status: 'Pending Approval',
    reviewer_name: actor().name,
    updated_at: nowUtcIso(),
    row_version: previous.row_version + 1,
  }
  reports[idx] = updated
  appendCpvAudit({
    action_type: 'submit',
    product_id: updated.product_id,
    module: 'Report',
    record_type: 'report',
    record_id: updated.id,
    record_label: `${updated.report_number} v${updated.version}`,
    field_name: 'Status',
    old_value: previous.status,
    new_value: updated.status,
  })
  return updated
}

export async function approveCpvReport(reportId: string, signoff: CpvSignoff): Promise<CpvReport> {
  requireSignoff(signoff, 'Report approval')
  const idx = reports.findIndex((row) => row.id === reportId)
  if (idx === -1) throw new Error('Report not found.')
  const previous = reports[idx]
  assertCanApprove(previous.author_id, 'this report version')
  if (previous.status !== 'Pending Approval' && previous.status !== 'In Review') {
    throw new Error('Report is not awaiting approval.')
  }
  if (!previous.snapshot) throw new Error('Approved reports require a frozen data snapshot.')
  const frozenSnapshot = structuredClone(previous.snapshot)
  const ts = nowUtcIso()
  const updated: CpvReport = {
    ...previous,
    status: 'Approved/Effective',
    approved_posture: previous.proposed_posture,
    snapshot: frozenSnapshot,
    approver_name: actor().name,
    signoff_printed_name: signoff.printedName.trim(),
    signoff_meaning: signoff.meaning.trim(),
    effective_date: ts.slice(0, 10),
    updated_at: ts,
    row_version: previous.row_version + 1,
  }
  reports[idx] = updated
  appendCpvAudit({
    action_type: 'approve',
    product_id: updated.product_id,
    module: 'Report',
    record_type: 'report',
    record_id: updated.id,
    record_label: `${updated.report_number} v${updated.version}`,
    field_name: 'Status',
    old_value: previous.status,
    new_value: updated.status,
    reason: signoff.meaning.trim(),
  })
  return updated
}

export function getFrozenReportSnapshot(reportId: string): CpvReportSnapshot | null {
  return reports.find((row) => row.id === reportId)?.snapshot ?? null
}

export async function listCpvAudit(filter: CpvAuditFilter = {}) {
  return listCpvAuditEvents(filter)
}

export function setCpvSessionActor(next: CpvActor) {
  setCpvActor(next)
}

export function cpvActorRole(): UserRole {
  return actor().role
}
