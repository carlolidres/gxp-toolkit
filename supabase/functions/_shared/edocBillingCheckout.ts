/**
 * Edge checkout helpers. Keep return-URL rules in sync with
 * src/features/edoc/billing/billingUrls.ts
 */

export type PaidPlanCode =
  | 'PERSONAL_MONTHLY'
  | 'PERSONAL_ANNUAL'
  | 'PRO_MONTHLY'
  | 'PRO_ANNUAL'
  | 'BUSINESS_MONTHLY'
  | 'BUSINESS_ANNUAL'

export const PAID_PLAN_CODES: readonly PaidPlanCode[] = [
  'PERSONAL_MONTHLY',
  'PERSONAL_ANNUAL',
  'PRO_MONTHLY',
  'PRO_ANNUAL',
  'BUSINESS_MONTHLY',
  'BUSINESS_ANNUAL',
]

/** Sandbox catalog IDs (not secrets). Override with PADDLE_PRICE_* Edge secrets. */
export const SANDBOX_PRICE_IDS: Record<PaidPlanCode, string> = {
  PERSONAL_MONTHLY: 'pri_01m09kd9fw8tpbeyrcnsrzy4ea',
  PERSONAL_ANNUAL: 'pri_01m09kem1734t13qt18y2xn75x',
  PRO_MONTHLY: 'pri_01m09kvd9rxggqb1jf49aknn4k',
  PRO_ANNUAL: 'pri_01m09kwn51w0ej0ptxstf5jwxx',
  BUSINESS_MONTHLY: 'pri_01m09m0pt9rmyp7fweexttyd4b',
  BUSINESS_ANNUAL: 'pri_01m09m1t2zg6t1pp8ppnwa1858',
}

export function isPaidPlanCode(value: string): value is PaidPlanCode {
  return (PAID_PLAN_CODES as readonly string[]).includes(value)
}

export function isEdgeCheckoutEnabled(): boolean {
  return Deno.env.get('BILLING_ENABLED') === 'true' && Deno.env.get('PADDLE_CHECKOUT_ENABLED') === 'true'
}

export function isEdgePortalEnabled(): boolean {
  return Deno.env.get('BILLING_ENABLED') === 'true' && Deno.env.get('BILLING_PORTAL_ENABLED') === 'true'
}

export function paddleApiBase(): string {
  return Deno.env.get('PADDLE_ENV') === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com'
}

export function priceIdForPlan(planCode: PaidPlanCode): string {
  const fromEnv = Deno.env.get(`PADDLE_PRICE_${planCode}`)?.trim()
  if (fromEnv) return fromEnv
  if (Deno.env.get('PADDLE_ENV') === 'production') {
    throw new Error(`PADDLE_PRICE_${planCode} is required in production`)
  }
  return SANDBOX_PRICE_IDS[planCode]
}

export function isAllowedBillingReturnUrl(value: string, kind: 'success' | 'cancelled'): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return false
    if (url.protocol === 'https:' && url.hostname !== 'carlolidres.github.io') return false
    const expectedHash = kind === 'success' ? '#/billing/success' : '#/billing/cancelled'
    if (url.hash !== expectedHash) return false
    if (url.searchParams.get('billing') !== (kind === 'success' ? 'success' : 'cancelled')) return false
    return true
  } catch {
    return false
  }
}

export function buildCheckoutCustomData(input: {
  organizationId: string
  userId: string
  planCode: PaidPlanCode
  environment: string
}): Record<string, string> {
  return {
    organization_id: input.organizationId.trim(),
    user_id: input.userId.trim(),
    plan_code: input.planCode,
    environment: input.environment.trim(),
  }
}
