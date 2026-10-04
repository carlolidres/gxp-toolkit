import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { createPaddleBillingProvider } from '../_shared/edocBillingProvider.ts'
import { createPaymongoBillingProvider } from '../_shared/edocPaymongoProvider.ts'
import { existingSubscriptionBlocksCheckout } from '../_shared/edocDuplicateSubscription.ts'
import {
  isEdgeCheckoutEnabled,
  isEdgePaymongoCheckoutEnabled,
  isPaidPlanCode,
  isPaymongoPilotUser,
  type PaidPlanCode,
} from '../_shared/edocBillingCheckout.ts'

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
    const body = (await req.json().catch(() => ({}))) as {
      planCode?: string
      organizationId?: string
      successUrl?: string
      cancelUrl?: string
      provider?: string
    }
    const requestedProvider = body.provider === 'paymongo' ? 'paymongo' : 'paddle'

    if (requestedProvider === 'paymongo') {
      if (!isEdgePaymongoCheckoutEnabled()) {
        return json({ error: 'PayMongo checkout is not enabled.' }, 403)
      }
    } else if (!isEdgeCheckoutEnabled()) {
      return json({ error: 'Billing checkout is not enabled.' }, 403)
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

    if (requestedProvider === 'paymongo' && !isPaymongoPilotUser(userData.user.email ?? undefined)) {
      return json({ error: 'PayMongo checkout is limited to allowlisted accounts.' }, 403)
    }

    const planCode = String(body.planCode ?? '').trim()
    if (!isPaidPlanCode(planCode)) return json({ error: 'A paid plan is required.' }, 400)

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
      return json({ error: 'Only organization owners can start checkout.' }, 403)
    }

    const requestedOrg = String(body.organizationId ?? '').trim()
    const membership = requestedOrg
      ? adminRows.find((row) => row.organization_id === requestedOrg)
      : adminRows[0]
    if (!membership) return json({ error: 'Not authorized for that organization.' }, 403)

    const { data: existing } = await caller
      .from('edoc_subscriptions')
      .select('provider, status')
      .eq('organization_id', membership.organization_id)
      .maybeSingle()
    const blocked = existingSubscriptionBlocksCheckout({
      existing: existing ? { provider: String(existing.provider), status: String(existing.status) } : null,
      requestedProvider,
    })
    if (blocked.blocked) return json({ error: blocked.reason }, 409)

    const environment = Deno.env.get('PADDLE_ENV') === 'production' ? 'production' : 'sandbox'
    const provider =
      requestedProvider === 'paymongo' ? createPaymongoBillingProvider() : createPaddleBillingProvider()
    const fullName = String(userData.user.user_metadata?.full_name ?? userData.user.user_metadata?.name ?? '').trim()
    const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean)
    const result = await provider.createCheckout({
      organizationId: membership.organization_id,
      userId: userData.user.id,
      planCode: planCode as PaidPlanCode,
      environment,
      successUrl: String(body.successUrl ?? ''),
      cancelUrl: String(body.cancelUrl ?? ''),
      email: userData.user.email ?? undefined,
      firstName,
      lastName: rest.join(' ') || undefined,
    })

    if (requestedProvider === 'paymongo') {
      await markPendingPaymongo(membership.organization_id, planCode, result.transactionId ?? null)
    }

    return json({
      transactionId: result.transactionId,
      checkoutUrl: result.checkoutUrl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected checkout error'
    const status = message.includes('not configured') || message.includes('Invalid') ? 400 : 500
    return json({ error: message }, status)
  }
})

async function markPendingPaymongo(organizationId: string, planCode: string, providerSubscriptionId: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return
  const service = createClient(supabaseUrl, serviceKey)
  const { data: existing } = await service
    .from('edoc_subscriptions')
    .select('provider, status')
    .eq('organization_id', organizationId)
    .maybeSingle()
  const blocked = existingSubscriptionBlocksCheckout({
    existing: existing ? { provider: String(existing.provider), status: String(existing.status) } : null,
    requestedProvider: 'paymongo',
  })
  if (blocked.blocked) return
  const { data: plan } = await service.from('edoc_subscription_plans').select('id').eq('code', planCode).maybeSingle()
  if (!plan?.id) return
  const now = new Date().toISOString()
  await service.from('edoc_subscriptions').upsert(
    {
      organization_id: organizationId,
      plan_id: plan.id,
      provider: 'paymongo',
      provider_subscription_id: providerSubscriptionId,
      status: 'PENDING',
      updated_at: now,
    },
    { onConflict: 'organization_id' },
  )
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
