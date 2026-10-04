import { mapPaymongoSubscriptionStatus } from './paymongoStatus'
import type { InternalSubscriptionStatus } from './billingTypes'

export type PaymongoWebhookEnvelope = {
  eventId: string
  eventType: string
  livemode: boolean
  data: Record<string, unknown>
}

export type PaymongoSubscriptionApplyPatch = {
  organizationId: string
  paymongoSubscriptionId: string | null
  paymongoCustomerId: string | null
  paymongoPlanId: string | null
  paymongoPaymentId: string | null
  planCode: string | null
  status: InternalSubscriptionStatus
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  amountMinor: number | null
  currency: string | null
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

export function subscriptionPatchFromPaymongoData(
  data: Record<string, unknown>,
  eventType: string,
): PaymongoSubscriptionApplyPatch | null {
  const attrs = resourceAttributes(data)
  const metadataSource = attrs
  const organizationId = metaString(metadataSource, 'organization_id')
  if (!organizationId) return null

  const resourceType = String(data.type ?? attrs.type ?? '').trim()
  const resourceId = String(data.id ?? attrs.id ?? '').trim()
  const plan = asRecord(attrs.plan)
  const paymongoPlanId =
    (typeof plan?.id === 'string' ? plan.id : null) ||
    (typeof attrs.plan_id === 'string' ? attrs.plan_id : null) ||
    metaString(metadataSource, 'paymongo_plan_id')
  const planCode = metaString(metadataSource, 'plan_code')
  const customerId =
    (typeof attrs.customer_id === 'string' ? attrs.customer_id : null) ||
    metaString(metadataSource, 'customer_id')

  const isPayment =
    eventType === 'checkout_session.payment.paid' ||
    eventType === 'payment.paid' ||
    resourceType === 'checkout_session' ||
    resourceType === 'payment'

  const providerStatus = String(attrs.status ?? (isPayment ? 'paid' : '')).trim()
  let status = mapPaymongoSubscriptionStatus(providerStatus)
  if (eventType === 'payment.failed') status = 'PAST_DUE'
  if (eventType === 'payment.refunded') status = 'CANCELED'
  if (isPayment && (providerStatus === 'paid' || eventType === 'checkout_session.payment.paid' || eventType === 'payment.paid')) {
    status = 'ACTIVE'
  }

  const subscriptionId =
    metaString(metadataSource, 'subscription_id') ||
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
