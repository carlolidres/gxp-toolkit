import type { PaidPlanCode } from './billingCatalog'

export type CheckoutCustomData = {
  organization_id: string
  user_id: string
  plan_code: PaidPlanCode
  environment: string
}

export function buildCheckoutCustomData(input: {
  organizationId: string
  userId: string
  planCode: PaidPlanCode
  environment: string
}): CheckoutCustomData {
  const organizationId = input.organizationId.trim()
  const userId = input.userId.trim()
  const environment = input.environment.trim()
  if (!organizationId) throw new Error('organization_id is required')
  if (!userId) throw new Error('user_id is required')
  if (!environment) throw new Error('environment is required')
  return {
    organization_id: organizationId,
    user_id: userId,
    plan_code: input.planCode,
    environment,
  }
}
