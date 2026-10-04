import type { PaidPlanCode } from './billingCatalog'

/** PHP list prices (centavos) from the PayMongo plan. Internal plan codes stay provider-neutral. */
export const PAYMONGO_PHP_AMOUNT_MINOR: Record<PaidPlanCode, number> = {
  PERSONAL_MONTHLY: 19900,
  PERSONAL_ANNUAL: 238800,
  PRO_MONTHLY: 49900,
  PRO_ANNUAL: 598800,
  BUSINESS_MONTHLY: 99900,
  BUSINESS_ANNUAL: 1198800,
}

export function formatPhpFromMinor(amountMinor: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amountMinor / 100)
}

/** PayMongo hosted-checkout enums. `card` is Visa + Mastercard. */
export const PAYMONGO_PAYMENT_METHOD_TYPES = ['card', 'gcash', 'paymaya'] as const

export function paymongoPaymentMethodTypes(): string[] {
  return [...PAYMONGO_PAYMENT_METHOD_TYPES]
}
