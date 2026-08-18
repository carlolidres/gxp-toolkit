/**
 * Display/policy helpers for eDoc entitlements.
 * Postgres send/member triggers are the enforcement authority (C11, C7, C2).
 */

import { PAST_DUE_GRACE_DAYS, type InternalSubscriptionStatus, type PlanCode } from './billingTypes'

const MS_PER_DAY = 86_400_000

export type BillingLimitKind = 'documents' | 'seats'

export type EntitlementFlags = {
  billingEnabled: boolean
  freePlanLimitsEnabled: boolean
  paddleCheckoutEnabled: boolean
}

export type SubscriptionEntitlementInput = {
  status: InternalSubscriptionStatus | null
  planCode: PlanCode | null
  currentPeriodEndMs: number | null
  nowMs: number
}

export function resolveEffectivePlanCode(input: SubscriptionEntitlementInput): PlanCode {
  const status = input.status ?? 'FREE'
  const plan = input.planCode && input.planCode !== 'FREE' ? input.planCode : 'FREE'

  if (status === 'ACTIVE' || status === 'TRIALING') return plan
  if (status === 'FREE') return 'FREE'
  if (status === 'PAUSED' || status === 'EXPIRED') return 'FREE'

  if (status === 'CANCELED') {
    if (input.currentPeriodEndMs != null && input.nowMs < input.currentPeriodEndMs) return plan
    return 'FREE'
  }

  if (status === 'PAST_DUE') {
    if (input.currentPeriodEndMs == null) return plan
    if (input.nowMs <= input.currentPeriodEndMs + PAST_DUE_GRACE_DAYS * MS_PER_DAY) return plan
    return 'FREE'
  }

  return 'FREE'
}

export function shouldEnforceDocumentLimits(flags: EntitlementFlags, effectivePlanCode: PlanCode): boolean {
  if (!flags.billingEnabled) return false
  if (effectivePlanCode !== 'FREE') return true
  return flags.freePlanLimitsEnabled || flags.paddleCheckoutEnabled
}

export function canConsumeQuantity(used: number, limit: number, quantity = 1): boolean {
  if (quantity <= 0) return true
  if (limit < 0) return false
  return used + quantity <= limit
}

export function parseBillingLimitError(message: string): BillingLimitKind | null {
  if (message.includes('EDOC_DOCUMENT_QUOTA')) return 'documents'
  if (message.includes('EDOC_SEAT_LIMIT')) return 'seats'
  return null
}

export function billingLimitUserMessage(kind: BillingLimitKind): string {
  if (kind === 'documents') {
    return 'Your monthly document allowance has been reached. Upgrade to send more documents. Existing routes can still be signed.'
  }
  return 'This plan’s seat allowance has been reached. Upgrade to add another billable seat. External signers do not consume seats.'
}
