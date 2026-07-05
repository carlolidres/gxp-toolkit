#!/usr/bin/env node
/**
 * Parse APR monitoring reference CSVs and generate database/sqlite/apqr_seed.sql
 * plus src/data/apqrSeedData.json for mock/offline mode.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const REF = join(ROOT, 'reference', 'APR monitoring')

const CLIENT_CSV = join(REF, 'Client Contact Details (QA Technical  Regulatory) as of 26 June 2026.csv')
const SCHED_CSV = join(REF, 'APR Updates - 2026 Sched.csv')
const APR_CSV = join(REF, 'APR Updates - APR.csv')

const NOW = '2026-06-26T00:00:00.000Z'

const APQR_ID_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const APQR_ID_LOWER = 'abcdefghijklmnopqrstuvwxyz'
const APQR_ID_ALPHANUM = APQR_ID_UPPER + APQR_ID_LOWER + '0123456789'

/** @param {string} pool */
function randomApqrChar(pool) {
  return pool[Math.floor(Math.random() * pool.length)]
}

function generateApqrId() {
  const chars = [
    randomApqrChar(APQR_ID_UPPER),
    randomApqrChar(APQR_ID_LOWER),
    randomApqrChar(APQR_ID_ALPHANUM),
    randomApqrChar(APQR_ID_ALPHANUM),
  ]
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** @param {Set<string>} taken */
function generateUniqueApqrId(taken) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = generateApqrId()
    if (!taken.has(id)) {
      taken.add(id)
      return id
    }
  }
  throw new Error('Failed to generate unique APQR ID')
}

/** @param {string} text */
function parseCsv(text) {
  /** @type {string[][]} */
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i += 1
      row.push(field)
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
      field = ''
      continue
    }
    field += ch
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((cell) => cell.trim() !== '')) rows.push(row)
  }

  return rows
}

/** @param {string} value */
function sql(value) {
  if (value == null || value === '') return 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

/** @param {string} raw */
function normalizeWhitespace(raw) {
  return raw.replace(/\s+/g, ' ').trim()
}

/** @param {string} raw */
function parseDdMmmYyyy(raw) {
  const text = normalizeWhitespace(raw)
  const m = text.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (m) {
    const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
    const mm = months[m[2]]
    if (!mm) return null
    return `${m[3]}-${mm}-${m[1].padStart(2, '0')}`
  }
  const dmy = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/)
  if (dmy) {
    const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
    const mm = months[dmy[2]]
    if (!mm) return null
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${year}-${mm}-${dmy[1].padStart(2, '0')}`
  }
  return null
}

/** @param {string} raw */
function parseReviewCoverage(raw) {
  const text = normalizeWhitespace(raw)
  const m = text.match(/^(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+to\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})$/i)
  if (!m) return null
  const start = parseDdMmmYyyy(m[1])
  const end = parseDdMmmYyyy(m[2])
  if (!start || !end) return null
  return { start, end, display: `${m[1]} to ${m[2]}` }
}

/** @param {string} iso */
function addCalendarDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** @param {string} monthYear e.g. " Jan 2026" */
function parseMonthYear(monthYear) {
  const text = normalizeWhitespace(monthYear)
  const m = text.match(/^([A-Za-z]{3})\s+(\d{4})$/)
  if (!m) return null
  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
  const mm = months[m[1]]
  if (!mm) return null
  return `${m[2]}-${mm}-01`
}

const CLIENT_ALIASES = {
  Janssen: 'A.MENARINI',
  'GSK/Haleon': 'GLAXO SMITHKLINE CONSUMER HEALTHCARE PHILS',
  GSK: 'GLAXO SMITHKLINE CONSUMER HEALTHCARE PHILS',
  Haleon: 'HALEON PHILIPPINES, INC.',
  Pfizer: 'PFIZER INC.',
  'Zuellig (ZPC)': 'ZUELLIG PHARMA CORPORATION',
  Zuellig: 'ZUELLIG PHARMA CORPORATION',
  'J&J/JNTL (Kenvue)': 'JNTL CONSUMER HEALTH (PHILIPPINES), INC.',
  'J&J/JNTL': 'JNTL CONSUMER HEALTH (PHILIPPINES), INC.',
  Novartis: 'NOVARTIS HEALTHCARE PHILS. INC.',
  'ILI/Sandoz': 'SANDOZ PHILIPPINES CORP.',
  ILI: 'SANDOZ PHILIPPINES CORP.',
  Sandoz: 'SANDOZ PHILIPPINES CORP.',
  Zoetis: 'ZOETIS PHILIPPINES, INC.',
  'Aspen Philippines': 'ASPEN PHILIPPINES INC',
  Aspen: 'ASPEN PHILIPPINES INC',
  Pascual: 'PASCUAL PHARMA CORP.',
  Bayer: 'BAYER PHILIPPINES INCORPORATED',
  Taisho: 'TAISHO PHARMACEUTICAL PHILIPPINES',
  Abbott: 'ABBOTT LABORATORIES (PHILS.)',
  Foundation: 'FOUNDATION CONSUMER BRANDS, LLC',
  Stada: 'STADA ARZNEIMITTEL AG',
  Viatris: 'VIATRIS PHARMACEUTICALS, INC.',
  Menarini: 'A.MENARINI',
  'Euro-Med': 'EURO-MED LABORATORIES PHIL, INC.',
  Inova: 'INOVA PHARMACEUTICALS PHILIPPINES, INC.',
  'Metro Drug': 'METRO DRUG, INC.',
  Otsuka: 'OTSUKA (PHILS.) PHARMACEUTICAL, INC',
  HiEisai: 'HI-EISAI PHARMACEUTICALS, INC.',
  'Mundi/iNova': 'INOVA PHARMACEUTICALS PHILIPPINES, INC.',
  'ILI/Unilab': 'SANDOZ PHILIPPINES CORP.',
  'ILI/Plant 2': 'SANDOZ PHILIPPINES CORP.',
}

const DEPT_MAP = {
  Dry: 'Dry',
  Liquid: 'Liquids',
  Liquids: 'Liquids',
  'C&O': 'Creams and Ointments',
  Cosmetics: 'Cosmetics',
  Topicals: 'Topicals',
}

/** @param {string} shortName @param {Map<string, object>} byName */
function resolveClient(shortName, byName, byCode) {
  const key = normalizeWhitespace(shortName)
  if (!key) return null
  const alias = CLIENT_ALIASES[key]
  if (alias && byName.has(alias.toUpperCase())) return byName.get(alias.toUpperCase())
  const upper = key.toUpperCase()
  if (byName.has(upper)) return byName.get(upper)
  for (const [name, client] of byName) {
    if (name.includes(upper) || upper.includes(name)) return client
  }
  const codeGuess = key.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()
  if (byCode.has(codeGuess)) return byCode.get(codeGuess)
  return null
}

function loadClients() {
  const rows = parseCsv(readFileSync(CLIENT_CSV, 'utf8'))
  const headerIdx = rows.findIndex((r) => r[0] === 'CODE')
  /** @type {Map<string, object>} */
  const byName = new Map()
  /** @type {Map<string, object>} */
  const byCode = new Map()
  /** @type {object[]} */
  const clients = []

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const [codeRaw, am, name, qa, technical, regulatory] = rows[i]
    const code = normalizeWhitespace(codeRaw ?? '').padStart(3, '0')
    const clientName = normalizeWhitespace(name ?? '')
    if (!code || !clientName) continue

    const client = {
      id: `apqr-client-${code}`,
      code,
      account_manager: normalizeWhitespace((am ?? '').replace(/\s*\/\s*/g, ' / ')),
      client_name: clientName,
      qa: normalizeWhitespace(qa ?? '') || null,
      technical: normalizeWhitespace(technical ?? '') || null,
      regulatory: normalizeWhitespace(regulatory ?? '') || null,
      apqr_package: 'Billable',
      status: 'active',
      created_at: NOW,
      updated_at: NOW,
    }
    clients.push(client)
    byName.set(clientName.toUpperCase(), client)
    byCode.set(code, client)
  }

  return { clients, byName, byCode }
}

function loadScheduler(byName, byCode) {
  const rows = parseCsv(readFileSync(SCHED_CSV, 'utf8'))
  /** @type {object[]} */
  const entries = []
  let seq = 0

  /** @type {Set<string>} */
  const takenApqrIds = new Set()

  for (let i = 4; i < rows.length; i += 1) {
    const row = rows[i]
    if (!row[1]?.trim()) continue

    const pullOutRaw = row[0]
    const productName = normalizeWhitespace(row[1] ?? '')
    const productCode = normalizeWhitespace(row[2] ?? '').toUpperCase()
    const clientShort = normalizeWhitespace(row[3] ?? '')
    const coverage = parseReviewCoverage(row[4] ?? '')
    const commitmentRaw = row[5] ?? ''

    if (!productName || !productCode || !clientShort || !coverage) continue

    const client = resolveClient(clientShort, byName, byCode)
    if (!client) {
      console.warn(`Scheduler: unmatched client "${clientShort}" for ${productCode}`)
      continue
    }

    seq += 1
    const apqrId = generateUniqueApqrId(takenApqrIds)
    const commitment = parseDdMmmYyyy(commitmentRaw) ?? addCalendarDays(coverage.end, 90)
    const defaultPullOut = addCalendarDays(coverage.end, -60)
    const stabilityPullOut = parseMonthYear(pullOutRaw) ?? defaultPullOut

    const entry = {
      id: `apqr-sched-${String(seq).padStart(5, '0')}`,
      apqr_id: apqrId,
      client_id: client.id,
      client_code: client.code,
      client_name: client.client_name,
      account_manager: client.account_manager,
      apqr_package: client.apqr_package,
      stability_pull_out_date: stabilityPullOut,
      product_name: productName,
      product_code: productCode,
      review_coverage_start: coverage.start,
      review_coverage_end: coverage.end,
      review_coverage_display: coverage.display,
      commitment_schedule: commitment,
      commitment_schedule_status: 'Planned',
      schedule_status_date: null,
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    }
    entries.push(entry)
  }

  return entries
}

function loadAprUpdates(schedulerEntries) {
  const rows = parseCsv(readFileSync(APR_CSV, 'utf8'))
  const headerIdx = rows.findIndex((r) => r[0] === 'Month' && r[1] === 'Year')
  /** @type {Map<string, object>} */
  const byKey = new Map()
  for (const e of schedulerEntries) {
    byKey.set(`${e.client_name.toUpperCase()}|${e.product_code}`, e)
    byKey.set(`${e.product_code}`, e)
  }

  /** @type {object[]} */
  const records = []

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rows[i]
    const productName = normalizeWhitespace(row[2] ?? '')
    const productCode = normalizeWhitespace(row[3] ?? '').split('/')[0].trim().toUpperCase()
    const deptRaw = normalizeWhitespace(row[4] ?? '')
    const department = DEPT_MAP[deptRaw] ?? (deptRaw || null)
    const clientShort = normalizeWhitespace(row[5] ?? '')
    if (!productName || !productCode) continue

    const sched =
      byKey.get(`${clientShort.toUpperCase()}|${productCode}`) ??
      byKey.get(productCode) ??
      schedulerEntries.find(
        (e) =>
          e.product_code === productCode &&
          e.client_name.toUpperCase().includes(clientShort.toUpperCase().split('/')[0]),
      )

    if (!sched) continue

    const stability = normalizeWhitespace(row[6] ?? '').toLowerCase()
    const tabSent = normalizeWhitespace(row[7] ?? '')
    const billing = normalizeWhitespace(row[8] ?? '')
    const status = normalizeWhitespace(row[9] ?? '')
    const sentBy = normalizeWhitespace(row[10] ?? '') || null
    const dateSent = parseDdMmmYyyy(row[11] ?? '')
    const aprRef = normalizeWhitespace(row[14] ?? '').toUpperCase() || null
    const batchesRaw = normalizeWhitespace(row[16] ?? '')
    const batches = batchesRaw && /^\d+$/.test(batchesRaw) ? Number(batchesRaw) : null
    const dateSigned = parseDdMmmYyyy(row[17] ?? '')

    let stabStatus = null
    if (stability === 'sent') stabStatus = 'Sent'
    else if (tabSent) stabStatus = 'Sent'

    let reportStatus = null
    if (/client approved/i.test(status)) reportStatus = 'Client Approved'
    else if (/for client approval/i.test(status)) reportStatus = 'For Client Approval'
    else if (/draft sent/i.test(status)) reportStatus = 'Draft Sent'

    records.push({
      id: `apqr-rec-${sched.id.replace('apqr-sched-', '')}`,
      scheduler_entry_id: sched.id,
      apqr_id: sched.apqr_id,
      department,
      stability_tabulation_status: stabStatus,
      stability_tabulation_status_date: tabSent ? parseDdMmmYyyy(tabSent.split(' ').slice(-3).join(' ')) : null,
      billing_reference_number: billing || null,
      apqr_report_status: reportStatus,
      sent_by: sentBy,
      date_sent: dateSent,
      apr_reference_number: aprRef,
      number_of_batches: batches,
      date_client_signed: dateSigned,
      record_status: 'active',
      created_at: NOW,
      updated_at: NOW,
    })
  }

  const seen = new Set()
  return records.filter((r) => {
    if (seen.has(r.scheduler_entry_id)) return false
    seen.add(r.scheduler_entry_id)
    return true
  })
}

function main() {
  const { clients, byName, byCode } = loadClients()
  const schedulerEntries = loadScheduler(byName, byCode)
  const existingSchedIds = new Set(schedulerEntries.map((e) => e.id))
  let aprRecords = loadAprUpdates(schedulerEntries)

  for (const sched of schedulerEntries) {
    if (!aprRecords.some((r) => r.scheduler_entry_id === sched.id)) {
      aprRecords.push({
        id: `apqr-rec-${sched.id.replace('apqr-sched-', '')}`,
        scheduler_entry_id: sched.id,
        apqr_id: sched.apqr_id,
        department: null,
        stability_tabulation_status: null,
        stability_tabulation_status_date: null,
        billing_reference_number: null,
        apqr_report_status: null,
        sent_by: null,
        date_sent: null,
        apr_reference_number: null,
        number_of_batches: null,
        date_client_signed: null,
        record_status: 'active',
        created_at: NOW,
        updated_at: NOW,
      })
    }
  }

  const sqlLines = [
    '-- APQR seed from reference/APR monitoring CSVs',
    '-- Generated by scripts/generate-apqr-seed.mjs — do not edit by hand',
    '',
    'DELETE FROM apqr_follow_ups;',
    'DELETE FROM apqr_audit_events;',
    'DELETE FROM apqr_records;',
    'DELETE FROM apqr_scheduler_entries;',
    'DELETE FROM apqr_clients;',
    'DELETE FROM apqr_id_sequences;',
    '',
  ]

  for (const client of clients) {
    sqlLines.push(
      `INSERT INTO apqr_clients (id, code, account_manager, client_name, qa, technical, regulatory, apqr_package, status, created_at, updated_at) VALUES (${sql(client.id)}, ${sql(client.code)}, ${sql(client.account_manager)}, ${sql(client.client_name)}, ${sql(client.qa)}, ${sql(client.technical)}, ${sql(client.regulatory)}, ${sql(client.apqr_package)}, ${sql(client.status)}, ${sql(client.created_at)}, ${sql(client.updated_at)});`,
    )
  }

  for (const e of schedulerEntries) {
    sqlLines.push(
      `INSERT INTO apqr_scheduler_entries (id, apqr_id, client_id, stability_pull_out_date, product_name, product_code, review_coverage_start, review_coverage_end, commitment_schedule, commitment_schedule_status, schedule_status_date, is_active, created_at, updated_at) VALUES (${sql(e.id)}, ${sql(e.apqr_id)}, ${sql(e.client_id)}, ${sql(e.stability_pull_out_date)}, ${sql(e.product_name)}, ${sql(e.product_code)}, ${sql(e.review_coverage_start)}, ${sql(e.review_coverage_end)}, ${sql(e.commitment_schedule)}, ${sql(e.commitment_schedule_status)}, NULL, 1, ${sql(e.created_at)}, ${sql(e.updated_at)});`,
    )
  }

  for (const r of aprRecords) {
    sqlLines.push(
      `INSERT INTO apqr_records (id, scheduler_entry_id, department, stability_tabulation_status, stability_tabulation_status_date, billing_reference_number, apqr_report_status, sent_by, date_sent, apr_reference_number, number_of_batches, date_client_signed, record_status, created_at, updated_at) VALUES (${sql(r.id)}, ${sql(r.scheduler_entry_id)}, ${sql(r.department)}, ${sql(r.stability_tabulation_status)}, ${sql(r.stability_tabulation_status_date)}, ${sql(r.billing_reference_number)}, ${sql(r.apqr_report_status)}, ${sql(r.sent_by)}, ${sql(r.date_sent)}, ${sql(r.apr_reference_number)}, ${r.number_of_batches ?? 'NULL'}, ${sql(r.date_client_signed)}, ${sql(r.record_status)}, ${sql(r.created_at)}, ${sql(r.updated_at)});`,
    )
  }

  const seedPath = join(ROOT, 'database', 'sqlite', 'apqr_seed.sql')
  writeFileSync(seedPath, `${sqlLines.join('\n')}\n`, 'utf8')

  const pgLines = [
    '-- APQR Postgres seed — generated by scripts/generate-apqr-seed.mjs',
    'DELETE FROM public.apqr_follow_ups;',
    'DELETE FROM public.apqr_audit_events;',
    'DELETE FROM public.apqr_records;',
    'DELETE FROM public.apqr_scheduler_entries;',
    'DELETE FROM public.apqr_clients;',
    'DELETE FROM public.apqr_id_sequences;',
    '',
  ]

  for (const client of clients) {
    pgLines.push(
      `INSERT INTO public.apqr_clients (id, code, account_manager, client_name, qa, technical, regulatory, apqr_package, status, created_at, updated_at) VALUES (${sql(client.id)}, ${sql(client.code)}, ${sql(client.account_manager)}, ${sql(client.client_name)}, ${sql(client.qa)}, ${sql(client.technical)}, ${sql(client.regulatory)}, ${sql(client.apqr_package)}, ${sql(client.status)}, ${sql(client.created_at)}::timestamptz, ${sql(client.updated_at)}::timestamptz);`,
    )
  }

  for (const e of schedulerEntries) {
    pgLines.push(
      `INSERT INTO public.apqr_scheduler_entries (id, apqr_id, client_id, stability_pull_out_date, product_name, product_code, review_coverage_start, review_coverage_end, commitment_schedule, commitment_schedule_status, schedule_status_date, is_active, created_at, updated_at) VALUES (${sql(e.id)}, ${sql(e.apqr_id)}, ${sql(e.client_id)}, ${sql(e.stability_pull_out_date)}::date, ${sql(e.product_name)}, ${sql(e.product_code)}, ${sql(e.review_coverage_start)}::date, ${sql(e.review_coverage_end)}::date, ${sql(e.commitment_schedule)}::date, ${sql(e.commitment_schedule_status)}, NULL, true, ${sql(e.created_at)}::timestamptz, ${sql(e.updated_at)}::timestamptz);`,
    )
  }

  for (const r of aprRecords) {
    pgLines.push(
      `INSERT INTO public.apqr_records (id, scheduler_entry_id, department, stability_tabulation_status, stability_tabulation_status_date, billing_reference_number, apqr_report_status, sent_by, date_sent, apr_reference_number, number_of_batches, date_client_signed, record_status, created_at, updated_at) VALUES (${sql(r.id)}, ${sql(r.scheduler_entry_id)}, ${sql(r.department)}, ${sql(r.stability_tabulation_status)}, ${sql(r.stability_tabulation_status_date)}::date, ${sql(r.billing_reference_number)}, ${sql(r.apqr_report_status)}, ${sql(r.sent_by)}, ${sql(r.date_sent)}::date, ${sql(r.apr_reference_number)}, ${r.number_of_batches ?? 'NULL'}, ${sql(r.date_client_signed)}::date, ${sql(r.record_status)}, ${sql(r.created_at)}::timestamptz, ${sql(r.updated_at)}::timestamptz);`,
    )
  }

  const pgSeedPath = join(ROOT, 'supabase', 'scripts', 'seed_apqr_data.sql')
  writeFileSync(pgSeedPath, `${pgLines.join('\n')}\n`, 'utf8')

  const jsonPath = join(ROOT, 'src', 'data', 'apqrSeedData.json')
  writeFileSync(
    jsonPath,
    JSON.stringify({ clients, schedulerEntries, records: aprRecords, generatedAt: NOW }, null, 2),
    'utf8',
  )

  console.log(`Wrote ${clients.length} clients, ${schedulerEntries.length} scheduler rows, ${aprRecords.length} records`)
  console.log(`  ${seedPath}`)
  console.log(`  ${pgSeedPath}`)
}

main()
