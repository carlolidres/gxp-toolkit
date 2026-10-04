import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { existingSubscriptionBlocksProviderApply } from '../_shared/edocDuplicateSubscription.ts'
import {
  isEdgePaymongoEnabled,
  isPaidPlanCode,
  paymongoEnvMode,
  phpAmountForPlan,
  type PaidPlanCode,
} from '../_shared/edocBillingCheckout.ts'
import { paymongoWebhookSecret } from '../_shared/edocPaymongoProvider.ts'
import {
  isPaymongoPaymentEvent,
  isPaymongoSubscriptionEvent,
  parsePaymongoWebhookEnvelope,
  periodEndFromInterval,
  subscriptionPatchFromPaymongoData,
  verifyPaymongoWebhookSignature,
} from '../_shared/edocPaymongoWebhook.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, paymongo-signature, Paymongo-Signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (!isEdgePaymongoEnabled()) return json({ error: 'PayMongo is not enabled.' }, 403)

  const rawBody = await req.text()
  const signatureHeader = req.headers.get('Paymongo-Signature') ?? req.headers.get('paymongo-signature') ?? ''
  let secret = ''
  try {
    secret = paymongoWebhookSecret()
  } catch {
    return json({ error: 'Webhook is not configured.' }, 500)
  }

  const mode = paymongoEnvMode()
  const ok = await verifyPaymongoWebhookSignature({ rawBody, signatureHeader, secret, mode })
  if (!ok) return json({ error: 'Invalid signature.' }, 401)

  const envelope = parsePaymongoWebhookEnvelope(rawBody)
  if (!envelope) return json({ error: 'Invalid payload.' }, 400)
  if (envelope.livemode !== (mode === 'live')) {
    return json({ error: 'Test/live PayMongo event mismatch.' }, 409)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server is not configured.' }, 500)
  const service = createClient(supabaseUrl, serviceKey)

  const { data: inserted, error: insertError } = await service
    .from('edoc_billing_events')
    .insert({
      provider: 'paymongo',
      provider_event_id: envelope.eventId,
      event_type: envelope.eventType,
      processing_status: 'PROCESSING',
      payload_json: { event_type: envelope.eventType },
    })
    .select('id')
    .maybeSingle()

  if (insertError) {
    if (insertError.code === '23505') return json({ ok: true, duplicate: true }, 200)
    return json({ error: 'Event could not be recorded.' }, 500)
  }
  if (!inserted?.id) return json({ ok: true, duplicate: true }, 200)

  try {
    if (!isPaymongoSubscriptionEvent(envelope.eventType) && !isPaymongoPaymentEvent(envelope.eventType)) {
      await markEvent(service, inserted.id, 'IGNORED')
      return json({ ok: true, ignored: true }, 200)
    }

    const patch = subscriptionPatchFromPaymongoData(envelope.data, envelope.eventType)
    if (!patch) {
      await markEvent(service, inserted.id, 'IGNORED')
      return json({ ok: true, ignored: true }, 200)
    }

    const { data: existing } = await service
      .from('edoc_subscriptions')
      .select('provider, status')
      .eq('organization_id', patch.organizationId)
      .maybeSingle()

    if (
      existingSubscriptionBlocksProviderApply({
        existing: existing ? { provider: String(existing.provider), status: String(existing.status) } : null,
        incomingProvider: 'paymongo',
      })
    ) {
      await markEvent(service, inserted.id, 'IGNORED')
      return json({ ok: true, ignored: true, reason: 'other_provider_active' }, 200)
    }

    const planId = await resolvePlanId(service, patch.paymongoPlanId, patch.planCode)
    if (!planId) {
      await markEvent(service, inserted.id, 'FAILED')
      return json({ error: 'Unknown plan.' }, 422)
    }

    if (patch.paymongoCustomerId) {
      await service.from('edoc_billing_customers').upsert(
        {
          organization_id: patch.organizationId,
          provider: 'paymongo',
          provider_customer_id: patch.paymongoCustomerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' },
      )
    }

    const { data: planRow } = await service
      .from('edoc_subscription_plans')
      .select('code, billing_interval')
      .eq('id', planId)
      .maybeSingle()
    const interval = planRow?.billing_interval === 'year' ? 'year' : 'month'
    const now = new Date()
    const periodStart = patch.currentPeriodStart ?? now.toISOString()
    const periodEnd = patch.currentPeriodEnd ?? periodEndFromInterval(interval, now)

    const { error: upsertError } = await service.from('edoc_subscriptions').upsert(
      {
        organization_id: patch.organizationId,
        plan_id: planId,
        provider: 'paymongo',
        provider_customer_id: patch.paymongoCustomerId,
        provider_subscription_id: patch.paymongoSubscriptionId,
        status: patch.status,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: patch.cancelAtPeriodEnd,
        updated_at: now.toISOString(),
      },
      { onConflict: 'organization_id' },
    )
    if (upsertError) {
      await markEvent(service, inserted.id, 'FAILED')
      return json({ error: 'Subscription could not be stored.' }, 500)
    }

    const paymentId = patch.paymongoPaymentId
    if (paymentId && (envelope.eventType === 'checkout_session.payment.paid' || envelope.eventType === 'payment.paid')) {
      const amount =
        patch.amountMinor ??
        (isPaidPlanCode(String(patch.planCode ?? '')) ? phpAmountForPlan(patch.planCode as PaidPlanCode) : null)
      await service.from('edoc_billing_transactions').upsert(
        {
          organization_id: patch.organizationId,
          provider: 'paymongo',
          provider_transaction_id: paymentId,
          amount_minor: amount,
          currency: patch.currency ?? 'PHP',
          status: 'paid',
          occurred_at: now.toISOString(),
        },
        { onConflict: 'provider_transaction_id' },
      )
    }

    const { error: _auditError } = await service.from('edoc_audit_events').insert({
      organization_id: patch.organizationId,
      event_type: 'billing.subscription_updated',
      entity_type: 'subscription',
      entity_id: patch.paymongoSubscriptionId ?? paymentId,
      new_value: { status: patch.status, provider: 'paymongo' },
      source: 'paymongo_webhook',
      actor_name: 'PayMongo',
    })
    void _auditError

    await markEvent(service, inserted.id, 'PROCESSED')
    return json({ ok: true }, 200)
  } catch (_error) {
    await markEvent(service, inserted.id, 'FAILED')
    return json({ error: 'Webhook processing failed.' }, 500)
  }
})

async function resolvePlanId(
  service: ReturnType<typeof createClient>,
  paymongoPlanId: string | null,
  planCode: string | null,
): Promise<string | null> {
  if (paymongoPlanId) {
    const { data } = await service
      .from('edoc_subscription_plans')
      .select('id')
      .eq('paymongo_plan_id', paymongoPlanId)
      .maybeSingle()
    if (data?.id) return data.id
  }
  if (planCode) {
    const { data } = await service.from('edoc_subscription_plans').select('id').eq('code', planCode).maybeSingle()
    if (data?.id) return data.id
  }
  return null
}

async function markEvent(
  service: ReturnType<typeof createClient>,
  id: string,
  processing_status: 'PROCESSED' | 'FAILED' | 'IGNORED',
) {
  await service
    .from('edoc_billing_events')
    .update({ processing_status, processed_at: new Date().toISOString() })
    .eq('id', id)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
