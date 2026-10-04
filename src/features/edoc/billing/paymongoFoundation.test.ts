import { describe, expect, it } from 'vitest'

import { createHmac } from 'node:crypto'

import { existingSubscriptionBlocksCheckout, existingSubscriptionBlocksProviderApply } from './duplicateSubscription'
import { formatPhpFromMinor, PAYMONGO_PHP_AMOUNT_MINOR, paymongoPaymentMethodTypes } from './paymongoCatalog'
import { mapPaymongoSubscriptionStatus } from './paymongoStatus'
import {
  parsePaymongoWebhookEnvelope,
  subscriptionPatchFromPaymongoData,
} from './paymongoWebhookApply'
import { verifyPaymongoWebhookSignature } from './paymongoWebhookSignature'
import { resolveEffectivePlanCode } from './entitlementService'
import { shouldActivateFromCheckoutReturn } from './billingUrls'

describe('eDoc PayMongo status mapping', () => {
  it('maps PayMongo statuses into internal states', () => {
    expect(mapPaymongoSubscriptionStatus('incomplete')).toBe('PENDING')
    expect(mapPaymongoSubscriptionStatus('active')).toBe('ACTIVE')
    expect(mapPaymongoSubscriptionStatus('past_due')).toBe('PAST_DUE')
    expect(mapPaymongoSubscriptionStatus('unpaid')).toBe('PAST_DUE')
    expect(mapPaymongoSubscriptionStatus('cancelled')).toBe('CANCELED')
    expect(mapPaymongoSubscriptionStatus('incomplete_cancelled')).toBe('EXPIRED')
  })

  it('does not treat PENDING as paid entitlement', () => {
    expect(
      resolveEffectivePlanCode({
        status: 'PENDING',
        planCode: 'PERSONAL_MONTHLY',
        currentPeriodEndMs: Date.parse('2026-09-01T00:00:00.000Z'),
        nowMs: Date.parse('2026-08-19T00:00:00.000Z'),
      }),
    ).toBe('FREE')
  })
})

describe('eDoc duplicate subscription guard', () => {
  it('blocks PayMongo checkout when a Paddle subscription is already active', () => {
    expect(
      existingSubscriptionBlocksCheckout({
        existing: { provider: 'paddle', status: 'ACTIVE' },
        requestedProvider: 'paymongo',
      }).blocked,
    ).toBe(true)
  })

  it('blocks Paddle checkout when a PayMongo subscription is already active', () => {
    expect(
      existingSubscriptionBlocksCheckout({
        existing: { provider: 'paymongo', status: 'ACTIVE' },
        requestedProvider: 'paddle',
      }).blocked,
    ).toBe(true)
  })

  it('allows retrying the same provider while PENDING', () => {
    expect(
      existingSubscriptionBlocksCheckout({
        existing: { provider: 'paymongo', status: 'PENDING' },
        requestedProvider: 'paymongo',
      }).blocked,
    ).toBe(false)
  })

  it('refuses to overwrite an active Paddle row with a PayMongo webhook', () => {
    expect(
      existingSubscriptionBlocksProviderApply({
        existing: { provider: 'paddle', status: 'ACTIVE' },
        incomingProvider: 'paymongo',
      }),
    ).toBe(true)
    expect(
      existingSubscriptionBlocksProviderApply({
        existing: { provider: 'paddle', status: 'ACTIVE' },
        incomingProvider: 'paddle',
      }),
    ).toBe(false)
  })
})

describe('eDoc PayMongo webhooks', () => {
  it('accepts a valid HMAC over t.rawBody and rejects a bad signature', () => {
    const rawBody = '{"data":{"id":"evt_1","attributes":{"type":"subscription.updated","data":{}}}}'
    const ts = String(Math.floor(Date.now() / 1000))
    const secret = 'whsk_test'
    const te = createHmac('sha256', secret).update(`${ts}.${rawBody}`, 'utf8').digest('hex')
    expect(
      verifyPaymongoWebhookSignature({
        rawBody,
        signatureHeader: `t=${ts},te=${te},li=`,
        secret,
        mode: 'test',
      }),
    ).toBe(true)
    expect(
      verifyPaymongoWebhookSignature({
        rawBody,
        signatureHeader: `t=${ts},te=${'0'.repeat(64)},li=`,
        secret,
        mode: 'test',
      }),
    ).toBe(false)
  })

  it('maps a signed subscription.updated payload to an org-scoped ACTIVE patch', () => {
    const envelope = parsePaymongoWebhookEnvelope(
      JSON.stringify({
        data: {
          id: 'evt_paymongo_1',
          type: 'event',
          attributes: {
            type: 'subscription.updated',
            livemode: false,
            data: {
              id: 'subs_01test',
              type: 'subscription',
              attributes: {
                status: 'active',
                customer_id: 'cus_01test',
                plan: { id: 'plan_01test' },
                metadata: {
                  organization_id: 'edoc-org-pilot',
                  plan_code: 'PERSONAL_MONTHLY',
                },
                current_period_start: 1755734400,
                current_period_end: 1758412800,
              },
            },
          },
        },
      }),
    )
    expect(envelope?.eventId).toBe('evt_paymongo_1')
    const patch = subscriptionPatchFromPaymongoData(envelope!.data, envelope!.eventType)
    expect(patch?.organizationId).toBe('edoc-org-pilot')
    expect(patch?.status).toBe('ACTIVE')
    expect(patch?.planCode).toBe('PERSONAL_MONTHLY')
    expect(patch?.paymongoSubscriptionId).toBe('subs_01test')
  })

  it('activates from checkout_session.payment.paid using metadata, not the browser return', () => {
    expect(shouldActivateFromCheckoutReturn()).toBe(false)
    const patch = subscriptionPatchFromPaymongoData(
      {
        id: 'cs_01test',
        type: 'checkout_session',
        attributes: {
          status: 'paid',
          metadata: {
            organization_id: 'edoc-org-pilot',
            plan_code: 'PRO_MONTHLY',
            subscription_id: 'subs_01test',
          },
        },
      },
      'checkout_session.payment.paid',
    )
    expect(patch?.status).toBe('ACTIVE')
    expect(patch?.paymongoPaymentId).toBe('cs_01test')
  })

  it('ignores PayMongo events that lack organization_id', () => {
    expect(
      subscriptionPatchFromPaymongoData(
        {
          id: 'subs_01test',
          type: 'subscription',
          attributes: { status: 'active' },
        },
        'subscription.updated',
      ),
    ).toBeNull()
  })
})

describe('eDoc PayMongo catalog', () => {
  it('keeps PHP list prices at 199 / 499 / 999 for monthly Personal / Pro / Business', () => {
    expect(PAYMONGO_PHP_AMOUNT_MINOR.PERSONAL_MONTHLY).toBe(19900)
    expect(PAYMONGO_PHP_AMOUNT_MINOR.PRO_MONTHLY).toBe(49900)
    expect(PAYMONGO_PHP_AMOUNT_MINOR.BUSINESS_MONTHLY).toBe(99900)
    expect(formatPhpFromMinor(19900)).toMatch(/199/)
  })

  it('offers GCash, Visa/Mastercard (card), and PayMaya on hosted checkout', () => {
    expect(paymongoPaymentMethodTypes()).toEqual(['card', 'gcash', 'paymaya'])
  })
})
