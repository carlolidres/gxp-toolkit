import { getSupabaseClient, isSupabaseConfigured } from '../../../lib/supabase'
import { BILLING_CATALOG } from './billingCatalog'
import type { InternalSubscriptionStatus, PlanCode } from './billingTypes'

export type BillingOverview = {
  organizationId: string | null
  limitsActive: boolean
  planCode: PlanCode
  status: InternalSubscriptionStatus
  documentsLimit: number
  documentsUsed: number
  seatsLimit: number
  seatsUsed: number
  periodEnd: string | null
  cancelAtPeriodEnd: boolean
  hasPaddleSubscription: boolean
  planName: string
}

function emptyOverview(): BillingOverview {
  return {
    organizationId: null,
    limitsActive: false,
    planCode: 'FREE',
    status: 'FREE',
    documentsLimit: 3,
    documentsUsed: 0,
    seatsLimit: 1,
    seatsUsed: 0,
    periodEnd: null,
    cancelAtPeriodEnd: false,
    hasPaddleSubscription: false,
    planName: 'Free',
  }
}

export async function loadBillingOverview(): Promise<BillingOverview> {
  if (!isSupabaseConfigured()) return emptyOverview()
  const client = getSupabaseClient()
  if (!client) return emptyOverview()

  const { data: snapshot, error: snapshotError } = await client.rpc('edoc_billing_entitlement_snapshot')
  if (snapshotError) throw new Error(snapshotError.message)
  const row = (snapshot ?? {}) as {
    organizationId?: string | null
    limitsActive?: boolean
    planCode?: string
    status?: string
    documentsLimit?: number
    documentsUsed?: number
    seatsLimit?: number
    seatsUsed?: number
  }

  const overview: BillingOverview = {
    ...emptyOverview(),
    organizationId: row.organizationId ?? null,
    limitsActive: Boolean(row.limitsActive),
    planCode: (row.planCode as PlanCode | undefined) ?? 'FREE',
    status: (row.status as InternalSubscriptionStatus | undefined) ?? 'FREE',
    documentsLimit: Number(row.documentsLimit ?? 3),
    documentsUsed: Number(row.documentsUsed ?? 0),
    seatsLimit: Number(row.seatsLimit ?? 1),
    seatsUsed: Number(row.seatsUsed ?? 0),
  }
  overview.planName = BILLING_CATALOG.find((plan) => plan.code === overview.planCode)?.family ?? overview.planCode

  if (!overview.organizationId) return overview

  const { data: subscription } = await client
    .from('edoc_subscriptions')
    .select('current_period_end, cancel_at_period_end, provider_subscription_id')
    .eq('organization_id', overview.organizationId)
    .maybeSingle()

  overview.periodEnd = typeof subscription?.current_period_end === 'string' ? subscription.current_period_end : null
  overview.cancelAtPeriodEnd = Boolean(subscription?.cancel_at_period_end)
  overview.hasPaddleSubscription = String(subscription?.provider_subscription_id ?? '').startsWith('sub_')
  return overview
}
