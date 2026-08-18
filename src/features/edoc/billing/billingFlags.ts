/**
 * Client-visible billing flags. Fail closed: missing/false means billing UX is off.
 * Never read PADDLE_API_KEY or webhook secrets here (those are Edge-only).
 */

function truthyFlag(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

export function isBillingEnabled(): boolean {
  return truthyFlag(import.meta.env.VITE_BILLING_ENABLED)
}

export function isPaddleCheckoutEnabled(): boolean {
  return isBillingEnabled() && truthyFlag(import.meta.env.VITE_PADDLE_CHECKOUT_ENABLED)
}

export function isAnnualBillingEnabled(): boolean {
  return isBillingEnabled() && truthyFlag(import.meta.env.VITE_ANNUAL_BILLING_ENABLED)
}

export function isBusinessPlanEnabled(): boolean {
  return isBillingEnabled() && truthyFlag(import.meta.env.VITE_BUSINESS_PLAN_ENABLED)
}

export function isFreePlanLimitsEnabled(): boolean {
  return isBillingEnabled() && truthyFlag(import.meta.env.VITE_FREE_PLAN_LIMITS_ENABLED)
}

export function isBillingPortalEnabled(): boolean {
  return isBillingEnabled() && truthyFlag(import.meta.env.VITE_BILLING_PORTAL_ENABLED)
}

export function paddleClientEnv(): 'sandbox' | 'production' {
  return import.meta.env.VITE_PADDLE_ENV === 'production' ? 'production' : 'sandbox'
}

export function paddleClientToken(): string {
  return String(import.meta.env.VITE_PADDLE_CLIENT_TOKEN ?? '').trim()
}

export function canOpenPaddleCheckout(): boolean {
  return isPaddleCheckoutEnabled() && Boolean(paddleClientToken())
}
