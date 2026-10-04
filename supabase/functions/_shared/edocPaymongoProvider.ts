/**
 * PayMongo adapter. Secrets: PAYMONGO_SECRET_KEY_* / PAYMONGO_WEBHOOK_SECRET_* only — never VITE_*.
 * GoTyme is PayMongo settlement/treasury. Do not use payout status for eDoc access.
 */

import {
  isAllowedBillingReturnUrl,
  PAYMONGO_PAYMENT_METHOD_TYPES,
  paymongoEnvMode,
  paymongoPlanIdForPlan,
  phpAmountForPlan,
  type PaidPlanCode,
} from './edocBillingCheckout.ts'
import { BillingNotConfiguredError, type BillingProvider, type CheckoutInput } from './edocBillingProvider.ts'

const PAYMONGO_API = 'https://api.paymongo.com'

function requireSecretKey(): string {
  const mode = paymongoEnvMode()
  const live = Deno.env.get('PAYMONGO_SECRET_KEY_LIVE')?.trim() ?? ''
  const test = Deno.env.get('PAYMONGO_SECRET_KEY_TEST')?.trim() ?? ''
  const fallback = Deno.env.get('PAYMONGO_SECRET_KEY')?.trim() ?? ''
  const key = mode === 'live' ? live || fallback : test || fallback
  if (!key) throw new BillingNotConfiguredError('PayMongo secret key is not set.')
  if (mode === 'test' && key.startsWith('sk_live_')) {
    throw new BillingNotConfiguredError('Live PayMongo key cannot be used when PAYMONGO_ENV=test.')
  }
  if (mode === 'live' && key.startsWith('sk_test_')) {
    throw new BillingNotConfiguredError('Test PayMongo key cannot be used when PAYMONGO_ENV=live.')
  }
  return key
}

function authHeader(secret: string): string {
  return `Basic ${btoa(`${secret}:`)}`
}

async function paymongoFetch(
  path: string,
  init: RequestInit & { idempotencyKey?: string },
): Promise<Response> {
  const secret = requireSecretKey()
  const headers: Record<string, string> = {
    Authorization: authHeader(secret),
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey
  return fetch(`${PAYMONGO_API}${path}`, { ...init, headers })
}

function errorDetail(payload: unknown, fallback: string): string {
  const record = payload && typeof payload === 'object' ? (payload as { errors?: Array<{ detail?: string }> }) : null
  return record?.errors?.[0]?.detail ?? fallback
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

async function createCustomer(input: CheckoutInput): Promise<string> {
  const response = await paymongoFetch('/v1/customers', {
    method: 'POST',
    idempotencyKey: `edoc-cus-${input.organizationId}`,
    body: JSON.stringify({
      data: {
        attributes: {
          first_name: input.firstName?.trim() || 'eDoc',
          last_name: input.lastName?.trim() || 'Customer',
          email: input.email?.trim() || undefined,
          metadata: {
            organization_id: input.organizationId,
            user_id: input.userId,
            plan_code: input.planCode,
            environment: input.environment,
          },
        },
      },
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new BillingNotConfiguredError(errorDetail(payload, 'PayMongo could not create a customer.'))
  const id = String(asRecord(asRecord(payload)?.data)?.id ?? '').trim()
  if (!id) throw new BillingNotConfiguredError('PayMongo did not return a customer id.')
  return id
}

async function createSubscription(planId: string, customerId: string, input: CheckoutInput): Promise<string> {
  const response = await paymongoFetch('/v1/subscriptions', {
    method: 'POST',
    idempotencyKey: `edoc-sub-${input.organizationId}-${input.planCode}`,
    body: JSON.stringify({
      data: {
        attributes: {
          plan_id: planId,
          customer_id: customerId,
          metadata: {
            organization_id: input.organizationId,
            user_id: input.userId,
            plan_code: input.planCode,
            environment: input.environment,
          },
        },
      },
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new BillingNotConfiguredError(errorDetail(payload, 'PayMongo could not create a subscription.'))
  const id = String(asRecord(asRecord(payload)?.data)?.id ?? '').trim()
  if (!id) throw new BillingNotConfiguredError('PayMongo did not return a subscription id.')
  return id
}

async function createCheckoutSession(input: CheckoutInput, extras: {
  subscriptionId?: string
  customerId?: string
  recurring: boolean
}): Promise<{ checkoutUrl: string; checkoutId: string }> {
  const amount = phpAmountForPlan(input.planCode)
  const interval = input.planCode.endsWith('_ANNUAL') ? 'year' : 'month'
  const response = await paymongoFetch('/v2/checkout_sessions', {
    method: 'POST',
    idempotencyKey: `edoc-cs-${input.organizationId}-${input.planCode}`,
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
              description: `eDoc ${input.planCode.split('_').join(' ')}`,
          line_items: [
            {
              name: `eDoc ${input.planCode.split('_').join(' ')}`,
              amount,
              currency: 'PHP',
              quantity: 1,
            },
          ],
          payment_method_types: [...PAYMONGO_PAYMENT_METHOD_TYPES],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          reference_number: `${input.organizationId}:${input.planCode}`,
          metadata: {
            organization_id: input.organizationId,
            user_id: input.userId,
            plan_code: input.planCode,
            environment: input.environment,
            billing_interval: interval,
            subscription_id: extras.subscriptionId ?? '',
            customer_id: extras.customerId ?? '',
          },
        },
      },
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new BillingNotConfiguredError(errorDetail(payload, 'PayMongo could not create checkout.'))
  const data = asRecord(asRecord(payload)?.data)
  const attrs = asRecord(data?.attributes)
  const checkoutId = String(data?.id ?? '').trim()
  const checkoutUrl = typeof attrs?.checkout_url === 'string' ? attrs.checkout_url : ''
  if (!checkoutId || !checkoutUrl) {
    throw new BillingNotConfiguredError('PayMongo did not return a checkout URL.')
  }
  return { checkoutUrl, checkoutId }
}

export function createPaymongoBillingProvider(): BillingProvider {
  return {
    async createCheckout(input: CheckoutInput) {
      if (!isAllowedBillingReturnUrl(input.successUrl, 'success')) {
        throw new BillingNotConfiguredError('Invalid success URL.')
      }
      if (!isAllowedBillingReturnUrl(input.cancelUrl, 'cancelled')) {
        throw new BillingNotConfiguredError('Invalid cancel URL.')
      }
      const planId = paymongoPlanIdForPlan(input.planCode)
      const customerId = await createCustomer(input)
      let subscriptionId: string | undefined
      if (planId) {
        subscriptionId = await createSubscription(planId, customerId, input)
      }
      const session = await createCheckoutSession(input, {
        customerId,
        subscriptionId,
        recurring: Boolean(planId),
      })
      return { checkoutUrl: session.checkoutUrl, transactionId: subscriptionId ?? session.checkoutId }
    },
    async getSubscription(providerSubscriptionId: string) {
      const response = await paymongoFetch(`/v1/subscriptions/${providerSubscriptionId}`, { method: 'GET' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new BillingNotConfiguredError(errorDetail(payload, 'PayMongo could not load the subscription.'))
      const data = asRecord(asRecord(payload)?.data) ?? {}
      const attrs = asRecord(data.attributes) ?? {}
      const customerId = typeof attrs.customer_id === 'string' ? attrs.customer_id : null
      return { customerId, data: { ...data, ...attrs } }
    },
    async cancelSubscription(providerSubscriptionId: string, _timing: 'period_end' | 'immediately') {
      void _timing
      const response = await paymongoFetch(`/v1/subscriptions/${providerSubscriptionId}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new BillingNotConfiguredError(errorDetail(payload, 'PayMongo could not cancel the subscription.'))
    },
    async createCustomerPortalSession() {
      throw new BillingNotConfiguredError('PayMongo does not provide a hosted billing portal. Use cancel from Billing settings.')
    },
    async updateSubscriptionPlan() {
      throw new BillingNotConfiguredError('PayMongo plan changes are not enabled in this release. Cancel and resubscribe.')
    },
    verifyWebhook(_headers: Headers, rawBody: string) {
      void rawBody
      return false
    },
    parseWebhook(rawBody: string) {
      const parsed = JSON.parse(rawBody) as { data?: { id?: string; attributes?: { type?: string; data?: unknown } } }
      return {
        id: String(parsed.data?.id ?? ''),
        type: String(parsed.data?.attributes?.type ?? ''),
        data: parsed.data?.attributes?.data,
      }
    },
  }
}

export function paymongoWebhookSecret(): string {
  const mode = paymongoEnvMode()
  const live = Deno.env.get('PAYMONGO_WEBHOOK_SECRET_LIVE')?.trim() ?? ''
  const test = Deno.env.get('PAYMONGO_WEBHOOK_SECRET_TEST')?.trim() ?? ''
  const fallback = Deno.env.get('PAYMONGO_WEBHOOK_SECRET')?.trim() ?? ''
  const secret = mode === 'live' ? live || fallback : test || fallback
  if (!secret) throw new BillingNotConfiguredError('PayMongo webhook secret is not set.')
  return secret
}
