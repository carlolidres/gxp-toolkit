import seedBundle from '../../data/apqrSeedData.json'
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase'
import { formatAppDate, formatAppDateTime } from '../../utils/dateUtils'
import {
  auditFieldChanges,
  buildFieldDescription,
  logApqrAudit,
} from './apqrAudit'
import { resolveApqrIdYear } from './apqrDashboard'
import { generateUniqueApqrId } from './apqrId'
import {
  deliveryFieldsFromInput,
  nextFollowUpDueDate,
} from './apqrDelivery'
import {
  assignCommitmentPriority,
  classifyDelivery,
  countMissingCritical,
  defaultApqrGenerationDate,
  defaultCommitmentSchedule,
  defaultStabilityPullOutDate,
  expectedStabilityTabulationCompletionDate,
  PRIORITY_SORT,
} from './scheduling'
import { serializeSchedulerRemarks } from './schedulerForm'
import type {
  ApqrClient,
  ApqrClientInput,
  ApqrDashboardMetrics,
  ApqrDatabaseRow,
  ApqrFollowUp,
  ApqrRecord,
  ApqrRecordInput,
  ApqrSchedulerEntry,
  ApqrSchedulerRowInput,
} from './types'
import { mergeSentBySuggestions } from './sentBySuggestions'
import { mergeDepartmentSuggestions } from './departmentSuggestions'
import { mergeAccountManagerSuggestions } from './accountManagerSuggestions'
import { mergeReportStatusSuggestions } from './reportStatusSuggestions'

interface SeedBundle {
  clients: ApqrClient[]
  schedulerEntries: Array<
    ApqrSchedulerEntry & {
      client_code?: string
      client_name?: string
      account_manager?: string
      apqr_package?: string
      review_coverage_display?: string
      is_active?: number | boolean
    }
  >
  records: Array<ApqrRecord & { apqr_id?: string }>
}

const bundle = seedBundle as unknown as SeedBundle

let clients = structuredClone(bundle.clients)
let schedulerEntries = bundle.schedulerEntries.map((e) => ({
  ...e,
  is_active: Boolean(e.is_active ?? true),
})) as ApqrSchedulerEntry[]
let records = structuredClone(bundle.records) as ApqrRecord[]
let followUps: ApqrFollowUp[] = []

function nowIso() {
  return new Date().toISOString()
}

function normalizeClientInput(input: ApqrClientInput): ApqrClientInput {
  return {
    ...input,
    code: input.code.trim(),
    account_manager: input.account_manager.trim(),
    client_name: input.client_name.trim(),
    qa: input.qa?.trim() || undefined,
    technical: input.technical?.trim() || undefined,
    regulatory: input.regulatory?.trim() || undefined,
  }
}

function clientById(id: string) {
  return clients.find((c) => c.id === id)
}

function schedById(id: string) {
  return schedulerEntries.find((s) => s.id === id && s.is_active)
}

function recordBySchedulerId(schedulerId: string) {
  return records.find((r) => r.scheduler_entry_id === schedulerId)
}

export function buildDatabaseRows(): ApqrDatabaseRow[] {
  const today = new Date().toISOString().slice(0, 10)

  return schedulerEntries
    .filter((s) => s.is_active)
    .map((sched) => {
      const client = clientById(sched.client_id)
      const record = recordBySchedulerId(sched.id)
      const recordFollowUps = followUps.filter((f) => f.record_id === record?.id)
      const lastFollowUp = recordFollowUps.sort((a, b) => b.follow_up_date.localeCompare(a.follow_up_date))[0]
      const pullOut = sched.stability_pull_out_date
      const expectedStab = pullOut ? expectedStabilityTabulationCompletionDate(pullOut) : null
      const deliveryClass = classifyDelivery(
        sched.commitment_schedule,
        record?.final_apqr_delivery_date ?? null,
        today,
        record?.apqr_report_status ?? null,
      )

      const row: ApqrDatabaseRow = {
        apqr_id: sched.apqr_id,
        scheduler_entry_id: sched.id,
        record_id: record?.id ?? '',
        client_id: sched.client_id,
        client_code: client?.code ?? '',
        client_name: client?.client_name ?? '',
        account_manager: client?.account_manager ?? '',
        apqr_package: client?.apqr_package ?? 'Billable',
        product_name: sched.product_name,
        product_code: sched.product_code,
        department: record?.department ?? null,
        review_coverage_start: sched.review_coverage_start,
        review_coverage_end: sched.review_coverage_end,
        stability_pull_out_date: pullOut,
        expected_stability_tabulation_completion_date: expectedStab,
        stability_tabulation_status: record?.stability_tabulation_status ?? null,
        commitment_schedule: sched.commitment_schedule,
        commitment_schedule_status: sched.commitment_schedule_status,
        apqr_report_status: record?.apqr_report_status ?? null,
        apr_reference_number: record?.apr_reference_number ?? null,
        number_of_batches: record?.number_of_batches ?? null,
        billing_reference_number: record?.billing_reference_number ?? null,
        date_sent: record?.date_sent ?? null,
        last_follow_up_date: lastFollowUp?.follow_up_date ?? null,
        next_follow_up_due_date: record?.next_follow_up_due_date ?? null,
        date_client_signed: record?.date_client_signed ?? null,
        final_apqr_delivery_date: record?.final_apqr_delivery_date ?? null,
        delivery_classification: deliveryClass,
        days_remaining_or_overdue: null,
        record_status: record?.record_status ?? 'active',
        updated_at: record?.updated_at ?? sched.updated_at,
        priority: 'Low Priority',
        missing_critical_count: 0,
      }

      row.days_remaining_or_overdue = Math.round(
        (new Date(`${sched.commitment_schedule}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) /
          86_400_000,
      )
      row.priority = assignCommitmentPriority(row, today)
      row.missing_critical_count = countMissingCritical(row)
      return row
    })
    .sort((a, b) => {
      const p = PRIORITY_SORT[a.priority] - PRIORITY_SORT[b.priority]
      if (p !== 0) return p
      return a.commitment_schedule.localeCompare(b.commitment_schedule)
    })
}

export function buildDashboardMetrics(
  rows = buildDatabaseRows(),
  asOf = new Date().toISOString().slice(0, 10),
): ApqrDashboardMetrics {
  const today = new Date(`${asOf}T12:00:00Z`)
  const month = today.getUTCMonth()
  const year = today.getUTCFullYear()

  const delivered = rows.filter((r) => r.final_apqr_delivery_date)
  const onTime = delivered.filter((r) => r.delivery_classification === 'Delivered On Time')

  return {
    totalActive: rows.length,
    overdueCommitments: rows.filter((r) => r.priority === 'Overdue Commitment').length,
    criticalCommitments: rows.filter((r) => r.priority === 'Critical Commitment').length,
    highPriorityCommitments: rows.filter((r) => r.priority === 'High-Priority Commitment').length,
    dueThisMonth: rows.filter((r) => {
      const d = new Date(`${r.commitment_schedule}T12:00:00Z`)
      return d.getUTCFullYear() === year && d.getUTCMonth() === month
    }).length,
    deliveredThisMonth: rows.filter((r) => {
      if (!r.final_apqr_delivery_date) return false
      const d = new Date(`${r.final_apqr_delivery_date}T12:00:00Z`)
      return d.getUTCFullYear() === year && d.getUTCMonth() === month
    }).length,
    onTimeDelivered: onTime.length,
    totalDelivered: delivered.length,
    onTimeDeliveryRate: delivered.length ? Math.round((onTime.length / delivered.length) * 100) : 0,
    overdueDeliveries: rows.filter((r) => r.delivery_classification === 'Delivered Overdue').length,
    pendingClientApproval: rows.filter((r) => r.apqr_report_status === 'For Client Approval').length,
    followUpsDue: rows.filter((r) => r.next_follow_up_due_date && r.next_follow_up_due_date <= asOf).length,
    stabilityActionsDue: rows.filter(
      (r) =>
        r.stability_pull_out_date &&
        r.stability_pull_out_date <= asOf &&
        (!r.stability_tabulation_status || r.stability_tabulation_status === 'Not Sent'),
    ).length,
    missingCriticalInformation: rows.filter((r) => r.missing_critical_count > 0).length,
  }
}

function supabaseClientOrNull() {
  if (!isSupabaseConfigured()) return null
  return getSupabaseClient()
}

function supabaseErrorMessage(context: string, error: { message: string } | null): string {
  return `${context}: ${error?.message ?? 'Unknown database error'}`
}

let apqrDataSynced = false

async function syncApqrFromSupabase(): Promise<void> {
  const sb = supabaseClientOrNull()
  if (!sb) return

  const [clientsRes, schedulerRes, recordsRes, followUpsRes] = await Promise.all([
    sb.from('apqr_clients').select('*').eq('status', 'active').order('code'),
    sb.from('apqr_scheduler_entries').select('*'),
    sb.from('apqr_records').select('*'),
    sb.from('apqr_follow_ups').select('*').order('recorded_at', { ascending: false }),
  ])

  if (clientsRes.error) throw new Error(supabaseErrorMessage('Failed to load APQR clients', clientsRes.error))
  if (schedulerRes.error) throw new Error(supabaseErrorMessage('Failed to load APQR scheduler entries', schedulerRes.error))
  if (recordsRes.error) throw new Error(supabaseErrorMessage('Failed to load APQR records', recordsRes.error))
  if (followUpsRes.error) throw new Error(supabaseErrorMessage('Failed to load APQR follow-ups', followUpsRes.error))

  clients = (clientsRes.data ?? []) as ApqrClient[]
  schedulerEntries = (schedulerRes.data ?? []).map((entry) => ({
    ...(entry as ApqrSchedulerEntry),
    is_active: Boolean((entry as ApqrSchedulerEntry).is_active ?? true),
  }))
  records = (recordsRes.data ?? []) as ApqrRecord[]
  followUps = (followUpsRes.data ?? []) as ApqrFollowUp[]
  apqrDataSynced = true
}

async function ensureApqrDataLoaded(): Promise<void> {
  if (!isSupabaseConfigured() || apqrDataSynced) return
  await syncApqrFromSupabase()
}

async function resyncAfterPersistFailure(): Promise<void> {
  if (!isSupabaseConfigured()) return
  apqrDataSynced = false
  await syncApqrFromSupabase()
}

function clientRow(client: ApqrClient) {
  return {
    id: client.id,
    code: client.code,
    account_manager: client.account_manager,
    client_name: client.client_name,
    qa: client.qa,
    technical: client.technical,
    regulatory: client.regulatory,
    apqr_package: client.apqr_package,
    status: client.status,
    created_at: client.created_at,
    updated_at: client.updated_at,
  }
}

function schedulerRow(entry: ApqrSchedulerEntry) {
  return {
    id: entry.id,
    apqr_id: entry.apqr_id,
    client_id: entry.client_id,
    stability_pull_out_date: entry.stability_pull_out_date,
    product_name: entry.product_name,
    product_code: entry.product_code,
    product_status: entry.product_status ?? 'Active',
    review_coverage_start: entry.review_coverage_start,
    review_coverage_end: entry.review_coverage_end,
    review_coverage_adjustment_reason: entry.review_coverage_adjustment_reason,
    commitment_schedule: entry.commitment_schedule,
    commitment_schedule_adjustment_reason: entry.commitment_schedule_adjustment_reason ?? null,
    apqr_generation_date: entry.apqr_generation_date ?? null,
    apqr_generation_adjustment_reason: entry.apqr_generation_adjustment_reason ?? null,
    commitment_schedule_status: entry.commitment_schedule_status,
    schedule_status_date: entry.schedule_status_date,
    stability_pull_out_adjustment_reason: entry.stability_pull_out_adjustment_reason,
    scheduler_remarks: entry.scheduler_remarks ?? null,
    is_active: entry.is_active,
    archived_at: entry.archived_at,
    archive_reason: entry.archive_reason,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  }
}

function recordRow(record: ApqrRecord) {
  return {
    id: record.id,
    scheduler_entry_id: record.scheduler_entry_id,
    department: record.department,
    stability_tabulation_status: record.stability_tabulation_status,
    stability_tabulation_status_date: record.stability_tabulation_status_date,
    no_ongoing_stability_justification: record.no_ongoing_stability_justification,
    billing_reference_number: record.billing_reference_number,
    apqr_report_status: record.apqr_report_status,
    sent_by: record.sent_by,
    date_sent: record.date_sent,
    apr_reference_number: record.apr_reference_number,
    number_of_batches: record.number_of_batches,
    zero_batch_explanation: record.zero_batch_explanation,
    date_client_signed: record.date_client_signed,
    final_apqr_delivery_date: record.final_apqr_delivery_date,
    delivery_classification: record.delivery_classification,
    days_early_or_overdue: record.days_early_or_overdue,
    delay_category: record.delay_category,
    delay_reason: record.delay_reason,
    delay_reason_change_note: record.delay_reason_change_note,
    expected_final_delivery_date: record.expected_final_delivery_date,
    remarks: record.remarks,
    next_follow_up_due_date: record.next_follow_up_due_date,
    record_status: record.record_status,
    created_at: record.created_at,
    updated_at: record.updated_at,
  }
}

async function persistClient(client: ApqrClient, mode: 'insert' | 'update'): Promise<void> {
  const sb = supabaseClientOrNull()
  if (!sb) return

  const row = clientRow(client)
  const { error } =
    mode === 'insert'
      ? await sb.from('apqr_clients').insert(row)
      : await sb.from('apqr_clients').update(row).eq('id', client.id)

  if (error) throw new Error(supabaseErrorMessage('Failed to save client', error))
}

async function persistSchedulerEntry(entry: ApqrSchedulerEntry, mode: 'insert' | 'update'): Promise<void> {
  const sb = supabaseClientOrNull()
  if (!sb) return

  const row = schedulerRow(entry)
  const { error } =
    mode === 'insert'
      ? await sb.from('apqr_scheduler_entries').insert(row)
      : await sb.from('apqr_scheduler_entries').update(row).eq('id', entry.id)

  if (error) throw new Error(supabaseErrorMessage('Failed to save scheduler entry', error))
}

async function persistRecord(record: ApqrRecord, mode: 'insert' | 'update'): Promise<void> {
  const sb = supabaseClientOrNull()
  if (!sb) return

  const row = recordRow(record)
  const { error } =
    mode === 'insert'
      ? await sb.from('apqr_records').insert(row)
      : await sb.from('apqr_records').update(row).eq('id', record.id)

  if (error) throw new Error(supabaseErrorMessage('Failed to save APQR record', error))
}

async function nextApqrId(year: number): Promise<string> {
  const sb = supabaseClientOrNull()
  if (!sb) {
    await ensureApqrDataLoaded()
    return generateUniqueApqrId(schedulerEntries.map((entry) => entry.apqr_id))
  }

  const { data, error } = await sb.rpc('apqr_next_id', { p_year: year })
  if (error || !data) throw new Error(supabaseErrorMessage('Failed to generate APQR ID', error))
  return String(data)
}

export async function listClients(): Promise<ApqrClient[]> {
  await ensureApqrDataLoaded()
  return [...clients].sort((a, b) => a.code.localeCompare(b.code))
}

export async function saveClient(input: ApqrClientInput, existingId?: string): Promise<ApqrClient> {
  const normalized = normalizeClientInput(input)
  const duplicate = clients.find((c) => c.code === normalized.code && c.id !== existingId)
  if (duplicate) throw new Error('Duplicate Client Code Detected')

  const ts = nowIso()
  if (existingId) {
    const idx = clients.findIndex((c) => c.id === existingId)
    if (idx === -1) throw new Error('Client not found')
    const previous = clients[idx]
    const updated = { ...previous, ...normalized, updated_at: ts }
    clients[idx] = updated
    await auditFieldChanges(
      'client',
      updated.id,
      `client ${updated.code}`,
      previous,
      updated,
      [
        { key: 'code', label: 'Client Code' },
        { key: 'account_manager', label: 'Account Manager' },
        { key: 'client_name', label: 'Client Name' },
        { key: 'qa', label: 'QA Contact' },
        { key: 'technical', label: 'Technical Contact' },
        { key: 'regulatory', label: 'Regulatory Contact' },
        { key: 'apqr_package', label: 'APQR Package' },
      ],
    )
    try {
      await persistClient(updated, 'update')
    } catch (err) {
      await resyncAfterPersistFailure()
      throw err
    }
    return updated
  }

  const created: ApqrClient = {
    id: `apqr-client-${normalized.code}`,
    ...normalized,
    qa: normalized.qa ?? null,
    technical: normalized.technical ?? null,
    regulatory: normalized.regulatory ?? null,
    status: 'active',
    created_at: ts,
    updated_at: ts,
  }
  clients.push(created)
  await logApqrAudit({
    entity_type: 'client',
    entity_id: created.id,
    entity_label: `client ${created.code}`,
    action_type: 'created',
    description: buildFieldDescription('created', `client ${created.code}`, 'Client Name', null, created.client_name),
    new_value: created.client_name,
  })
  try {
    await persistClient(created, 'insert')
  } catch (err) {
    await resyncAfterPersistFailure()
    throw err
  }
  return created
}

export async function listSchedulerForClient(clientId: string): Promise<ApqrSchedulerEntry[]> {
  await ensureApqrDataLoaded()
  return schedulerEntries.filter((s) => s.client_id === clientId && s.is_active)
}

export async function saveSchedulerRows(
  clientId: string,
  rows: ApqrSchedulerRowInput[],
  existingIds: (string | undefined)[] = [],
): Promise<void> {
  const client = clientById(clientId)
  if (!client) throw new Error('Client not found')

  for (const row of rows) {
    const productCode = row.product_code.trim().toUpperCase()
    const dup = schedulerEntries.find(
      (s) =>
        s.is_active &&
        s.client_id === clientId &&
        s.product_code === productCode &&
        s.review_coverage_start === row.review_coverage_start &&
        s.review_coverage_end === row.review_coverage_end &&
        !existingIds.includes(s.id),
    )
    if (dup) throw new Error('Duplicate Product and Review Coverage Detected')
  }

  const ts = nowIso()
  let seq = schedulerEntries.length

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const productCode = row.product_code.trim().toUpperCase()
    const defaultCommitment = defaultCommitmentSchedule(row.review_coverage_end)
    const defaultGeneration = defaultApqrGenerationDate(row.review_coverage_end)
    const commitment = row.commitment_schedule_adjustment_reason
      ? (row.commitment_schedule ?? defaultCommitment)
      : defaultCommitment
    const apqrGeneration = row.apqr_generation_adjustment_reason
      ? (row.apqr_generation_date ?? defaultGeneration)
      : defaultGeneration
    const existingId = existingIds[i]

    if (existingId) {
      const idx = schedulerEntries.findIndex((s) => s.id === existingId)
      if (idx === -1) continue
      const previous = schedulerEntries[idx]
      const statusChanged = previous.commitment_schedule_status !== row.commitment_schedule_status
      schedulerEntries[idx] = {
        ...previous,
        stability_pull_out_date: row.stability_pull_out_adjustment_reason
          ? row.stability_pull_out_date
          : defaultStabilityPullOutDate(row.review_coverage_end),
        product_name: row.product_name.trim(),
        product_code: productCode,
        product_status: row.product_status ?? previous.product_status ?? 'Active',
        review_coverage_start: row.review_coverage_start,
        review_coverage_end: row.review_coverage_end,
        review_coverage_adjustment_reason: row.review_coverage_adjustment_reason ?? null,
        commitment_schedule: commitment,
        commitment_schedule_adjustment_reason: row.commitment_schedule_adjustment_reason ?? null,
        apqr_generation_date: apqrGeneration,
        apqr_generation_adjustment_reason: row.apqr_generation_adjustment_reason ?? null,
        commitment_schedule_status: row.commitment_schedule_status,
        schedule_status_date:
          row.schedule_status_date ??
          (statusChanged ? ts.slice(0, 10) : previous.schedule_status_date),
        stability_pull_out_adjustment_reason: row.stability_pull_out_adjustment_reason ?? null,
        scheduler_remarks: serializeSchedulerRemarks(row.scheduler_remarks),
        updated_at: ts,
      }
      await auditFieldChanges(
        'scheduler',
        previous.id,
        previous.apqr_id,
        previous,
        schedulerEntries[idx],
        [
          { key: 'product_name', label: 'Product Name' },
          { key: 'product_code', label: 'Product Code' },
          { key: 'product_status', label: 'Product Status' },
          { key: 'stability_pull_out_date', label: 'Stability Pull-Out Date' },
          { key: 'review_coverage_start', label: 'Review Coverage Start' },
          { key: 'review_coverage_end', label: 'Review Coverage End' },
          { key: 'commitment_schedule', label: 'Commitment Schedule' },
          { key: 'apqr_generation_date', label: 'APQR Generation Report Date' },
          { key: 'commitment_schedule_status', label: 'Commitment Schedule Status' },
        ],
      )
      try {
        await persistSchedulerEntry(schedulerEntries[idx], 'update')
      } catch (err) {
        await resyncAfterPersistFailure()
        throw err
      }
      continue
    }

    seq += 1
    const year = resolveApqrIdYear(row)
    const schedId = `apqr-sched-${String(seq).padStart(5, '0')}`
    const apqrId = await nextApqrId(year)

    const entry: ApqrSchedulerEntry = {
      id: schedId,
      apqr_id: apqrId,
      client_id: clientId,
      stability_pull_out_date: row.stability_pull_out_adjustment_reason
        ? row.stability_pull_out_date || defaultStabilityPullOutDate(row.review_coverage_end)
        : defaultStabilityPullOutDate(row.review_coverage_end),
      product_name: row.product_name.trim(),
      product_code: productCode,
      product_status: row.product_status ?? 'Active',
      review_coverage_start: row.review_coverage_start,
      review_coverage_end: row.review_coverage_end,
      review_coverage_adjustment_reason: row.review_coverage_adjustment_reason ?? null,
      commitment_schedule: commitment,
      commitment_schedule_adjustment_reason: row.commitment_schedule_adjustment_reason ?? null,
      apqr_generation_date: apqrGeneration,
      apqr_generation_adjustment_reason: row.apqr_generation_adjustment_reason ?? null,
      commitment_schedule_status: row.commitment_schedule_status,
      schedule_status_date: row.schedule_status_date ?? ts.slice(0, 10),
      stability_pull_out_adjustment_reason: row.stability_pull_out_adjustment_reason ?? null,
      scheduler_remarks: serializeSchedulerRemarks(row.scheduler_remarks),
      is_active: true,
      archived_at: null,
      archive_reason: null,
      created_at: ts,
      updated_at: ts,
    }
    schedulerEntries.push(entry)
    const createdRecord: ApqrRecord = {
      id: `apqr-rec-${String(seq).padStart(5, '0')}`,
      scheduler_entry_id: schedId,
      department: null,
      stability_tabulation_status: null,
      stability_tabulation_status_date: null,
      no_ongoing_stability_justification: null,
      billing_reference_number: null,
      apqr_report_status: null,
      sent_by: null,
      date_sent: null,
      apr_reference_number: null,
      number_of_batches: null,
      zero_batch_explanation: null,
      date_client_signed: null,
      final_apqr_delivery_date: null,
      delivery_classification: null,
      days_early_or_overdue: null,
      delay_category: null,
      delay_reason: null,
      delay_reason_change_note: null,
      expected_final_delivery_date: null,
      remarks: null,
      next_follow_up_due_date: null,
      record_status: 'active',
      created_at: ts,
      updated_at: ts,
    }
    records.push(createdRecord)
    await logApqrAudit({
      entity_type: 'scheduler',
      entity_id: entry.id,
      entity_label: entry.apqr_id,
      action_type: 'created',
      description: buildFieldDescription('created', entry.apqr_id, 'Product Name', null, entry.product_name),
      new_value: entry.product_name,
    })
    try {
      await persistSchedulerEntry(entry, 'insert')
      await persistRecord(createdRecord, 'insert')
    } catch (err) {
      await resyncAfterPersistFailure()
      throw err
    }
  }

  if (isSupabaseConfigured()) {
    apqrDataSynced = false
    await syncApqrFromSupabase()
  }
}

export async function archiveSchedulerEntry(schedulerId: string, reason: string): Promise<void> {
  const trimmed = reason.trim()
  if (!trimmed) throw new Error('A reason for removal is required for saved scheduler rows.')

  const idx = schedulerEntries.findIndex((s) => s.id === schedulerId)
  if (idx === -1) throw new Error('Scheduler row not found')

  const entry = schedulerEntries[idx]
  if (!entry.is_active) return

  const ts = nowIso()
  schedulerEntries[idx] = {
    ...entry,
    is_active: false,
    archived_at: ts,
    archive_reason: trimmed,
    updated_at: ts,
  }

  await logApqrAudit({
    entity_type: 'scheduler',
    entity_id: entry.id,
    entity_label: entry.apqr_id,
    action_type: 'archived',
    description: buildFieldDescription('archived', entry.apqr_id, 'archive reason', entry.product_name, trimmed),
    reason: trimmed,
    new_value: trimmed,
  })

  try {
    await persistSchedulerEntry(schedulerEntries[idx], 'update')
  } catch (err) {
    await resyncAfterPersistFailure()
    throw err
  }
}

export async function getRecordByApqrId(apqrId: string) {
  await ensureApqrDataLoaded()
  const sched = schedulerEntries.find((s) => s.apqr_id === apqrId && s.is_active)
  if (!sched) return null
  const client = clientById(sched.client_id)
  const record = recordBySchedulerId(sched.id)
  return { sched, client, record }
}

export async function saveRecord(apqrId: string, input: ApqrRecordInput): Promise<void> {
  const match = await getRecordByApqrId(apqrId)
  if (!match?.record || !match.sched) throw new Error('APQR record not found')

  if (input.apr_reference_number) {
    const ref = input.apr_reference_number.trim().toUpperCase()
    const dup = records.find((r) => r.apr_reference_number === ref && r.id !== match.record!.id)
    if (dup) throw new Error('Duplicate APR Reference Number Detected')
    input.apr_reference_number = ref
  }

  if (input.stability_tabulation_status === 'No Ongoing Stability' && !input.no_ongoing_stability_justification?.trim()) {
    throw new Error('A justification is required when No Ongoing Stability is selected.')
  }

  if (input.number_of_batches === 0 && !input.zero_batch_explanation?.trim()) {
    throw new Error('A remark is required when Number of Batches is zero.')
  }

  if (input.date_client_signed && input.apqr_report_status !== 'Client Approved') {
    throw new Error('Date Client Signed can only be set when APQR Report Status is Client Approved.')
  }

  if (input.apqr_report_status === 'Client Approved' && !input.date_client_signed) {
    throw new Error('Date Client Signed is required when APQR Report Status is Client Approved.')
  }

  const deliveryMeta = deliveryFieldsFromInput(
    match.sched.commitment_schedule,
    input.final_apqr_delivery_date ?? null,
    input.delay_category ?? null,
    input.delay_reason ?? null,
    input.apqr_report_status ?? null,
  )

  const idx = records.findIndex((r) => r.id === match.record!.id)
  const previous = records[idx]
  const ts = nowIso()
  const statusChanged = previous.apqr_report_status !== input.apqr_report_status
  const stabChanged = previous.stability_tabulation_status !== input.stability_tabulation_status

  let nextFollowUpDue = previous.next_follow_up_due_date
  if (input.apqr_report_status === 'For Client Approval' && statusChanged) {
    nextFollowUpDue = nextFollowUpDueDate(ts.slice(0, 10))
    await logApqrAudit({
      entity_type: 'record',
      entity_id: previous.id,
      entity_label: apqrId,
      action_type: 'reminder_scheduled',
      description: `Weekly follow-up reminder scheduled for ${apqrId}. First reminder due on ${nextFollowUpDue}.`,
      new_value: nextFollowUpDue,
    })
  }

  const updated: ApqrRecord = {
    ...previous,
    ...input,
    ...deliveryMeta,
    stability_tabulation_status_date:
      input.stability_tabulation_status_date !== undefined
        ? input.stability_tabulation_status_date || null
        : stabChanged
          ? ts.slice(0, 10)
          : previous.stability_tabulation_status_date,
    next_follow_up_due_date: nextFollowUpDue,
    updated_at: ts,
  }
  records[idx] = updated

  await auditFieldChanges(
    'record',
    updated.id,
    apqrId,
    previous,
    updated,
    [
      { key: 'department', label: 'Department' },
      { key: 'stability_tabulation_status', label: 'Stability Tabulation Status' },
      { key: 'stability_tabulation_status_date', label: 'Tabulation Status Date' },
      { key: 'apqr_report_status', label: 'APQR Report Status' },
      { key: 'sent_by', label: 'Sent By' },
      { key: 'date_sent', label: 'Date Sent' },
      { key: 'apr_reference_number', label: 'APR Reference Number' },
      { key: 'number_of_batches', label: 'Number of Batches' },
      { key: 'date_client_signed', label: 'Date Client Signed' },
      { key: 'final_apqr_delivery_date', label: 'Final APQR Delivery Date' },
      { key: 'delivery_classification', label: 'Delivery Classification' },
      { key: 'delay_category', label: 'Delay Category' },
      { key: 'delay_reason', label: 'Delay Reason' },
      { key: 'expected_final_delivery_date', label: 'Expected Final Delivery Date' },
    ],
  )
  try {
    await persistRecord(updated, 'update')
  } catch (err) {
    await resyncAfterPersistFailure()
    throw err
  }
}

export async function listFollowUps(recordId: string): Promise<ApqrFollowUp[]> {
  await ensureApqrDataLoaded()
  return followUps
    .filter((f) => f.record_id === recordId)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
}

export async function addFollowUp(
  apqrId: string,
  input: { follow_up_date: string; follow_up_remarks: string; recorded_by: string },
): Promise<ApqrFollowUp> {
  const match = await getRecordByApqrId(apqrId)
  if (!match?.record) throw new Error('APQR record not found')

  const ts = nowIso()
  const entry: ApqrFollowUp = {
    id: `apqr-fu-${followUps.length + 1}`,
    record_id: match.record.id,
    follow_up_date: input.follow_up_date,
    follow_up_remarks: input.follow_up_remarks.trim(),
    recorded_by: input.recorded_by.trim(),
    recorded_at: ts,
  }
  followUps.push(entry)

  const recordIdx = records.findIndex((r) => r.id === match.record!.id)
  records[recordIdx] = {
    ...records[recordIdx],
    next_follow_up_due_date: nextFollowUpDueDate(input.follow_up_date),
    updated_at: ts,
  }

  await logApqrAudit({
    entity_type: 'follow_up',
    entity_id: entry.id,
    entity_label: apqrId,
    action_type: 'follow_up_recorded',
    description: `Follow-up recorded for ${apqrId} on ${input.follow_up_date}.`,
    new_value: input.follow_up_remarks,
  })

  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient()
    if (sb) {
      const { error: followError } = await sb.from('apqr_follow_ups').insert({
        id: entry.id,
        record_id: entry.record_id,
        follow_up_date: entry.follow_up_date,
        follow_up_remarks: entry.follow_up_remarks,
        recorded_by: entry.recorded_by,
        recorded_at: entry.recorded_at,
      })
      if (followError) throw new Error(supabaseErrorMessage('Failed to save follow-up', followError))
      await persistRecord(records[recordIdx], 'update')
    }
  }

  return entry
}

export async function updateFollowUp(
  apqrId: string,
  followUpId: string,
  input: { follow_up_date: string; follow_up_remarks: string },
): Promise<void> {
  const match = await getRecordByApqrId(apqrId)
  if (!match?.record) throw new Error('APQR record not found')

  const idx = followUps.findIndex((f) => f.id === followUpId && f.record_id === match.record!.id)
  if (idx < 0) throw new Error('Follow-up not found')

  const previous = followUps[idx]
  followUps[idx] = {
    ...previous,
    follow_up_date: input.follow_up_date,
    follow_up_remarks: input.follow_up_remarks.trim(),
  }

  await logApqrAudit({
    entity_type: 'follow_up',
    entity_id: followUpId,
    entity_label: apqrId,
    action_type: 'follow_up_updated',
    description: `Follow-up updated for ${apqrId} on ${input.follow_up_date}.`,
    old_value: previous.follow_up_remarks,
    new_value: input.follow_up_remarks.trim(),
  })

  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient()
    if (sb) {
      const { error } = await sb
        .from('apqr_follow_ups')
        .update({
          follow_up_date: input.follow_up_date,
          follow_up_remarks: input.follow_up_remarks.trim(),
        })
        .eq('id', followUpId)
      if (error) throw new Error(supabaseErrorMessage('Failed to update follow-up', error))
    }
  }
}

export async function deleteFollowUp(apqrId: string, followUpId: string): Promise<void> {
  const match = await getRecordByApqrId(apqrId)
  if (!match?.record) throw new Error('APQR record not found')

  const idx = followUps.findIndex((f) => f.id === followUpId && f.record_id === match.record!.id)
  if (idx < 0) throw new Error('Follow-up not found')

  const removed = followUps[idx]
  followUps.splice(idx, 1)

  await logApqrAudit({
    entity_type: 'follow_up',
    entity_id: followUpId,
    entity_label: apqrId,
    action_type: 'follow_up_deleted',
    description: `Follow-up removed for ${apqrId} on ${removed.follow_up_date}.`,
    old_value: removed.follow_up_remarks,
  })

  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient()
    if (sb) {
      const { error } = await sb.from('apqr_follow_ups').delete().eq('id', followUpId)
      if (error) throw new Error(supabaseErrorMessage('Failed to delete follow-up', error))
    }
  }
}

export function getFollowUpReminders(rows = buildDatabaseRows()) {
  const today = new Date().toISOString().slice(0, 10)
  return rows.filter(
    (row) =>
      row.apqr_report_status === 'For Client Approval' &&
      row.next_follow_up_due_date &&
      row.next_follow_up_due_date <= today,
  )
}

export async function listDatabaseRows(): Promise<ApqrDatabaseRow[]> {
  await listClients()
  return buildDatabaseRows()
}

export async function listSentBySuggestions(): Promise<string[]> {
  await listClients()
  const fromData = new Set<string>()
  for (const record of records) {
    if (record.sent_by?.trim()) fromData.add(record.sent_by.trim())
  }
  for (const entry of followUps) {
    if (entry.recorded_by?.trim()) fromData.add(entry.recorded_by.trim())
  }
  return mergeSentBySuggestions([...fromData])
}

export async function listDepartmentSuggestions(): Promise<string[]> {
  await listClients()
  const fromData = new Set<string>()
  for (const record of records) {
    if (record.department?.trim()) fromData.add(record.department.trim())
  }
  return mergeDepartmentSuggestions([...fromData])
}

export async function listReportStatusSuggestions(): Promise<string[]> {
  await listClients()
  const fromData = new Set<string>()
  for (const record of records) {
    if (record.apqr_report_status?.trim()) fromData.add(record.apqr_report_status.trim())
  }
  return mergeReportStatusSuggestions([...fromData])
}

export async function listAccountManagerSuggestions(): Promise<string[]> {
  await listClients()
  const fromData = new Set<string>()
  for (const client of clients) {
    if (client.account_manager?.trim()) fromData.add(client.account_manager.trim())
  }
  return mergeAccountManagerSuggestions([...fromData])
}

export async function getDashboardMetrics(): Promise<ApqrDashboardMetrics> {
  const rows = await listDatabaseRows()
  return buildDashboardMetrics(rows)
}

export function formatApqrDate(iso: string | null | undefined): string {
  return formatAppDate(iso)
}

export function formatReviewCoverage(start: string, end: string): string {
  return `${formatApqrDate(start)} to ${formatApqrDate(end)}`
}

export function formatApqrDateTime(iso: string | null | undefined): string {
  return formatAppDateTime(iso)
}

export { schedById, clientById }
export { buildMonthlyDeliveryTrend, DELAY_CATEGORIES, requiresDelayInfo } from './apqrDelivery'
export { listApqrAuditEvents, formatAuditTimestamp } from './apqrAudit'
