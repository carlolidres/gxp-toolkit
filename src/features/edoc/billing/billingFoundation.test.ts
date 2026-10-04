import { describe, expect, it } from 'vitest'

import { createHmac } from 'node:crypto'

import { billableSeatCount, countsAsBillableSeat } from './billableSeats'
import {
  billingLimitUserMessage,
  canConsumeQuantity,
  parseBillingLimitError,
  resolveEffectivePlanCode,
  shouldEnforceDocumentLimits,
} from './entitlementService'
import { canDowngradeSeats, classifyPlanChange } from './planChange'
import { subscriptionDriftFields } from './billingReconcile'
import { BILLING_CATALOG, formatUsdFromMinor } from './billingCatalog'
import { PAST_DUE_GRACE_DAYS } from './billingTypes'
import { buildCheckoutCustomData } from './checkoutCustomData'
import { buildBillingReturnUrl, isAllowedBillingReturnUrl, shouldActivateFromCheckoutReturn } from './billingUrls'
import { parsePaddleWebhookEnvelope, subscriptionPatchFromPaddleData } from './paddleWebhookApply'
import { verifyPaddleWebhookSignature } from './paddleWebhookSignature'
import {
  isInFlightSignAllowed,
  isNewSendAllowedByStatus,
  mapPaddleSubscriptionStatus,
} from './paddleStatus'

describe('eDoc billing foundation', () => {
  it('locks a 14-day past-due grace', () => {
    expect(PAST_DUE_GRACE_DAYS).toBe(14)
  })

  it('maps Paddle statuses into internal states', () => {
    expect(mapPaddleSubscriptionStatus('active')).toBe('ACTIVE')
    expect(mapPaddleSubscriptionStatus('past_due')).toBe('PAST_DUE')
    expect(mapPaddleSubscriptionStatus('canceled')).toBe('CANCELED')
    expect(mapPaddleSubscriptionStatus('trialing')).toBe('TRIALING')
  })

  it('allows in-flight signing for every internal status (C2)', () => {
    const statuses = ['FREE', 'PENDING', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED', 'EXPIRED'] as const
    for (const status of statuses) {
      expect(isInFlightSignAllowed(status)).toBe(true)
    }
  })

  it('blocks new sends after cancel/expire/pause', () => {
    expect(isNewSendAllowedByStatus('ACTIVE')).toBe(true)
    expect(isNewSendAllowedByStatus('PENDING')).toBe(true)
    expect(isNewSendAllowedByStatus('PAST_DUE')).toBe(true)
    expect(isNewSendAllowedByStatus('CANCELED')).toBe(false)
    expect(isNewSendAllowedByStatus('EXPIRED')).toBe(false)
    expect(isNewSendAllowedByStatus('PAUSED')).toBe(false)
  })

  it('does not count RLS assignees as billable seats (C7)', () => {
    const members = [
      { status: 'active', countsTowardSeat: 1 },
      { status: 'active', countsTowardSeat: 0 },
      { status: 'invited', countsTowardSeat: 1 },
    ]
    expect(countsAsBillableSeat(members[1]!)).toBe(false)
    expect(billableSeatCount(members)).toBe(1)
  })
})

describe('eDoc billing checkout helpers', () => {
  it('builds HashRouter return URLs with the query before the hash (C15)', () => {
    expect(buildBillingReturnUrl('https://carlolidres.github.io', '/gxp-toolkit/', 'success')).toBe(
      'https://carlolidres.github.io/gxp-toolkit/?billing=success#/billing/success',
    )
    expect(
      isAllowedBillingReturnUrl(
        'https://carlolidres.github.io/gxp-toolkit/?billing=success#/billing/success',
        'success',
      ),
    ).toBe(true)
    expect(
      isAllowedBillingReturnUrl('https://evil.example/?billing=success#/billing/success', 'success'),
    ).toBe(false)
  })

  it('never grants access from the checkout return page (C4)', () => {
    expect(shouldActivateFromCheckoutReturn()).toBe(false)
  })

  it('attaches org, user, and plan code as string custom data', () => {
    expect(
      buildCheckoutCustomData({
        organizationId: 'org-1',
        userId: 'user-1',
        planCode: 'PERSONAL_MONTHLY',
        environment: 'staging',
      }),
    ).toEqual({
      organization_id: 'org-1',
      user_id: 'user-1',
      plan_code: 'PERSONAL_MONTHLY',
      environment: 'staging',
    })
  })

  it('keeps Personal monthly at $5.99 / 25 docs', () => {
    const personal = BILLING_CATALOG.find((plan) => plan.code === 'PERSONAL_MONTHLY')
    expect(personal?.amountMinor).toBe(599)
    expect(personal?.documentsPerMonth).toBe(25)
    expect(formatUsdFromMinor(599)).toMatch(/5\.99/)
  })
})

describe('eDoc entitlements', () => {
  it('maps canceled-after-period and past-due-after-grace to FREE', () => {
    const now = Date.parse('2026-08-18T12:00:00.000Z')
    expect(
      resolveEffectivePlanCode({
        status: 'CANCELED',
        planCode: 'PERSONAL_MONTHLY',
        currentPeriodEndMs: Date.parse('2026-09-01T00:00:00.000Z'),
        nowMs: now,
      }),
    ).toBe('PERSONAL_MONTHLY')
    expect(
      resolveEffectivePlanCode({
        status: 'CANCELED',
        planCode: 'PERSONAL_MONTHLY',
        currentPeriodEndMs: Date.parse('2026-08-01T00:00:00.000Z'),
        nowMs: now,
      }),
    ).toBe('FREE')
    expect(
      resolveEffectivePlanCode({
        status: 'PAST_DUE',
        planCode: 'PRO_MONTHLY',
        currentPeriodEndMs: Date.parse('2026-08-10T00:00:00.000Z'),
        nowMs: now,
      }),
    ).toBe('PRO_MONTHLY')
    expect(
      resolveEffectivePlanCode({
        status: 'PAST_DUE',
        planCode: 'PRO_MONTHLY',
        currentPeriodEndMs: Date.parse('2026-07-01T00:00:00.000Z'),
        nowMs: now,
      }),
    ).toBe('FREE')
  })

  it('enforces paid limits whenever billing is on, and FREE limits when checkout is on (R5)', () => {
    const off = { billingEnabled: false, freePlanLimitsEnabled: false, paddleCheckoutEnabled: false }
    const billingOnly = { billingEnabled: true, freePlanLimitsEnabled: false, paddleCheckoutEnabled: true }
    expect(shouldEnforceDocumentLimits(off, 'FREE')).toBe(false)
    expect(shouldEnforceDocumentLimits({ billingEnabled: true, freePlanLimitsEnabled: false, paddleCheckoutEnabled: false }, 'PERSONAL_MONTHLY')).toBe(true)
    expect(shouldEnforceDocumentLimits({ billingEnabled: true, freePlanLimitsEnabled: false, paddleCheckoutEnabled: false }, 'FREE')).toBe(false)
    expect(shouldEnforceDocumentLimits(billingOnly, 'FREE')).toBe(true)
  })

  it('rejects a send that would exceed the plan allowance (C11)', () => {
    expect(canConsumeQuantity(2, 3, 1)).toBe(true)
    expect(canConsumeQuantity(3, 3, 1)).toBe(false)
  })

  it('parses quota errors without treating them as a client-side grant', () => {
    expect(parseBillingLimitError('EDOC_DOCUMENT_QUOTA: Your monthly document allowance has been reached.')).toBe(
      'documents',
    )
    expect(parseBillingLimitError('EDOC_SEAT_LIMIT: This plan’s seat allowance has been reached.')).toBe('seats')
    expect(billingLimitUserMessage('documents')).toMatch(/Existing routes can still be signed/)
  })
})

describe('eDoc plan changes', () => {
  it('treats a higher family or annual interval as an immediate upgrade', () => {
    expect(classifyPlanChange('PERSONAL_MONTHLY', 'PRO_MONTHLY')).toBe('upgrade')
    expect(classifyPlanChange('PERSONAL_MONTHLY', 'PERSONAL_ANNUAL')).toBe('upgrade')
    expect(classifyPlanChange('PRO_MONTHLY', 'PERSONAL_MONTHLY')).toBe('downgrade')
    expect(classifyPlanChange('PRO_MONTHLY', 'PRO_MONTHLY')).toBe('same')
  })

  it('blocks a downgrade when billable seats would not fit (C7)', () => {
    expect(canDowngradeSeats(1, 'PERSONAL_MONTHLY')).toBe(true)
    expect(canDowngradeSeats(2, 'PERSONAL_MONTHLY')).toBe(false)
    expect(canDowngradeSeats(5, 'BUSINESS_MONTHLY')).toBe(true)
  })
})

describe('eDoc Paddle webhook', () => {
  it('accepts a valid HMAC over ts:rawBody and rejects a bad signature', () => {
    const rawBody = '{"event_id":"evt_1","event_type":"subscription.updated","data":{}}'
    const ts = String(Math.floor(Date.now() / 1000))
    const secret = 'pdl_ntfset_test'
    const h1 = createHmac('sha256', secret).update(`${ts}:${rawBody}`, 'utf8').digest('hex')
    expect(
      verifyPaddleWebhookSignature({
        rawBody,
        signatureHeader: `ts=${ts};h1=${h1}`,
        secret,
      }),
    ).toBe(true)
    expect(
      verifyPaddleWebhookSignature({
        rawBody,
        signatureHeader: `ts=${ts};h1=${'0'.repeat(64)}`,
        secret,
      }),
    ).toBe(false)
  })

  it('maps subscription.created custom_data to an org-scoped ACTIVE patch', () => {
    const envelope = parsePaddleWebhookEnvelope(
      JSON.stringify({
        event_id: 'evt_01test',
        event_type: 'subscription.created',
        data: {
          id: 'sub_01test',
          status: 'active',
          customer_id: 'ctm_01test',
          custom_data: {
            organization_id: 'edoc-org-pilot',
            user_id: 'user-1',
            plan_code: 'PERSONAL_MONTHLY',
            environment: 'staging',
          },
          items: [{ price: { id: 'pri_01m09kd9fw8tpbeyrcnsrzy4ea' } }],
          current_billing_period: {
            starts_at: '2026-08-18T00:00:00.000Z',
            ends_at: '2026-09-18T00:00:00.000Z',
          },
        },
      }),
    )
    expect(envelope?.eventId).toBe('evt_01test')
    const patch = subscriptionPatchFromPaddleData(envelope!.data)
    expect(patch?.organizationId).toBe('edoc-org-pilot')
    expect(patch?.status).toBe('ACTIVE')
    expect(patch?.paddlePriceId).toBe('pri_01m09kd9fw8tpbeyrcnsrzy4ea')
    expect(patch?.cancelAtPeriodEnd).toBe(false)
  })

  it('ignores subscription events that lack organization_id (C14)', () => {
    expect(
      subscriptionPatchFromPaddleData({
        id: 'sub_01test',
        status: 'active',
        custom_data: { plan_code: 'PERSONAL_MONTHLY' },
      }),
    ).toBeNull()
  })
})

describe('eDoc billing reconcile drift', () => {
  it('reports only fields that differ', () => {
    const local = {
      status: 'ACTIVE',
      currentPeriodEnd: '2026-09-18T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      paddlePriceId: 'pri_local',
    }
    expect(subscriptionDriftFields(local, local)).toEqual([])
    expect(
      subscriptionDriftFields(local, {
        ...local,
        status: 'PAST_DUE',
        cancelAtPeriodEnd: true,
      }),
    ).toEqual(['status', 'cancelAtPeriodEnd'])
  })
})

