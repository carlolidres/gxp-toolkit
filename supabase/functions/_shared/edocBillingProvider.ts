/**
 * Edge Paddle adapter. Secrets: PADDLE_API_KEY / PADDLE_WEBHOOK_SECRET only — never VITE_*.
 * Keep checkout/status types in sync with src/features/edoc/billing/.
 */

import {
  buildCheckoutCustomData,
  isAllowedBillingReturnUrl,
  paddleApiBase,
  priceIdForPlan,
  type PaidPlanCode,
} from './edocBillingCheckout.ts'

export class BillingNotConfiguredError extends Error {
  constructor(message = 'Paddle billing is not configured.') {
    super(message)
    this.name = 'BillingNotConfiguredError'
  }
}

export type CheckoutInput = {
  organizationId: string
  userId: string
  planCode: PaidPlanCode
  environment: 'sandbox' | 'production'
  successUrl: string
  cancelUrl: string
  email?: string
  firstName?: string
  lastName?: string
}

export type BillingProvider = {
  createCheckout(input: CheckoutInput): Promise<{ checkoutUrl: string; transactionId?: string }>
  getSubscription(providerSubscriptionId: string): Promise<{
    customerId: string | null
    data: Record<string, unknown>
  }>
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

function requireApiKey(): string {
  const key = Deno.env.get('PADDLE_API_KEY')?.trim() ?? ''
  if (!key) throw new BillingNotConfiguredError('PADDLE_API_KEY is not set.')
  return key
}

async function paddleFetch(path: string, init: RequestInit): Promise<Response> {
  const apiKey = requireApiKey()
  return fetch(`${paddleApiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Paddle-Version': '1',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

export function createPaddleBillingProvider(): BillingProvider {
  return {
    async createCheckout(input: CheckoutInput) {
      if (!isAllowedBillingReturnUrl(input.successUrl, 'success')) {
        throw new BillingNotConfiguredError('Invalid success URL.')
      }
      if (!isAllowedBillingReturnUrl(input.cancelUrl, 'cancelled')) {
        throw new BillingNotConfiguredError('Invalid cancel URL.')
      }
      const priceId = priceIdForPlan(input.planCode)
      const customData = buildCheckoutCustomData({
        organizationId: input.organizationId,
        userId: input.userId,
        planCode: input.planCode,
        environment: input.environment,
      })
      const response = await paddleFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ price_id: priceId, quantity: 1 }],
          collection_mode: 'automatic',
          custom_data: customData,
        }),
      })
      const payload = await response.json().catch(() => ({})) as {
        data?: { id?: string; checkout?: { url?: string } }
        error?: { detail?: string }
      }
      if (!response.ok) {
        throw new BillingNotConfiguredError(payload.error?.detail ?? 'Paddle could not create a checkout.')
      }
      const transactionId = payload.data?.id
      const checkoutUrl = payload.data?.checkout?.url
      if (!transactionId) throw new BillingNotConfiguredError('Paddle did not return a transaction id.')
      return { checkoutUrl: checkoutUrl ?? input.successUrl, transactionId }
    },
    async getSubscription(providerSubscriptionId: string) {
      const response = await paddleFetch(`/subscriptions/${providerSubscriptionId}`, { method: 'GET' })
      const payload = await response.json().catch(() => ({})) as {
        data?: { customer_id?: string } & Record<string, unknown>
        error?: { detail?: string }
      }
      if (!response.ok) {
        throw new BillingNotConfiguredError(payload.error?.detail ?? 'Paddle could not load the subscription.')
      }
      const data = payload.data && typeof payload.data === 'object' ? payload.data : {}
      const customerId = typeof data.customer_id === 'string' ? data.customer_id : null
      return { customerId, data }
    },
    async cancelSubscription(providerSubscriptionId: string, timing: 'period_end' | 'immediately') {
      const response = await paddleFetch(`/subscriptions/${providerSubscriptionId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          effective_from: timing === 'immediately' ? 'immediately' : 'next_billing_period',
        }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: { detail?: string } }
      if (!response.ok) {
        throw new BillingNotConfiguredError(payload.error?.detail ?? 'Paddle could not cancel the subscription.')
      }
    },
    async createCustomerPortalSession(providerCustomerId: string, providerSubscriptionId?: string) {
      const response = await paddleFetch(`/customers/${providerCustomerId}/portal-sessions`, {
        method: 'POST',
        body: JSON.stringify(providerSubscriptionId ? { subscription_ids: [providerSubscriptionId] } : {}),
      })
      const payload = await response.json().catch(() => ({})) as {
        data?: { urls?: { general?: { overview?: string } } }
        error?: { detail?: string }
      }
      if (!response.ok) {
        throw new BillingNotConfiguredError(payload.error?.detail ?? 'Paddle could not open the customer portal.')
      }
      const url = payload.data?.urls?.general?.overview
      if (!url) throw new BillingNotConfiguredError('Paddle did not return a portal URL.')
      return { url }
    },
    async updateSubscriptionPlan(input) {
      const response = await paddleFetch(`/subscriptions/${input.providerSubscriptionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          items: [{ price_id: input.priceId, quantity: 1 }],
          proration_billing_mode: input.prorationBillingMode,
          custom_data: input.customData,
        }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: { detail?: string } }
      if (!response.ok) {
        throw new BillingNotConfiguredError(payload.error?.detail ?? 'Paddle could not change the plan.')
      }
    },
    verifyWebhook(_headers: Headers, rawBody: string) {
      void rawBody
      return false
    },
    parseWebhook(rawBody: string) {
      const parsed = JSON.parse(rawBody) as { event_id?: string; event_type?: string; data?: unknown }
      return { id: String(parsed.event_id ?? ''), type: String(parsed.event_type ?? ''), data: parsed.data }
    },
  }
}
