import type { PlanCode } from './billingTypes'
import { BILLING_CATALOG } from './billingCatalog'

export type PlanChangeKind = 'upgrade' | 'downgrade' | 'same'

export function planRank(code: PlanCode): number {
  const family = code.startsWith('BUSINESS') ? 30 : code.startsWith('PRO') ? 20 : code.startsWith('PERSONAL') ? 10 : 0
  const interval = code.endsWith('_ANNUAL') ? 1 : 0
  return family + interval
}

export function classifyPlanChange(from: PlanCode, to: PlanCode): PlanChangeKind {
  const current = planRank(from)
  const next = planRank(to)
  if (next > current) return 'upgrade'
  if (next < current) return 'downgrade'
  return 'same'
}

export function catalogSeatsForPlan(code: PlanCode): number {
  return BILLING_CATALOG.find((plan) => plan.code === code)?.seats ?? 1
}

/** C7: downgrade only if current billable seats fit the target plan. */
export function canDowngradeSeats(billableSeatsUsed: number, targetPlan: PlanCode): boolean {
  return billableSeatsUsed <= catalogSeatsForPlan(targetPlan)
}
