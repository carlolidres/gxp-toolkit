/**
 * Edge Paddle webhook helpers. Keep apply rules in sync with
 * src/features/edoc/billing/paddleWebhookApply.ts and paddleStatus.ts
 */

export const PADDLE_SIGNATURE_MAX_AGE_SECONDS = 300

function parseSignatureHeader(header: string): { ts: string; signatures: string[] } | null {
  const parts = header.split(';').map((part) => part.trim()).filter(Boolean)
  const ts = parts.find((part) => part.startsWith('ts='))?.slice(3) ?? ''
  const signatures = parts.filter((part) => part.startsWith('h1=')).map((part) => part.slice(3))
  if (!ts || signatures.length === 0) return null
  return { ts, signatures }
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

export async function verifyPaddleWebhookSignature(input: {
  rawBody: string
  signatureHeader: string
  secret: string
  nowSeconds?: number
}): Promise<boolean> {
  const secret = input.secret.trim()
  if (!secret || !input.rawBody || !input.signatureHeader) return false
  const parsed = parseSignatureHeader(input.signatureHeader)
  if (!parsed) return false
  const tsNumber = Number(parsed.ts)
  if (!Number.isFinite(tsNumber)) return false
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - tsNumber) > PADDLE_SIGNATURE_MAX_AGE_SECONDS) return false
  const expected = await hmacSha256Hex(secret, `${parsed.ts}:${input.rawBody}`)
  return parsed.signatures.some((signature) => timingSafeEqual(signature, expected))
}

export type PaddleWebhookEnvelope = {
  eventId: string
  eventType: string
  data: Record<string, unknown>
}

export function parsePaddleWebhookEnvelope(rawBody: string): PaddleWebhookEnvelope | null {
  try {
    const parsed = JSON.parse(rawBody) as { event_id?: string; event_type?: string; data?: unknown }
    const eventId = String(parsed.event_id ?? '').trim()
    const eventType = String(parsed.event_type ?? '').trim()
    if (!eventId || !eventType || !parsed.data || typeof parsed.data !== 'object') return null
    return { eventId, eventType, data: parsed.data as Record<string, unknown> }
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function customString(data: Record<string, unknown>, key: string): string | null {
  const custom = asRecord(data.custom_data)
  const value = custom?.[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function firstPriceId(data: Record<string, unknown>): string | null {
  const items = Array.isArray(data.items) ? data.items : []
  for (const item of items) {
    const row = asRecord(item)
    if (!row) continue
    if (typeof row.price_id === 'string' && row.price_id.startsWith('pri_')) return row.price_id
    const price = asRecord(row.price)
    if (typeof price?.id === 'string' && price.id.startsWith('pri_')) return price.id
  }
  return null
}

function mapPaddleSubscriptionStatus(paddleStatus: string): string {
  switch (paddleStatus.trim().toLowerCase()) {
    case 'trialing':
      return 'TRIALING'
    case 'active':
      return 'ACTIVE'
    case 'past_due':
      return 'PAST_DUE'
    case 'paused':
      return 'PAUSED'
    case 'canceled':
    case 'cancelled':
      return 'CANCELED'
    default:
      return 'EXPIRED'
  }
}

export type SubscriptionApplyPatch = {
  organizationId: string
  paddleSubscriptionId: string
  paddleCustomerId: string | null
  paddlePriceId: string | null
  planCode: string | null
  status: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export function subscriptionPatchFromPaddleData(data: Record<string, unknown>): SubscriptionApplyPatch | null {
  const organizationId = customString(data, 'organization_id')
  const paddleSubscriptionId = typeof data.id === 'string' ? data.id.trim() : ''
  if (!organizationId || !paddleSubscriptionId.startsWith('sub_')) return null
  const period = asRecord(data.current_billing_period)
  const scheduled = asRecord(data.scheduled_change)
  return {
    organizationId,
    paddleSubscriptionId,
    paddleCustomerId: typeof data.customer_id === 'string' ? data.customer_id : null,
    paddlePriceId: firstPriceId(data),
    planCode: customString(data, 'plan_code'),
    status: mapPaddleSubscriptionStatus(String(data.status ?? '')),
    currentPeriodStart: typeof period?.starts_at === 'string' ? period.starts_at : null,
    currentPeriodEnd: typeof period?.ends_at === 'string' ? period.ends_at : null,
    cancelAtPeriodEnd: scheduled?.action === 'cancel',
  }
}

export function isSubscriptionLifecycleEvent(eventType: string): boolean {
  return (
    eventType === 'subscription.created' ||
    eventType === 'subscription.updated' ||
    eventType === 'subscription.canceled' ||
    eventType === 'subscription.past_due' ||
    eventType === 'subscription.activated'
  )
}
