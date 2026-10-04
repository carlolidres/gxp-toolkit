export type PaidPlanCode =
  | 'PERSONAL_MONTHLY'
  | 'PERSONAL_ANNUAL'
  | 'PRO_MONTHLY'
  | 'PRO_ANNUAL'
  | 'BUSINESS_MONTHLY'
  | 'BUSINESS_ANNUAL'

export type PlanCode = PaidPlanCode | 'FREE'
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
