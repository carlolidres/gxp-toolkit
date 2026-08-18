import { mapPaddleSubscriptionStatus } from './paddleStatus'
import type { InternalSubscriptionStatus } from './billingTypes'

export type PaddleWebhookEnvelope = {
  eventId: string
  eventType: string
  data: Record<string, unknown>
}

export type SubscriptionApplyPatch = {
  organizationId: string
  paddleSubscriptionId: string
  paddleCustomerId: string | null
  paddlePriceId: string | null
  planCode: string | null
  status: InternalSubscriptionStatus
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export function parsePaddleWebhookEnvelope(rawBody: string): PaddleWebhookEnvelope | null {
  try {
    const parsed = JSON.parse(rawBody) as {
      event_id?: string
      event_type?: string
      data?: unknown
    }
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
