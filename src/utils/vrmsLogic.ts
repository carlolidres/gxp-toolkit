import type {
  RoutingDocument,
  SaveRoutingDocumentPayload,
  SignDocumentResult,
  VrmsDocumentStatus,
  VrmsSignatory,
} from '../types/vrms'
import { VRMS_ROUTING_FORM_FIELDS } from '../lib/vrmsFormConfig'
import { VRMS_DEFAULT_REGISTRY } from '../lib/vrmsDefaults'

const TRACKER_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const DISPLAY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const AUDIT_FIELD_LABELS: Partial<Record<keyof RoutingDocument, string>> = {
  docTracer: 'Document tracer',
  routingTracker: 'Routing tracker',
  equipmentProduct: 'Equipment/product',
  category: 'Category',
  ilTag: 'IL-Tag',
  status: 'Status',
  sentRoutingTo: 'Sent/Routing To',
  email: 'Email',
  dateSent: 'Date sent',
  reportProtocol: 'Report/protocol',
  batchNo: 'Batch number',
  clientName: 'Client name',
  department: 'Department',
  preparedBy: 'Prepared by',
  datePrepared: 'Date prepared',
  checkedBy: 'Checked by',
  dateChecked: 'Date checked',
  targetCompletionDate: 'Target completion date',
  remarks: 'Remarks',
  signatories: 'Signatories Tracker',
  totalRoutingDuration: 'Total routing duration',
  routingCompletedAt: 'Routing completed at',
}

const DIFF_FIELDS: (keyof RoutingDocument)[] = [
  'docTracer',
  'equipmentProduct',
  'category',
  'ilTag',
  'status',
  'sentRoutingTo',
  'email',
  'dateSent',
  'reportProtocol',
  'batchNo',
  'clientName',
  'department',
  'preparedBy',
  'datePrepared',
  'checkedBy',
  'dateChecked',
  'targetCompletionDate',
  'remarks',
  'signatories',
  'totalRoutingDuration',
  'routingCompletedAt',
]

export function getStatusKey(status: string): string {
  return String(status || '').trim().toLowerCase()
}

export function normalizeOptionalField(value: string | undefined): string {
  const text = String(value || '').trim()
  if (!text || text.toLowerCase() === 'n/a') return 'n/a'
  return text
}

export function formatVrmsDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function formatVrmsDisplayDateTime(date: Date): string {
  const hours = date.getHours()
  const hour12 = hours % 12 || 12
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getDate())} ${DISPLAY_MONTHS[date.getMonth()]} ${date.getFullYear()} ${pad(hour12)}:${pad(date.getMinutes())} ${ampm}`
}

export function isValidRegistryValue(value: string): boolean {
  const text = String(value || '').trim()
  return Boolean(text) && text.length <= 120 && /^[A-Za-z0-9][A-Za-z0-9 .,_/#()&+\-']*$/.test(text)
}

export function generateUniqueTracker(existingTrackers: string[]): string {
  const existing = new Set(existingTrackers.map((tracker) => tracker.trim()).filter(Boolean))

  for (let attempts = 0; attempts < 1000; attempts++) {
    let tracker = ''
    for (let i = 0; i < 4; i++) {
      tracker += TRACKER_CHARS.charAt(Math.floor(Math.random() * TRACKER_CHARS.length))
    }
    if (!existing.has(tracker)) return tracker
  }

  throw new Error('Unable to generate a unique tracker number. Please try again.')
}

export function normalizeSignatoryOrder(value: unknown, fallback: number): number {
  const text = String(value ?? '').trim()
  const match = text.match(/\d+/)
  const number = Number(match ? match[0] : value)
  return number > 0 ? number : fallback
}

export function normalizeSignatoryStatus(value: string): VrmsSignatory['Status'] {
  const text = String(value || '').trim().toLowerCase()
  if (text === 'signed' || text === 'completed' || text === 'complete') return 'Signed'
  if (text === 'active' || text === 'current' || text === 'routing') return 'Active'
  return 'Pending'
}

export function buildAllowedNameMap(allowedNames: string[]): Record<string, string> {
  return allowedNames.reduce<Record<string, string>>((map, name) => {
    const value = String(name || '').trim()
    if (value) map[value.toLowerCase()] = value
    return map
  }, {})
}

export function hasSigningStarted(signatories: VrmsSignatory[]): boolean {
  return signatories.some((item) => item.Status === 'Signed' || Boolean(item['Date/time signed']))
}

export function normalizeSignatories(
  incoming: VrmsSignatory[] | string,
  existing: VrmsSignatory[] | string,
  now: Date,
  isNew: boolean,
  shouldActivateRouting: boolean,
  allowedNames: string[],
): VrmsSignatory[] {
  let rows = parseSignatories(incoming)
  if (!rows.length) rows = parseSignatories(existing)
  const allowedMap = buildAllowedNameMap(allowedNames)

  rows = rows
    .map((item, index) => {
      const forwarded = normalizeDateTimeValue(item['Date/time forwarded'])
      const signed = normalizeDateTimeValue(item['Date/time signed'])
      return {
        Name: String(item.Name || '').trim(),
        Order: normalizeSignatoryOrder(item.Order, index + 1),
        Status: normalizeSignatoryStatus(item.Status || 'Pending'),
        'Date/time forwarded': forwarded,
        'Date/time signed': signed,
        'Duration pending/signing time': signed
          ? durationBetween(forwarded, signed)
          : String(item['Duration pending/signing time'] || '').trim(),
      }
    })
    .filter((item) => item.Name)
    .map((item) => {
      const allowedName = allowedMap[item.Name.toLowerCase()]
      if (!allowedName) {
        throw new Error(`Signatory/Approver Name "${item.Name}" is not in the Sent/Routing To registry.`)
      }
      item.Name = allowedName
      return item
    })
    .sort((a, b) => normalizeSignatoryOrder(a.Order, 0) - normalizeSignatoryOrder(b.Order, 0))
    .map((item, index) => {
      item.Order = index + 1
      item.Status = normalizeSignatoryStatus(item.Status)
      return item
    })

  if (
    shouldActivateRouting &&
    rows.length &&
    (isNew || rows.every((item) => item.Status === 'Pending' && !item['Date/time forwarded']))
  ) {
    rows[0].Status = 'Active'
    rows[0]['Date/time forwarded'] = formatVrmsDateTime(now)
  }

  const firstOpen = rows.find((item) => item.Status !== 'Signed')
  if (shouldActivateRouting && firstOpen) {
    rows.forEach((item) => {
      if (item.Status === 'Active' && item.Order !== firstOpen.Order) item.Status = 'Pending'
    })
    firstOpen.Status = 'Active'
    if (!firstOpen['Date/time forwarded'] && (isNew || rows.some((item) => item.Status === 'Signed'))) {
      firstOpen['Date/time forwarded'] = formatVrmsDateTime(now)
    }
  }

  return rows
}

export function parseSignatories(value: VrmsSignatory[] | string | undefined): VrmsSignatory[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(String(value)) as unknown
    return Array.isArray(parsed) ? (parsed as VrmsSignatory[]) : []
  } catch {
    return []
  }
}

export function serializeSignatories(rows: VrmsSignatory[]): string {
  return JSON.stringify(rows)
}

export function getActiveSignatoryName(signatories: VrmsSignatory[]): string {
  const active = signatories.find((item) => item.Status === 'Active')
  return active?.Name || ''
}

export function getTotalRoutingDuration(signatories: VrmsSignatory[]): string {
  if (!signatories.length || signatories.some((item) => item.Status !== 'Signed')) return ''
  const forwardedDates = signatories
    .map((item) => parseDateTime(item['Date/time forwarded']))
    .filter((value): value is Date => value !== null)
    .sort((a, b) => a.getTime() - b.getTime())
  const signedDates = signatories
    .map((item) => parseDateTime(item['Date/time signed']))
    .filter((value): value is Date => value !== null)
    .sort((a, b) => b.getTime() - a.getTime())
  if (!forwardedDates[0] || !signedDates[0]) return ''
  return durationBetween(forwardedDates[0], signedDates[0])
}

export function getRoutingCompletedAt(signatories: VrmsSignatory[]): string {
  if (!signatories.length || signatories.some((item) => item.Status !== 'Signed')) return ''
  const signedDates = signatories
    .map((item) => parseDateTime(item['Date/time signed']))
    .filter((value): value is Date => value !== null)
    .sort((a, b) => b.getTime() - a.getTime())
  return signedDates[0] ? formatVrmsDateTime(signedDates[0]) : ''
}

export function getRoutingCompleteStatus(statusRegistry: string[]): VrmsDocumentStatus {
  const completed = statusRegistry.find((status) => getStatusKey(status) === 'completed')
  const fullySigned = statusRegistry.find((status) => getStatusKey(status) === 'fully signed')
  return (completed || fullySigned || 'For Scanning') as VrmsDocumentStatus
}

export function getCurrentSignatory(signatories: VrmsSignatory[], requestedOrder: number): VrmsSignatory | null {
  const rows = [...signatories].sort(
    (a, b) => normalizeSignatoryOrder(a.Order, 0) - normalizeSignatoryOrder(b.Order, 0),
  )
  const active = rows.find((item) => item.Status === 'Active')
  if (active) return active

  const requested = normalizeSignatoryOrder(requestedOrder, 0)
  if (requested) {
    const requestedPending = rows.find(
      (item) => normalizeSignatoryOrder(item.Order, 0) === requested && item.Status !== 'Signed',
    )
    if (requestedPending) return requestedPending
  }

  return rows.find((item) => item.Status !== 'Signed') || null
}

export function diffDocuments(before: RoutingDocument, after: RoutingDocument): Record<string, { from: string; to: string }> {
  const changes: Record<string, { from: string; to: string }> = {}

  DIFF_FIELDS.forEach((field) => {
    const fromValue = formatDiffValue(before[field])
    const toValue = formatDiffValue(after[field])
    if (fromValue !== toValue) {
      changes[field] = { from: fromValue, to: toValue }
    }
  })

  return changes
}

export function formatAuditDetails(
  changes: Record<string, { from: string; to: string }>,
  user: string,
  now = new Date(),
): string {
  const keys = Object.keys(changes)
  if (!keys.length) {
    return `Document record was opened with no changes by ${user} on ${formatVrmsDisplayDateTime(now)}.`
  }

  return (
    keys
      .map((key) => {
        const change = changes[key]
        const label = AUDIT_FIELD_LABELS[key as keyof RoutingDocument] || key
        if (!change.from.trim()) return `${label} was set to ${auditValue(change.to)}.`
        if (!change.to.trim()) return `${label} was changed from ${auditValue(change.from)} to blank.`
        return `${label} was changed from ${auditValue(change.from)} to ${auditValue(change.to)}.`
      })
      .join(' ') + ` Updated by ${user} on ${formatVrmsDisplayDateTime(now)}.`
  )
}

export interface SaveDocumentResult {
  document: RoutingDocument
  isCreate: boolean
  auditAction: string
  auditDetails: string
}

export function validateRoutingPayload(payload: Partial<SaveRoutingDocumentPayload>): void {
  const missing = VRMS_ROUTING_FORM_FIELDS.filter(
    (field) => field.required && !String(payload[field.key as keyof SaveRoutingDocumentPayload] ?? '').trim(),
  )
  if (missing.length) {
    throw new Error(`${missing.map((field) => field.label).join(', ')} required.`)
  }
}

export function applySaveDocument(
  payload: SaveRoutingDocumentPayload,
  existing: RoutingDocument | undefined,
  allDocuments: RoutingDocument[],
  allowedSignatoryNames: string[],
  userEmail: string,
  now = new Date(),
): SaveDocumentResult {
  validateRoutingPayload(payload)
  const originalTracker = String(payload.__originalTracker || payload.routingTracker || '').trim()
  const docTracer = String(payload.docTracer || '').trim()
  if (!docTracer) throw new Error('Document Tracer Number is required.')

  let routingTracker = String(payload.routingTracker || originalTracker || '').trim()
  if (!routingTracker) {
    routingTracker = generateUniqueTracker(allDocuments.map((doc) => doc.routingTracker))
  }

  const duplicate = allDocuments.find(
    (doc) =>
      doc.docTracer.trim().toLowerCase() === docTracer.toLowerCase() &&
      doc.routingTracker !== routingTracker &&
      doc.routingTracker !== originalTracker,
  )
  if (duplicate) {
    throw new Error(`Document already existing. Tracking number assigned: ${duplicate.routingTracker}`)
  }

  if (!existing && allDocuments.some((doc) => doc.routingTracker === routingTracker)) {
    throw new Error(`Routing tracker already existing. Tracking number assigned: ${routingTracker}`)
  }

  if (existing && originalTracker && originalTracker !== routingTracker) {
    throw new Error('Routing tracker cannot be changed after creation.')
  }

  const statusKey = getStatusKey(payload.status)
  const isRouting = statusKey === 'routing'
  const isCancelled = statusKey === 'cancelled'

  const signatories = isCancelled
    ? []
    : normalizeSignatories(
        payload.signatories,
        existing?.signatories ?? [],
        now,
        !existing,
        isRouting,
        allowedSignatoryNames,
      )

  if (isRouting && !signatories.length) {
    throw new Error('Add at least one signatory before saving a document with Routing status.')
  }

  if (isRouting && signatories.length && !hasSigningStarted(signatories)) {
    const allowedMap = buildAllowedNameMap(allowedSignatoryNames)
    const sentRoutingTo = String(payload.sentRoutingTo || '').trim()
    const allowedName = allowedMap[sentRoutingTo.toLowerCase()]
    if (!allowedName) {
      throw new Error(
        'Please select the first routing recipient in Sent/Routing To before setting this document to Routing.',
      )
    }
    if (signatories[0].Name !== allowedName) {
      throw new Error('The first signatory must match the selected Sent/Routing To recipient.')
    }
  }

  const document: RoutingDocument = {
    routingTracker,
    docTracer,
    equipmentProduct: payload.equipmentProduct || existing?.equipmentProduct || '',
    category: payload.category || existing?.category || '',
    ilTag: normalizeOptionalField(payload.ilTag ?? existing?.ilTag),
    status: payload.status || existing?.status || '',
    sentRoutingTo: isRouting
      ? getActiveSignatoryName(signatories)
      : isCancelled
        ? ''
        : payload.sentRoutingTo || existing?.sentRoutingTo || '',
    email: payload.email ?? existing?.email ?? '',
    dateSent: payload.dateSent ?? existing?.dateSent ?? '',
    reportProtocol: payload.reportProtocol || existing?.reportProtocol || '',
    batchNo: payload.batchNo || existing?.batchNo || '',
    clientName: payload.clientName || existing?.clientName || '',
    department: payload.department || existing?.department || '',
    preparedBy: payload.preparedBy || existing?.preparedBy || '',
    datePrepared: payload.datePrepared || existing?.datePrepared || '',
    checkedBy: payload.checkedBy || existing?.checkedBy || '',
    dateChecked: payload.dateChecked || existing?.dateChecked || '',
    targetCompletionDate: payload.targetCompletionDate ?? existing?.targetCompletionDate ?? '',
    remarks: normalizeOptionalField(payload.remarks ?? existing?.remarks),
    signatories,
    totalRoutingDuration: getTotalRoutingDuration(signatories),
    routingCompletedAt: getRoutingCompletedAt(signatories),
    createdAt: existing?.createdAt || formatVrmsDateTime(now),
    updatedAt: formatVrmsDateTime(now),
    updatedBy: userEmail,
  }

  const isCreate = !existing
  if (isCreate) {
    return {
      document,
      isCreate: true,
      auditAction: 'Created document',
      auditDetails: `Document tracker "${routingTracker}" was created by ${userEmail} on ${formatVrmsDisplayDateTime(now)}.`,
    }
  }

  const changes = diffDocuments(existing, document)
  return {
    document,
    isCreate: false,
    auditAction: 'Updated document',
    auditDetails: formatAuditDetails(changes, userEmail, now),
  }
}

export function applySignDocumentSignatory(
  document: RoutingDocument,
  order: number,
  allowedSignatoryNames: string[],
  statusRegistry: string[],
  userEmail: string,
  now = new Date(),
): { document: RoutingDocument; result: SignDocumentResult; auditDetails: string } {
  const tracker = document.routingTracker.trim()
  if (!tracker) throw new Error('Missing routing tracker number.')

  if (getStatusKey(document.status) !== 'routing') {
    throw new Error('This document is no longer in Routing status and cannot be signed.')
  }

  const signatories = normalizeSignatories(
    document.signatories,
    '',
    now,
    false,
    true,
    allowedSignatoryNames,
  )
  if (!signatories.length) {
    throw new Error(`Signatory data is corrupted for tracker ${tracker}: no signatories exist.`)
  }

  const normalizedOrder = normalizeSignatoryOrder(order, 0)
  const active = getCurrentSignatory(signatories, normalizedOrder)
  const target =
    active ||
    signatories.find(
      (item) => normalizeSignatoryOrder(item.Order, 0) === normalizedOrder && item.Status !== 'Signed',
    )

  if (!target) {
    throw new Error(`All signatories are already signed for tracker ${tracker}.`)
  }
  if (target.Status === 'Signed') {
    throw new Error(`${target.Name || 'This signatory'} has already been marked as signed.`)
  }
  if (!active || normalizeSignatoryOrder(active.Order, 0) !== normalizeSignatoryOrder(target.Order, 0)) {
    throw new Error(
      `Only the current active signatory (${active?.Name || 'the next signer'}) can be marked as signed.`,
    )
  }

  const targetOldStatus = target.Status || 'Pending'
  target.Status = 'Signed'
  target['Date/time signed'] = formatVrmsDateTime(now)
  target['Duration pending/signing time'] = durationBetween(target['Date/time forwarded'], now)

  const targetOrder = normalizeSignatoryOrder(target.Order, 0)
  let next = signatories
    .filter((item) => item.Status !== 'Signed' && normalizeSignatoryOrder(item.Order, 0) > targetOrder)
    .sort((a, b) => normalizeSignatoryOrder(a.Order, 0) - normalizeSignatoryOrder(b.Order, 0))[0]

  if (!next) {
    next = signatories
      .filter((item) => item.Status !== 'Signed')
      .sort((a, b) => normalizeSignatoryOrder(a.Order, 0) - normalizeSignatoryOrder(b.Order, 0))[0]
  }

  let status: VrmsDocumentStatus = document.status || 'Routing'
  let nextName = ''
  if (next) {
    signatories.forEach((item) => {
      if (item !== next && item.Status !== 'Signed') item.Status = 'Pending'
    })
    next.Status = 'Active'
    if (!next['Date/time forwarded']) next['Date/time forwarded'] = formatVrmsDateTime(now)
    nextName = next.Name || ''
    status = 'Routing'
  } else {
    status = getRoutingCompleteStatus(statusRegistry)
  }

  const signedName = target.Name || 'This signatory'
  const signedAt = formatVrmsDisplayDateTime(now)
  const completionMessage =
    status !== 'Routing'
      ? ` ${signedName} signed routing document ${tracker}. Status was changed from "Routing" to "${status}" by ${userEmail} on ${signedAt}.`
      : ` The document was forwarded to "${nextName}" by ${userEmail} on ${signedAt}.`

  const updated: RoutingDocument = {
    ...document,
    status,
    sentRoutingTo: status === 'Routing' ? nextName : '',
    signatories,
    totalRoutingDuration: getTotalRoutingDuration(signatories),
    routingCompletedAt: status === 'Routing' ? '' : formatVrmsDateTime(now),
    updatedAt: formatVrmsDateTime(now),
    updatedBy: userEmail,
  }

  const auditDetails = `Signatory #${targetOrder} "${signedName}" was marked signed by ${userEmail} on ${signedAt}. Signatory #${targetOrder} "${signedName}" status changed from "${targetOldStatus}" to "Signed".${completionMessage}`

  return {
    document: updated,
    result: {
      signedName,
      nextName,
      final: status !== 'Routing',
      status,
    },
    auditDetails,
  }
}

function auditValue(value: string): string {
  const text = String(value || '').trim()
  if (!text) return 'blank'
  if (text.startsWith('[') || text.startsWith('{')) return 'updated'
  return `"${text}"`
}

function formatDiffValue(value: unknown): string {
  if (Array.isArray(value)) return serializeSignatories(value as VrmsSignatory[])
  return String(value ?? '')
}

function durationBetween(start: string | Date, end: string | Date): string {
  const minutes = durationMinutes(start, end)
  return minutes >= 0 ? humanDuration(minutes) : ''
}

function durationMinutes(start: string | Date, end: string | Date): number {
  const startDate = typeof start === 'string' ? parseDateTime(start) : start
  const endDate = typeof end === 'string' ? parseDateTime(end) : end
  if (!startDate || !endDate) return -1
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60_000))
}

function humanDuration(minutes: number): string {
  let remaining = Math.max(0, Number(minutes) || 0)
  const days = Math.floor(remaining / 1440)
  remaining -= days * 1440
  const hours = Math.floor(remaining / 60)
  remaining -= hours * 60
  const parts: string[] = []
  if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hr' : 'hrs'}`)
  if (remaining || !parts.length) parts.push(`${remaining} ${remaining === 1 ? 'min' : 'mins'}`)
  return parts.slice(0, 2).join(' ')
}

function normalizeDateTimeValue(value: string): string {
  const date = parseDateTime(value)
  return date ? formatVrmsDateTime(date) : ''
}

function parseDateTime(value: string): Date | null {
  if (!value) return null
  const text = String(value).trim()
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0),
    )
  }

  match = text.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i)
  if (match) {
    const monthIndex = DISPLAY_MONTHS.findIndex(
      (month) => month.toLowerCase() === match![2].slice(0, 3).toLowerCase(),
    )
    let hour = Number(match[4] || 0)
    const minute = Number(match[5] || 0)
    const ampm = String(match[6] || '').toUpperCase()
    if (ampm === 'PM' && hour < 12) hour += 12
    if (ampm === 'AM' && hour === 12) hour = 0
    if (monthIndex > -1) {
      return new Date(Number(match[3]), monthIndex, Number(match[1]), hour, minute, 0)
    }
  }

  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

export function buildDocumentSearchHaystack(doc: RoutingDocument): string {
  const signatoryText = doc.signatories
    .map((signatory) => `${signatory.Name} ${signatory.Status}`)
    .join(' ')
  return [
    doc.routingTracker,
    doc.docTracer,
    doc.equipmentProduct,
    doc.category,
    doc.ilTag,
    doc.status,
    doc.sentRoutingTo,
    doc.email,
    doc.dateSent,
    doc.reportProtocol,
    doc.batchNo,
    doc.clientName,
    doc.department,
    doc.preparedBy,
    doc.datePrepared,
    doc.checkedBy,
    doc.dateChecked,
    doc.targetCompletionDate,
    doc.remarks,
    signatoryText,
  ]
    .join(' ')
    .toLowerCase()
}

export function ensureDefaultRegistryValues(
  current: { registryType: string; value: string }[],
): { registryType: string; value: string }[] {
  if (current.length > 0) return current
  const next = [...current]
  const existing = new Set(next.map((row) => `${row.registryType}::${row.value.toLowerCase()}`))

  ;(Object.entries(VRMS_DEFAULT_REGISTRY) as [string, string[]][]).forEach(([registryType, values]) => {
    values.forEach((value) => {
      const key = `${registryType}::${value.toLowerCase()}`
      if (!existing.has(key)) {
        next.push({ registryType, value })
        existing.add(key)
      }
    })
  })

  return next
}
