import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { createPaddleBillingProvider } from '../_shared/edocBillingProvider.ts'
import { createPaymongoBillingProvider } from '../_shared/edocPaymongoProvider.ts'
import { subscriptionPatchFromPaddleData } from '../_shared/edocPaddleWebhook.ts'
import { subscriptionPatchFromPaymongoData } from '../_shared/edocPaymongoWebhook.ts'
import { isEdgePaymongoEnabled } from '../_shared/edocBillingCheckout.ts'
import {
  isEdgeReconcileEnabled,
  reconcileSecretMatches,
  subscriptionDriftFields,
} from '../_shared/edocBillingReconcile.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-edoc-reconcile-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BILLING_ADMIN_ROLES = new Set(['owner', 'admin'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string }
    const action = String(body.action ?? '').trim()
    if (action === 'snapshot') return await snapshot(req)
    if (action === 'run') return await run(req)
    return json({ error: 'Unknown billing action.' }, 400)
  } catch {
    return json({ error: 'Billing reconcile failed.' }, 500)
  }
})

async function snapshot(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!supabaseUrl || !anonKey) return json({ error: 'Server is not configured.' }, 500)

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Authentication required' }, 401)

  const { data: profileId, error: profileError } = await caller.rpc('edoc_current_profile_id')
  if (profileError || !profileId) return json({ error: 'eDoc profile was not found.' }, 403)

  const { data: memberships, error: memberError } = await caller
    .from('edoc_organization_members')
    .select('membership_role, status')
    .eq('profile_id', profileId)
    .eq('status', 'active')
  if (memberError) return json({ error: 'Organization membership could not be read.' }, 500)
  const isAdmin = (memberships ?? []).some((row) => BILLING_ADMIN_ROLES.has(row.membership_role))
  if (!isAdmin) return json({ error: 'Only organization owners can view billing health.' }, 403)

  const service = serviceClient()
  const { data: lastRun } = await service
    .from('edoc_billing_reconcile_runs')
    .select(
      'started_at, finished_at, status, checked_count, mismatch_count, repaired_count, failed_event_count, past_due_count',
    )
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return json({
    ok: true,
    reconcileEnabled: isEdgeReconcileEnabled(),
    lastRun: lastRun ?? null,
  })
}

async function run(req: Request) {
  const secret = req.headers.get('x-edoc-reconcile-secret') ?? ''
  if (!reconcileSecretMatches(secret)) return json({ error: 'Authentication required' }, 401)

  const service = serviceClient()
  const startedAt = new Date().toISOString()

  if (!isEdgeReconcileEnabled()) {
    await insertRun(service, {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: 'SKIPPED',
      checked_count: 0,
      mismatch_count: 0,
      repaired_count: 0,
      failed_event_count: 0,
      past_due_count: 0,
      summary_json: { reason: 'BILLING_RECONCILE_ENABLED is off' },
    })
    return json({ ok: true, skipped: true })
  }

  const [{ count: failedEventCount }, { count: pastDueCount }, { data: rows, error: listError }] =
    await Promise.all([
      service.from('edoc_billing_events').select('id', { count: 'exact', head: true }).eq('processing_status', 'FAILED'),
      service.from('edoc_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'PAST_DUE'),
      service
        .from('edoc_subscriptions')
        .select('organization_id, status, current_period_end, cancel_at_period_end, provider, provider_subscription_id, plan_id')
        .not('provider_subscription_id', 'is', null),
    ])

  if (listError) {
    await insertRun(service, {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: 'ERROR',
      checked_count: 0,
      mismatch_count: 0,
      repaired_count: 0,
      failed_event_count: failedEventCount ?? 0,
      past_due_count: pastDueCount ?? 0,
      summary_json: { error: 'subscriptions_unreadable' },
    })
    return json({ error: 'Subscriptions could not be read.' }, 500)
  }

  const provider = createPaddleBillingProvider()
  let checked = 0
  let mismatch = 0
  let repaired = 0
  const errors: string[] = []

  for (const row of rows ?? []) {
    const providerSubscriptionId = String(row.provider_subscription_id ?? '')
    if (String(row.provider ?? 'paddle') !== 'paddle') continue
    if (!providerSubscriptionId.startsWith('sub_')) continue
    checked += 1
    try {
      const loaded = await provider.getSubscription(providerSubscriptionId)
      const custom = (loaded.data.custom_data ?? {}) as Record<string, unknown>
      const data = {
        ...loaded.data,
        custom_data: {
          ...custom,
          organization_id:
            typeof custom.organization_id === 'string' && custom.organization_id.trim()
              ? custom.organization_id
              : row.organization_id,
        },
      }
      const patch = subscriptionPatchFromPaddleData(data)
      if (!patch) {
        errors.push(providerSubscriptionId)
        continue
      }

      const { data: plan } = await service
        .from('edoc_subscription_plans')
        .select('paddle_price_id')
        .eq('id', row.plan_id)
        .maybeSingle()

      const drift = subscriptionDriftFields(
        {
          status: String(row.status ?? ''),
          currentPeriodEnd: typeof row.current_period_end === 'string' ? row.current_period_end : null,
          cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
          paddlePriceId: typeof plan?.paddle_price_id === 'string' ? plan.paddle_price_id : null,
        },
        {
          status: patch.status,
          currentPeriodEnd: patch.currentPeriodEnd,
          cancelAtPeriodEnd: patch.cancelAtPeriodEnd,
          paddlePriceId: patch.paddlePriceId,
        },
      )
      if (drift.length === 0) continue
      mismatch += 1

      const planId = await resolvePlanId(service, patch.paddlePriceId, patch.planCode)
      if (!planId) {
        errors.push(providerSubscriptionId)
        continue
      }
      const now = new Date().toISOString()
      const { error: upsertError } = await service.from('edoc_subscriptions').upsert(
        {
          organization_id: patch.organizationId,
          plan_id: planId,
          provider: 'paddle',
          provider_customer_id: patch.paddleCustomerId,
          provider_subscription_id: patch.paddleSubscriptionId,
          status: patch.status,
          current_period_start: patch.currentPeriodStart,
          current_period_end: patch.currentPeriodEnd,
          cancel_at_period_end: patch.cancelAtPeriodEnd,
          updated_at: now,
        },
        { onConflict: 'organization_id' },
      )
      if (upsertError) {
        errors.push(providerSubscriptionId)
        continue
      }
      repaired += 1
      const { error: _auditError } = await service.from('edoc_audit_events').insert({
        organization_id: patch.organizationId,
        event_type: 'billing.subscription_reconciled',
        entity_type: 'subscription',
        entity_id: patch.paddleSubscriptionId,
        new_value: { status: patch.status, fields: drift },
        source: 'paddle_reconcile',
        actor_name: 'Paddle reconcile',
      })
      void _auditError
    } catch {
      errors.push(providerSubscriptionId)
    }
  }

  if (isEdgePaymongoEnabled()) {
    const paymongo = createPaymongoBillingProvider()
    for (const row of rows ?? []) {
      if (String(row.provider ?? '') !== 'paymongo') continue
      const providerSubscriptionId = String(row.provider_subscription_id ?? '')
      if (!providerSubscriptionId) continue
      checked += 1
      try {
        const loaded = await paymongo.getSubscription(providerSubscriptionId)
        const data = {
          id: providerSubscriptionId,
          type: 'subscription',
          attributes: {
            ...loaded.data,
            metadata: {
              organization_id: row.organization_id,
              plan_code: typeof loaded.data.plan_code === 'string' ? loaded.data.plan_code : undefined,
            },
          },
        }
        const patch = subscriptionPatchFromPaymongoData(data, 'subscription.updated')
        if (!patch) {
          errors.push(providerSubscriptionId)
          continue
        }
        const drift = subscriptionDriftFields(
          {
            status: String(row.status ?? ''),
            currentPeriodEnd: typeof row.current_period_end === 'string' ? row.current_period_end : null,
            cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
            paddlePriceId: null,
          },
          {
            status: patch.status,
            currentPeriodEnd: patch.currentPeriodEnd,
            cancelAtPeriodEnd: patch.cancelAtPeriodEnd,
            paddlePriceId: null,
          },
        )
        if (drift.length === 0) continue
        mismatch += 1
        const planId = await resolvePlanId(service, null, patch.planCode)
        if (!planId) {
          errors.push(providerSubscriptionId)
          continue
        }
        const now = new Date().toISOString()
        const { error: upsertError } = await service.from('edoc_subscriptions').upsert(
          {
            organization_id: patch.organizationId,
            plan_id: planId,
            provider: 'paymongo',
            provider_customer_id: patch.paymongoCustomerId,
            provider_subscription_id: patch.paymongoSubscriptionId ?? providerSubscriptionId,
            status: patch.status,
            current_period_start: patch.currentPeriodStart,
            current_period_end: patch.currentPeriodEnd,
            cancel_at_period_end: patch.cancelAtPeriodEnd,
            updated_at: now,
          },
          { onConflict: 'organization_id' },
        )
        if (upsertError) {
          errors.push(providerSubscriptionId)
          continue
        }
        repaired += 1
      } catch {
        errors.push(providerSubscriptionId)
      }
    }
  }

  await insertRun(service, {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: errors.length > 0 ? 'ERROR' : 'OK',
    checked_count: checked,
    mismatch_count: mismatch,
    repaired_count: repaired,
    failed_event_count: failedEventCount ?? 0,
    past_due_count: pastDueCount ?? 0,
    summary_json: { error_count: errors.length },
  })

  return json({
    ok: errors.length === 0,
    checked,
    mismatch,
    repaired,
    failedEventCount: failedEventCount ?? 0,
    pastDueCount: pastDueCount ?? 0,
    errorCount: errors.length,
  })
}

function serviceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) throw new Error('Server is not configured.')
  return createClient(supabaseUrl, serviceKey)
}

async function resolvePlanId(
  service: ReturnType<typeof createClient>,
  paddlePriceId: string | null,
  planCode: string | null,
): Promise<string | null> {
  if (paddlePriceId) {
    const { data } = await service
      .from('edoc_subscription_plans')
      .select('id')
      .eq('paddle_price_id', paddlePriceId)
      .maybeSingle()
    if (data?.id) return data.id
  }
  if (planCode) {
    const { data } = await service.from('edoc_subscription_plans').select('id').eq('code', planCode).maybeSingle()
    if (data?.id) return data.id
  }
  return null
}

async function insertRun(
  service: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
) {
  await service.from('edoc_billing_reconcile_runs').insert(row)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
