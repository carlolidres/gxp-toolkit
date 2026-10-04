import type { PlanCode } from './billingTypes'

export type PaidPlanCode = Exclude<PlanCode, 'FREE'>

export type CatalogPlan = {
  code: PaidPlanCode | 'FREE'
  family: 'Free' | 'Personal' | 'Professional' | 'Business'
  interval: 'none' | 'month' | 'year'
  amountMinor: number
  currency: 'USD'
  documentsPerMonth: number
  seats: number
  description: string
}

export const PAID_PLAN_CODES: readonly PaidPlanCode[] = [
  'PERSONAL_MONTHLY',
  'PERSONAL_ANNUAL',
  'PRO_MONTHLY',
  'PRO_ANNUAL',
  'BUSINESS_MONTHLY',
  'BUSINESS_ANNUAL',
] as const

/** Display catalog — amounts match `database/sqlite/edoc_seed.sql`. */
export const BILLING_CATALOG: readonly CatalogPlan[] = [
  {
    code: 'FREE',
    family: 'Free',
    interval: 'none',
    amountMinor: 0,
    currency: 'USD',
    documentsPerMonth: 3,
    seats: 1,
    description: 'Full signing for a small monthly volume. No card required.',
  },
  {
    code: 'PERSONAL_MONTHLY',
    family: 'Personal',
    interval: 'month',
    amountMinor: 599,
    currency: 'USD',
    documentsPerMonth: 25,
    seats: 1,
    description: 'Electronic signing for one user, 25 documents per month.',
  },
  {
    code: 'PERSONAL_ANNUAL',
    family: 'Personal',
    interval: 'year',
    amountMinor: 5990,
    currency: 'USD',
    documentsPerMonth: 25,
    seats: 1,
    description: 'Electronic signing for one user, 25 documents per month.',
  },
  {
    code: 'PRO_MONTHLY',
    family: 'Professional',
    interval: 'month',
    amountMinor: 1299,
    currency: 'USD',
    documentsPerMonth: 100,
    seats: 1,
    description: 'Electronic signing for one user, 100 documents per month.',
  },
  {
    code: 'PRO_ANNUAL',
    family: 'Professional',
    interval: 'year',
    amountMinor: 12990,
    currency: 'USD',
    documentsPerMonth: 100,
    seats: 1,
    description: 'Electronic signing for one user, 100 documents per month.',
  },
  {
    code: 'BUSINESS_MONTHLY',
    family: 'Business',
    interval: 'month',
    amountMinor: 2999,
    currency: 'USD',
    documentsPerMonth: 300,
    seats: 5,
    description: 'Team signing, 300 documents per month, 5 seats.',
  },
  {
    code: 'BUSINESS_ANNUAL',
    family: 'Business',
    interval: 'year',
    amountMinor: 29990,
    currency: 'USD',
    documentsPerMonth: 300,
    seats: 5,
    description: 'Team signing, 300 documents per month, 5 seats.',
  },
]

export function isPaidPlanCode(value: string): value is PaidPlanCode {
  return (PAID_PLAN_CODES as readonly string[]).includes(value)
}

export function formatUsdFromMinor(amountMinor: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountMinor / 100)
}
