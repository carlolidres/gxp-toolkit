/**
 * One-org one-active-paid-subscription rule.
 * Provider-neutral: Paddle and PayMongo must not double-bill the same org.
 */

export const BILLING_PROVIDER_PADDLE = 'paddle' as const
export const BILLING_PROVIDER_PAYMONGO = 'paymongo' as const

export type BillingProviderName = typeof BILLING_PROVIDER_PADDLE | typeof BILLING_PROVIDER_PAYMONGO

/** Statuses that mean the org is already in a paid (or pending paid) relationship. */
export const BLOCKING_PAID_STATUSES = new Set(['PENDING', 'TRIALING', 'ACTIVE', 'PAST_DUE'])

export type ExistingSubscription = {
  provider: string
  status: string
}

export function existingSubscriptionBlocksCheckout(input: {
  existing: ExistingSubscription | null
  requestedProvider: BillingProviderName
}): { blocked: boolean; reason?: string } {
  if (!input.existing) return { blocked: false }
  if (!BLOCKING_PAID_STATUSES.has(input.existing.status)) return { blocked: false }
  if (input.existing.provider === input.requestedProvider && input.existing.status === 'PENDING') {
    return { blocked: false }
  }
  if (input.existing.provider === input.requestedProvider) {
    return {
      blocked: true,
      reason: 'This organization already has a paid subscription. Use Billing settings to change plans.',
    }
  }
  return {
    blocked: true,
    reason: `This organization already has an active ${input.existing.provider} subscription. Cancel that subscription before starting a ${input.requestedProvider} plan.`,
  }
}

export function existingSubscriptionBlocksProviderApply(input: {
  existing: ExistingSubscription | null
  incomingProvider: BillingProviderName
}): boolean {
  if (!input.existing) return false
  if (input.existing.provider === input.incomingProvider) return false
  return BLOCKING_PAID_STATUSES.has(input.existing.status)
}
