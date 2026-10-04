/**
 * PayMongo webhook helpers. Keep apply rules in sync with
 * src/features/edoc/billing/paymongoWebhookApply.ts and paymongoStatus.ts
 *
 * GoTyme is settlement/treasury only. Never read payout status for entitlement.
 */

export const PAYMONGO_SIGNATURE_MAX_AGE_SECONDS = 300

export type PaymongoWebhookMode = 'test' | 'live'

function parseSignatureHeader(header: string): { ts: string; testSignature: string; liveSignature: string } | null {
  const parts = header.split(',').map((part) => part.trim()).filter(Boolean)
  const ts = parts.find((part) => part.startsWith('t='))?.slice(2) ?? ''
  const testSignature = parts.find((part) => part.startsWith('te='))?.slice(3) ?? ''
  const liveSignature = parts.find((part) => part.startsWith('li='))?.slice(3) ?? ''
  if (!ts || (!testSignature && !liveSignature)) return null
  return { ts, testSignature, liveSignature }
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

export async function verifyPaymongoWebhookSignature(input: {
  rawBody: string
  signatureHeader: string
  secret: string
  mode: PaymongoWebhookMode
  nowSeconds?: number
}): Promise<boolean> {
  const secret = input.secret.trim()
  if (!secret || !input.rawBody || !input.signatureHeader) return false
  const parsed = parseSignatureHeader(input.signatureHeader)
  if (!parsed) return false
  const tsNumber = Number(parsed.ts)
  if (!Number.isFinite(tsNumber)) return false
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - tsNumber) > PAYMONGO_SIGNATURE_MAX_AGE_SECONDS) return false
  const expected = await hmacSha256Hex(secret, `${parsed.ts}.${input.rawBody}`)
  const provided = input.mode === 'live' ? parsed.liveSignature : parsed.testSignature
  if (!provided) return false
  return timingSafeEqual(provided, expected)
}

export type PaymongoWebhookEnvelope = {
  eventId: string
  eventType: string
  livemode: boolean
  data: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function metaString(source: Record<string, unknown> | null, key: string): string | null {
  const metadata = asRecord(source?.metadata) ?? asRecord(source)
  const value = metadata?.[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function unixOrIsoToIso(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000
    return new Date(ms).toISOString()
  }
  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value)
    if (Number.isFinite(asNumber) && asNumber > 1_000_000_000) return unixOrIsoToIso(asNumber)
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString()
  }
  return null
}

function resourceAttributes(data: Record<string, unknown>): Record<string, unknown> {
  return asRecord(data.attributes) ?? data
}

export function parsePaymongoWebhookEnvelope(rawBody: string): PaymongoWebhookEnvelope | null {
  try {
    const parsed = JSON.parse(rawBody) as { data?: unknown }
    const root = asRecord(parsed.data)
    if (!root) return null
    const attrs = asRecord(root.attributes)
    const eventId = String(root.id ?? '').trim()
    const eventType = String(attrs?.type ?? root.type ?? '').trim()
    const resource = asRecord(attrs?.data) ?? asRecord(root.data)
    if (!eventId || !eventType || !resource) return null
    return {
      eventId,
      eventType,
      livemode: Boolean(attrs?.livemode ?? root.livemode),
      data: resource,
    }
  } catch {
    return null
  }
}

export function mapPaymongoSubscriptionStatus(paymongoStatus: string): string {
  switch (paymongoStatus.trim().toLowerCase()) {
    case 'incomplete':
      return 'PENDING'
    case 'incomplete_cancelled':
    case 'incomplete_canceled':
      return 'EXPIRED'
    case 'active':
      return 'ACTIVE'
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE'
    case 'paused':
      return 'PAUSED'
    case 'cancelled':
    case 'canceled':
      return 'CANCELED'
    default:
      return 'EXPIRED'
  }
}

export function isPaymongoSubscriptionEvent(eventType: string): boolean {
  return (
    eventType === 'subscription.updated' ||
    eventType === 'subscription.past_due' ||
    eventType === 'subscription.unpaid' ||
    eventType === 'invoice.paid'
  )
}

export function isPaymongoPaymentEvent(eventType: string): boolean {
  return (
    eventType === 'checkout_session.payment.paid' ||
    eventType === 'payment.paid' ||
    eventType === 'payment.failed' ||
    eventType === 'payment.refunded'
  )
}

export type PaymongoSubscriptionApplyPatch = {
  organizationId: string
  paymongoSubscriptionId: string | null
  paymongoCustomerId: string | null
  paymongoPlanId: string | null
  paymongoPaymentId: string | null
  planCode: string | null
  status: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  amountMinor: number | null
  currency: string | null
}

export function subscriptionPatchFromPaymongoData(
  data: Record<string, unknown>,
  eventType: string,
): PaymongoSubscriptionApplyPatch | null {
  const attrs = resourceAttributes(data)
  const organizationId = metaString(attrs, 'organization_id')
  if (!organizationId) return null

  const resourceType = String(data.type ?? attrs.type ?? '').trim()
  const resourceId = String(data.id ?? attrs.id ?? '').trim()
  const plan = asRecord(attrs.plan)
  const paymongoPlanId =
    (typeof plan?.id === 'string' ? plan.id : null) ||
    (typeof attrs.plan_id === 'string' ? attrs.plan_id : null) ||
    metaString(attrs, 'paymongo_plan_id')
  const planCode = metaString(attrs, 'plan_code')
  const customerId =
    (typeof attrs.customer_id === 'string' ? attrs.customer_id : null) ||
    metaString(attrs, 'customer_id')

  const isPayment =
    eventType === 'checkout_session.payment.paid' ||
    eventType === 'payment.paid' ||
    resourceType === 'checkout_session' ||
    resourceType === 'payment'

  const providerStatus = String(attrs.status ?? (isPayment ? 'paid' : '')).trim()
  let status = mapPaymongoSubscriptionStatus(providerStatus)
  if (eventType === 'payment.failed') status = 'PAST_DUE'
  if (eventType === 'payment.refunded') status = 'CANCELED'
  if (
    isPayment &&
    (providerStatus === 'paid' || eventType === 'checkout_session.payment.paid' || eventType === 'payment.paid')
  ) {
    status = 'ACTIVE'
  }

  const subscriptionId =
    metaString(attrs, 'subscription_id') ||
    (resourceType === 'subscription' || resourceId.startsWith('subs_') ? resourceId : null)

  return {
    organizationId,
    paymongoSubscriptionId: subscriptionId,
    paymongoCustomerId: customerId,
    paymongoPlanId,
    paymongoPaymentId: isPayment ? resourceId : null,
    planCode,
    status,
    currentPeriodStart: unixOrIsoToIso(attrs.current_period_start ?? attrs.period_start),
    currentPeriodEnd: unixOrIsoToIso(attrs.current_period_end ?? attrs.period_end),
    cancelAtPeriodEnd: Boolean(attrs.cancel_at_period_end),
    amountMinor: typeof attrs.amount === 'number' ? attrs.amount : null,
    currency: typeof attrs.currency === 'string' ? attrs.currency : 'PHP',
  }
}

export function periodEndFromInterval(interval: 'month' | 'year', from = new Date()): string {
  const next = new Date(from.getTime())
  if (interval === 'year') next.setUTCFullYear(next.getUTCFullYear() + 1)
  else next.setUTCMonth(next.getUTCMonth() + 1)
  return next.toISOString()
}
