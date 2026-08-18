import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  isSubscriptionLifecycleEvent,
  parsePaddleWebhookEnvelope,
  subscriptionPatchFromPaddleData,
  verifyPaddleWebhookSignature,
} from '../_shared/edocPaddleWebhook.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, paddle-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const rawBody = await req.text()
  const signatureHeader = req.headers.get('Paddle-Signature') ?? req.headers.get('paddle-signature') ?? ''
  const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET')?.trim() ?? ''
  if (!secret) return json({ error: 'Webhook is not configured.' }, 500)

  const ok = await verifyPaddleWebhookSignature({ rawBody, signatureHeader, secret })
  if (!ok) return json({ error: 'Invalid signature.' }, 401)

  const envelope = parsePaddleWebhookEnvelope(rawBody)
  if (!envelope) return json({ error: 'Invalid payload.' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server is not configured.' }, 500)
  const service = createClient(supabaseUrl, serviceKey)

  const { data: inserted, error: insertError } = await service
    .from('edoc_billing_events')
    .insert({
      provider: 'paddle',
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
    if (isSubscriptionLifecycleEvent(envelope.eventType)) {
      const patch = subscriptionPatchFromPaddleData(envelope.data)
      if (!patch) {
        await markEvent(service, inserted.id, 'IGNORED')
        return json({ ok: true, ignored: true }, 200)
      }
      const planId = await resolvePlanId(service, patch.paddlePriceId, patch.planCode)
      if (!planId) {
        await markEvent(service, inserted.id, 'FAILED')
        return json({ error: 'Unknown plan for price.' }, 422)
      }
      if (patch.paddleCustomerId) {
        await service.from('edoc_billing_customers').upsert(
          {
            organization_id: patch.organizationId,
            provider: 'paddle',
            provider_customer_id: patch.paddleCustomerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id' },
        )
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
        await markEvent(service, inserted.id, 'FAILED')
        return json({ error: 'Subscription could not be stored.' }, 500)
      }
      const { error: _auditError } = await service.from('edoc_audit_events').insert({
        organization_id: patch.organizationId,
        event_type: 'billing.subscription_updated',
        entity_type: 'subscription',
        entity_id: patch.paddleSubscriptionId,
        new_value: { status: patch.status },
        source: 'paddle_webhook',
        actor_name: 'Paddle',
      })
      void _auditError
    }

    if (envelope.eventType === 'transaction.completed') {
      const custom = (envelope.data.custom_data ?? {}) as Record<string, unknown>
      const organizationId = typeof custom.organization_id === 'string' ? custom.organization_id.trim() : ''
      const transactionId = typeof envelope.data.id === 'string' ? envelope.data.id : ''
      if (organizationId && transactionId) {
        const details = (envelope.data.details ?? {}) as Record<string, unknown>
        const totals = (details.totals ?? {}) as Record<string, unknown>
        await service.from('edoc_billing_transactions').upsert(
          {
            organization_id: organizationId,
            provider: 'paddle',
            provider_transaction_id: transactionId,
            amount_minor: totals.grand_total ? Number(totals.grand_total) : null,
            currency: typeof totals.currency_code === 'string' ? totals.currency_code : null,
            status: typeof envelope.data.status === 'string' ? envelope.data.status : 'completed',
            occurred_at: typeof envelope.data.billed_at === 'string' ? envelope.data.billed_at : new Date().toISOString(),
          },
          { onConflict: 'provider_transaction_id' },
        )
      }
    }

    await markEvent(service, inserted.id, 'PROCESSED')
    return json({ ok: true }, 200)
  } catch (_error) {
    await markEvent(service, inserted.id, 'FAILED')
    return json({ error: 'Webhook processing failed.' }, 500)
  }
})

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
