/**
 * Pure helpers for eDocuSign completion-history pages.
 * Mirrored from src/features/edoc/completionHistory.ts for Edge Functions.
 */

const REVIEWED_SIGNATURE_MEANINGS = new Set([
  'I reviewed this document.',
  'Reviewed by',
])

function isReviewedSignatureMeaning(value: string): boolean {
  return REVIEWED_SIGNATURE_MEANINGS.has(value)
}

export type HistoryTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

export type CompletionHistoryEvent = {
  sequence: number
  title: string
  actorLine?: string
  timestampLabel: string
  detailLines: string[]
  tone: HistoryTone
  /** Sort key ISO ms + rank + id for debugging */
  sortKey: string
}

export type AuditRowInput = {
  id: string
  event_type: string
  actor_id: string | null
  reason: string | null
  created_at: string
}

export type SignatureRowInput = {
  id: string
  signer_display_name: string
  signer_email: string | null
  signer_organization: string | null
  signature_meaning: string
  signing_timestamp: string
  source_ip: string | null
  auth_method: string
  signature_appearance_type: string | null
}

export type ActorInfo = {
  display_name?: string | null
  email?: string | null
  organization?: string | null
}

/** Event-type rank used when timestamps are equal (lower = earlier). */
export const AUDIT_SEQUENCE_RANK: Record<string, number> = {
  document_created: 10,
  route_started: 20,
  external_auth_requested: 30,
  external_auth_approved: 32,
  external_auth_rejected: 33,
  external_auth_transmitted: 34,
  review_completed: 40,
  approve_completed: 42,
  acknowledge_completed: 44,
  sign_completed: 50,
  return_completed: 60,
  reject_completed: 62,
  route_completed: 70,
  completion_certificate_generated: 90,
  history_page_appended: 91,
}

const SKIP_AUDIT_TYPES = new Set([
  'completion_certificate_generated',
  'history_page_appended',
])

/**
 * Human-readable history timestamp.
 * Example: `Aug 1, 2026, 4:40:29 PM GMT+8`
 * `timeZoneOffsetMinutes` is minutes east of UTC (e.g. 480 for GMT+8).
 */
export function formatHistoryTimestamp(input: string | Date, timeZoneOffsetMinutes = 0): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return String(input)

  const offsetMin = timeZoneOffsetMinutes
  const shifted = new Date(date.getTime() + offsetMin * 60_000)

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const hours24 = shifted.getUTCHours()
  const hours12 = hours24 % 12 || 12
  const ampm = hours24 < 12 ? 'AM' : 'PM'
  const pad = (n: number) => String(n).padStart(2, '0')
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const oh = String(Math.floor(abs / 60))
  const om = pad(abs % 60)
  const tz = om === '00' ? `GMT${sign}${oh}` : `GMT${sign}${oh}:${om}`

  return `${months[shifted.getUTCMonth()]} ${shifted.getUTCDate()}, ${shifted.getUTCFullYear()}, ${hours12}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())} ${ampm} ${tz}`
}

/** First hop in X-Forwarded-For (configured reverse-proxy client). Never returns the full chain. */
export function resolveTrustedClientIp(forwarded: string | null | undefined): string | null {
  if (!forwarded?.trim()) return null
  const first = forwarded.split(',')[0]?.trim()
  return first || null
}

/** Wrap long identifiers at safe character boundaries — never truncate with ellipsis. */
export function wrapIdentifier(value: string, maxCharsPerLine: number): string[] {
  const text = value.trim()
  if (!text) return ['']
  const size = Math.max(8, Math.floor(maxCharsPerLine))
  if (text.length <= size) return [text]
  const lines: string[] = []
  for (let i = 0; i < text.length; i += size) {
    lines.push(text.slice(i, i + size))
  }
  return lines
}

export function lifecycleTitleForAudit(eventType: string): string {
  const map: Record<string, string> = {
    document_created: 'DOCUMENT CREATED',
    route_started: 'ROUTING INITIATED',
    external_auth_requested: 'EXTERNAL AUTHORIZATION REQUESTED',
    external_auth_approved: 'EXTERNAL AUTHORIZATION APPROVED',
    external_auth_rejected: 'EXTERNAL AUTHORIZATION REJECTED',
    external_auth_transmitted: 'DOCUMENT TRANSMITTED',
    sign_completed: 'SIGNING TASK COMPLETED',
    review_completed: 'REVIEW COMPLETED',
    approve_completed: 'APPROVAL GRANTED',
    acknowledge_completed: 'ACKNOWLEDGMENT COMPLETED',
    reject_completed: 'APPROVAL REJECTED',
    return_completed: 'RETURNED FOR REVISION',
    route_completed: 'WORKFLOW COMPLETED',
  }
  return map[eventType] || eventType.replace(/_/g, ' ').toUpperCase()
}

export function toneForAuditEvent(eventType: string): HistoryTone {
  if (/reject|void|cancel|blocked/.test(eventType)) return 'danger'
  if (/return|warn|missing/.test(eventType)) return 'warning'
  if (/sign|approve|acknowledge|completed|approved|transmitted/.test(eventType)) return 'success'
  if (/email|notif|auth|route|request|creat/.test(eventType)) return 'info'
  return 'neutral'
}

function actorLine(actor: ActorInfo | null | undefined, fallbackName = 'System'): string {
  const name = (actor?.display_name || '').trim() || fallbackName
  const email = (actor?.email || '').trim()
  return email ? `${name} · ${email}` : name
}

function nearSameTime(a: string, b: string, windowMs = 2000): boolean {
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false
  return Math.abs(ta - tb) <= windowMs
}

/**
 * Build display lifecycle events from audit + signature rows.
 * Does not mutate the authoritative audit trail — display-only consolidation.
 */
export function buildCompletionHistoryEvents(input: {
  audits: AuditRowInput[]
  signatures: SignatureRowInput[]
  actors: Map<string, ActorInfo>
  routeCompletedAt: string | null
  timeZoneOffsetMinutes?: number
}): CompletionHistoryEvent[] {
  const { audits, signatures, actors, routeCompletedAt, timeZoneOffsetMinutes } = input
  const hasSignatureEvents = signatures.length > 0

  type Candidate = {
    id: string
    at: string
    rank: number
    event: Omit<CompletionHistoryEvent, 'sequence' | 'sortKey'>
  }

  const candidates: Candidate[] = []

  for (const row of audits) {
    if (SKIP_AUDIT_TYPES.has(row.event_type)) continue
    // Consolidate: when a signature manifestation exists, omit redundant completion audits.
    if (row.event_type === 'sign_completed' && hasSignatureEvents) continue
    if (
      row.event_type === 'review_completed'
      && signatures.some((sig) => isReviewedSignatureMeaning(sig.signature_meaning))
    ) {
      continue
    }
    // Omit route_completed audit if we add a synthetic workflow completed event.
    if (row.event_type === 'route_completed' && routeCompletedAt) continue

    const actor = row.actor_id ? actors.get(row.actor_id) : null
    const details: string[] = []
    if (row.reason) details.push(`Reason: ${row.reason}`)
    if (actor?.organization) details.push(`Organization: ${actor.organization}`)
    details.push(`Event ID: ${row.id}`)

    candidates.push({
      id: row.id,
      at: row.created_at,
      rank: AUDIT_SEQUENCE_RANK[row.event_type] ?? 100,
      event: {
        title: lifecycleTitleForAudit(row.event_type),
        actorLine: actorLine(actor),
        timestampLabel: formatHistoryTimestamp(row.created_at, timeZoneOffsetMinutes),
        detailLines: details,
        tone: toneForAuditEvent(row.event_type),
      },
    })
  }

  for (const sig of signatures) {
    const ip = resolveTrustedClientIp(sig.source_ip)
    const authLabel = sig.auth_method === 'password'
      ? 'Password re-authentication'
      : (sig.auth_method || 'Authenticated')
    const appearance = (sig.signature_appearance_type || 'image')
    const appearanceLabel = appearance.charAt(0).toUpperCase() + appearance.slice(1).toLowerCase()

    const details = [
      `Reason for signing: ${sig.signature_meaning}`,
      `Authentication: ${authLabel}`,
      `Signature appearance: ${appearanceLabel}`,
    ]
    if (sig.signer_organization) details.push(`Organization: ${sig.signer_organization}`)
    if (ip) details.push(`Source IP: ${ip}`)
    details.push(`Event ID: ${sig.id}`)

    const isReviewedBy = isReviewedSignatureMeaning(sig.signature_meaning)
    const signerName = (sig.signer_display_name || '').trim() || 'Reviewer'
    candidates.push({
      id: sig.id,
      at: sig.signing_timestamp,
      rank: 55,
      event: {
        title: isReviewedBy
          ? `Document reviewed and electronically signed by ${signerName}`
          : 'ELECTRONIC SIGNATURE APPLIED',
        actorLine: actorLine({
          display_name: sig.signer_display_name,
          email: sig.signer_email,
        }),
        timestampLabel: formatHistoryTimestamp(sig.signing_timestamp, timeZoneOffsetMinutes),
        detailLines: details,
        tone: 'success',
      },
    })
  }

  if (routeCompletedAt) {
    // Avoid duplicate if a signature timestamp already equals completion.
    const duplicate = candidates.some(
      (c) => c.event.title === 'WORKFLOW COMPLETED' || (
        c.rank >= 70 && nearSameTime(c.at, routeCompletedAt)
      ),
    )
    if (!duplicate) {
      candidates.push({
        id: `workflow-completed-${routeCompletedAt}`,
        at: routeCompletedAt,
        rank: 70,
        event: {
          title: 'WORKFLOW COMPLETED',
          timestampLabel: formatHistoryTimestamp(routeCompletedAt, timeZoneOffsetMinutes),
          detailLines: ['Completion history record generated for the final signed document.'],
          tone: 'success',
        },
      })
    }
  }

  candidates.sort((a, b) => {
    const ta = Date.parse(a.at)
    const tb = Date.parse(b.at)
    if (ta !== tb) return ta - tb
    if (a.rank !== b.rank) return a.rank - b.rank
    return a.id.localeCompare(b.id)
  })

  return candidates.map((c, index) => ({
    ...c.event,
    sequence: index + 1,
    sortKey: `${c.at}|${String(c.rank).padStart(3, '0')}|${c.id}`,
  }))
}

export function versionSummaryLabels(input: {
  versionId: string
  versionNumber?: number | null
}): { versionDisplay: string; versionIdLabel: string; revisionLabel?: string } {
  const versionId = input.versionId
  if (input.versionNumber != null && Number.isFinite(input.versionNumber)) {
    return {
      versionDisplay: `Revision ${input.versionNumber}`,
      versionIdLabel: versionId,
      revisionLabel: String(input.versionNumber),
    }
  }
  return {
    versionDisplay: 'Final signed version',
    versionIdLabel: versionId,
  }
}
