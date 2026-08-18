/**
 * eDoc billing types and locked policy constants (C1–C22).
 * Paddle owns billing state; eDoc owns entitlement.
 */

export const PAST_DUE_GRACE_DAYS = 14
export const BILLING_PROVIDER_PADDLE = 'paddle' as const

export type BillingInterval = 'none' | 'month' | 'year'

export type InternalSubscriptionStatus =
  | 'FREE'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'PAUSED'
  | 'CANCELED'
  | 'EXPIRED'

export type PlanCode =
  | 'FREE'
  | 'PERSONAL_MONTHLY'
  | 'PERSONAL_ANNUAL'
  | 'PRO_MONTHLY'
  | 'PRO_ANNUAL'
  | 'BUSINESS_MONTHLY'
  | 'BUSINESS_ANNUAL'

export const ENTITLEMENT_KEYS = {
  DOCUMENTS_PER_MONTH: 'DOCUMENTS_PER_MONTH',
  USERS_PER_ORG: 'USERS_PER_ORG',
} as const

export const USAGE_METRICS = {
  DOCUMENTS_SENT: 'DOCUMENTS_SENT',
} as const

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS]

/** C2: signing/finalize must keep working after these statuses. */
export const STATUSES_ALLOWING_IN_FLIGHT_SIGN: ReadonlySet<InternalSubscriptionStatus> = new Set([
  'FREE',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'PAUSED',
  'CANCELED',
  'EXPIRED',
])

/** New document sends: paid plans while active/trialing, or FREE/past-due-within-grace handled separately. */
export const STATUSES_ALLOWING_NEW_SEND: ReadonlySet<InternalSubscriptionStatus> = new Set([
  'FREE',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
])

export type CheckoutInput = {
  organizationId: string
  userId: string
  planCode: Exclude<PlanCode, 'FREE'>
  environment: 'sandbox' | 'production'
  successUrl: string
  cancelUrl: string
}

export type CheckoutResult = {
  checkoutUrl: string
  transactionId?: string
}

export type BillingProvider = {
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>
  getSubscription(providerSubscriptionId: string): Promise<unknown>
  cancelSubscription(providerSubscriptionId: string, timing: 'period_end' | 'immediately'): Promise<void>
  createCustomerPortalSession(
    providerCustomerId: string,
    providerSubscriptionId?: string,
  ): Promise<{ url: string }>
  updateSubscriptionPlan(input: {
    providerSubscriptionId: string
    priceId: string
    prorationBillingMode: 'prorated_immediately' | 'full_next_billing_period'
    customData: Record<string, string>
  }): Promise<void>
  verifyWebhook(headers: Headers, rawBody: string): boolean
  parseWebhook(rawBody: string): { id: string; type: string; data: unknown }
}

export class BillingNotConfiguredError extends Error {
  constructor(message = 'Paddle billing is not configured.') {
    super(message)
    this.name = 'BillingNotConfiguredError'
  }
}
