import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, CircleCheck } from 'lucide-react'

import { EdocPage } from '../../components/edoc/EdocComponents'
import { shouldActivateFromCheckoutReturn } from '../../features/edoc/billing/billingUrls'
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase'
import { iconSize, iconStroke } from '../../theme/iconSizes'

export function EdocBillingSuccessPage() {
  return <EdocBillingReturnPage kind="success" />
}

export function EdocBillingCancelledPage() {
  return <EdocBillingReturnPage kind="cancelled" />
}

function EdocBillingReturnPage({ kind }: { kind: 'success' | 'cancelled' }) {
  const [statusLabel, setStatusLabel] = useState('Checking…')
  const granted = shouldActivateFromCheckoutReturn()

  useEffect(() => {
    let cancelled = false
    async function poll() {
      if (kind !== 'success' || granted) return
      if (!isSupabaseConfigured()) {
        setStatusLabel('Waiting for Paddle confirmation. This page does not activate a plan.')
        return
      }
      const client = getSupabaseClient()
      if (!client) return
      const { data: profileId } = await client.rpc('edoc_current_profile_id')
      if (!profileId || cancelled) return
      const { data: membership } = await client
        .from('edoc_organization_members')
        .select('organization_id')
        .eq('profile_id', profileId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      if (!membership?.organization_id || cancelled) {
        setStatusLabel('Waiting for Paddle confirmation. This page does not activate a plan.')
        return
      }
      const { data } = await client
        .from('edoc_subscriptions')
        .select('status')
        .eq('organization_id', membership.organization_id)
        .maybeSingle()
      if (cancelled) return
      if (data?.status === 'ACTIVE' || data?.status === 'TRIALING') {
        setStatusLabel(`Plan status: ${data.status}. Entitlement comes from the webhook, not this page.`)
        return
      }
      setStatusLabel('Activating… Paddle has not confirmed yet. Refresh in a minute, or return to eDoc.')
    }
    void poll()
    return () => {
      cancelled = true
    }
  }, [granted, kind])

  if (kind === 'cancelled') {
    return (
      <EdocPage title="Checkout cancelled" description="No payment was taken." icon={CircleAlert}>
        <div className="panel">
          <p>You can return to pricing and try again when you are ready.</p>
          <Link to="/pricing" className="button secondary">
            Back to pricing
          </Link>
        </div>
      </EdocPage>
    )
  }

  return (
    <EdocPage
      title="Payment submitted"
      description="This page does not grant paid access. eDoc waits for a verified Paddle webhook."
      icon={CircleCheck}
    >
      <div className="panel">
        <p className="flex items-center gap-2">
          <CircleCheck size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
          {statusLabel}
        </p>
        <p className="text-[var(--muted)]">
          If this stays on “activating”, the webhook is not connected yet (Phase 3). Do not treat this screen as proof of a paid plan.
        </p>
        <Link to="/edoc" className="button primary">
          Return to eDoc
        </Link>
      </div>
    </EdocPage>
  )
}
