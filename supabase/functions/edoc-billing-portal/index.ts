import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { createPaddleBillingProvider } from '../_shared/edocBillingProvider.ts'
import {
  buildCheckoutCustomData,
  isEdgePortalEnabled,
  isPaidPlanCode,
  priceIdForPlan,
  type PaidPlanCode,
} from '../_shared/edocBillingCheckout.ts'
import { classifyPlanChange, type PlanCode } from '../_shared/edocBillingPlanChange.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BILLING_ADMIN_ROLES = new Set(['owner', 'admin'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    if (!isEdgePortalEnabled()) {
      return json({ error: 'Billing management is not enabled.' }, 403)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    if (!supabaseUrl || !anonKey) return json({ error: 'Server is not configured.' }, 500)

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await caller.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Authentication required' }, 401)

    const body = (await req.json().catch(() => ({}))) as {
      action?: string
      planCode?: string
      organizationId?: string
    }
    const action = String(body.action ?? '').trim()
    if (action !== 'portal' && action !== 'cancel' && action !== 'change_plan') {
      return json({ error: 'Unknown billing action.' }, 400)
    }

    const { data: profileId, error: profileError } = await caller.rpc('edoc_current_profile_id')
    if (profileError || !profileId) return json({ error: 'eDoc profile was not found.' }, 403)

    const { data: memberships, error: memberError } = await caller
      .from('edoc_organization_members')
      .select('organization_id, membership_role, status')
      .eq('profile_id', profileId)
      .eq('status', 'active')
    if (memberError) return json({ error: 'Organization membership could not be read.' }, 500)

    const adminRows = (memberships ?? []).filter((row) => BILLING_ADMIN_ROLES.has(row.membership_role))
    if (adminRows.length === 0) {
      return json({ error: 'Only organization owners can manage billing.' }, 403)
    }

    const requestedOrg = String(body.organizationId ?? '').trim()
    const membership = requestedOrg
      ? adminRows.find((row) => row.organization_id === requestedOrg)
      : adminRows[0]
    if (!membership) return json({ error: 'Not authorized for that organization.' }, 403)

    const { data: subscription, error: subError } = await caller
      .from('edoc_subscriptions')
      .select('plan_id, status, provider_subscription_id, provider_customer_id')
      .eq('organization_id', membership.organization_id)
      .maybeSingle()
    if (subError) return json({ error: 'Subscription could not be read.' }, 500)

    const providerSubscriptionId = String(subscription?.provider_subscription_id ?? '')
    if (!providerSubscriptionId.startsWith('sub_')) {
      return json({ error: 'No Paddle subscription is on file. Subscribe from Pricing first.' }, 400)
    }

    let customerId = String(subscription?.provider_customer_id ?? '')
    const { data: customerRow } = await caller
      .from('edoc_billing_customers')
      .select('provider_customer_id')
      .eq('organization_id', membership.organization_id)
      .maybeSingle()
    if (!customerId.startsWith('ctm_')) {
      customerId = String(customerRow?.provider_customer_id ?? '')
    }

    const environment = Deno.env.get('PADDLE_ENV') === 'production' ? 'production' : 'sandbox'
    const provider = createPaddleBillingProvider()

    if (!customerId.startsWith('ctm_')) {
      const loaded = await provider.getSubscription(providerSubscriptionId)
      customerId = loaded.customerId ?? ''
    }
    if (!customerId.startsWith('ctm_')) {
      return json({ error: 'Paddle customer is not on file yet. Wait for the webhook, then retry.' }, 409)
    }

    if (action === 'portal') {
      const session = await provider.createCustomerPortalSession(customerId, providerSubscriptionId)
      return json({ url: session.url })
    }

    if (action === 'cancel') {
      await provider.cancelSubscription(providerSubscriptionId, 'period_end')
      return json({
        message: 'Cancel is scheduled at period end. Paid access stays until Paddle confirms. This page does not change entitlement.',
      })
    }

    const planCode = String(body.planCode ?? '').trim()
    if (!isPaidPlanCode(planCode)) return json({ error: 'A paid plan is required.' }, 400)

    const { data: currentPlan } = subscription?.plan_id
      ? await caller.from('edoc_subscription_plans').select('code').eq('id', subscription.plan_id).maybeSingle()
      : { data: null }
    const fromCode = (typeof currentPlan?.code === 'string' ? currentPlan.code : 'FREE') as PlanCode
    const kind = classifyPlanChange(fromCode, planCode)
    if (kind === 'same') return json({ error: 'Already on this plan.' }, 400)

    if (kind === 'downgrade') {
      const { data: targetPlan } = await caller
        .from('edoc_subscription_plans')
        .select('id')
        .eq('code', planCode)
        .maybeSingle()
      const { data: seatEntitlement } = targetPlan?.id
        ? await caller
            .from('edoc_plan_entitlements')
            .select('numeric_value')
            .eq('plan_id', targetPlan.id)
            .eq('entitlement_key', 'USERS_PER_ORG')
            .maybeSingle()
        : { data: null }
      const targetSeats = Number(seatEntitlement?.numeric_value ?? 1)
      const { count, error: seatError } = await caller
        .from('edoc_organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', membership.organization_id)
        .eq('status', 'active')
        .eq('counts_toward_seat', true)
      if (seatError) return json({ error: 'Seat usage could not be read.' }, 500)
      if ((count ?? 0) > targetSeats) {
        return json({
          error: 'EDOC_SEAT_LIMIT: Reduce billable seats before downgrading to this plan.',
        }, 409)
      }
    }

    if (kind === 'upgrade' && Deno.env.get('PADDLE_CHECKOUT_ENABLED') !== 'true') {
      return json({ error: 'Immediate upgrades are not enabled in this environment.' }, 403)
    }

    await provider.updateSubscriptionPlan({
      providerSubscriptionId,
      priceId: priceIdForPlan(planCode as PaidPlanCode),
      prorationBillingMode: kind === 'upgrade' ? 'prorated_immediately' : 'full_next_billing_period',
      customData: buildCheckoutCustomData({
        organizationId: membership.organization_id,
        userId: userData.user.id,
        planCode: planCode as PaidPlanCode,
        environment,
      }),
    })

    return json({
      kind,
      message:
        kind === 'upgrade'
          ? 'Upgrade was sent to Paddle. Access updates after the webhook — not when this page returns.'
          : 'Downgrade is scheduled for the next billing period. Current access stays until Paddle confirms.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected billing error'
    const status = message.includes('not configured') || message.includes('Invalid') ? 400 : 500
    return json({ error: message }, status)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
