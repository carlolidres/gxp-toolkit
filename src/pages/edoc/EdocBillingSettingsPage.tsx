import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Modal } from 'antd'
import { CircleAlert, CreditCard, FileText, Users } from 'lucide-react'

import { EdocBillingLegalLinks } from '../../components/edoc/EdocBillingLegalLinks'
import { EdocError, EdocPage } from '../../components/edoc/EdocComponents'
import { isBillingEnabled, isBillingPortalEnabled } from '../../features/edoc/billing/billingFlags'
import {
  cancelAtPeriodEnd,
  openBillingPortal,
} from '../../features/edoc/billing/billingManageService'
import { invalidateBillingOverviewCache } from '../../features/edoc/billing/EdocBillingAlerts'
import { loadBillingOverview, type BillingOverview } from '../../features/edoc/billing/billingOverview'
import { iconSize, iconStroke } from '../../theme/iconSizes'
import { formatAppDate } from '../../utils/dateUtils'

function Meter({ label, used, limit, icon: Icon }: { label: string; used: number; limit: number; icon: typeof FileText }) {
  const safeLimit = Math.max(limit, 0)
  const percent = safeLimit === 0 ? 100 : Math.min(100, Math.round((used / safeLimit) * 100))
  return (
    <div>
      <p className="mb-1.5 mt-0 flex items-center gap-2 text-sm font-medium text-[var(--navy)]">
        <Icon size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
        {label}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <div className="h-full rounded-full bg-[var(--teal)]" style={{ width: `${percent}%` }} />
      </div>
      <p className="mb-0 mt-1 text-xs text-[var(--muted)]">
        {used} of {limit} used
      </p>
    </div>
  )
}

export function EdocBillingSettingsPage() {
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'portal' | 'cancel' | null>(null)

  async function refresh() {
    const next = await loadBillingOverview()
    invalidateBillingOverviewCache()
    setOverview(next)
  }

  useEffect(() => {
    let cancelled = false
    void loadBillingOverview()
      .then((value) => {
        if (!cancelled) setOverview(value)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Billing status could not be loaded.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!isBillingEnabled()) {
    return (
      <EdocPage title="Billing" description="Subscription billing is not enabled in this environment." icon={CreditCard}>
        <p className="m-0 text-[var(--muted)]">eDoc Free remains available until the owner turns billing on.</p>
      </EdocPage>
    )
  }

  async function onPortal() {
    setError(null)
    setBusy('portal')
    try {
      await openBillingPortal(overview?.organizationId ?? undefined)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open the Paddle portal.')
      setBusy(null)
    }
  }

  function onCancel() {
    Modal.confirm({
      title: 'Cancel at period end?',
      content:
        'Paid access stays until the current period ends. Existing documents and in-flight signatures are not deleted. This page does not change entitlement — the payment provider confirms by webhook.',
      okText: 'Schedule cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        setError(null)
        setBusy('cancel')
        try {
          const message = await cancelAtPeriodEnd(overview?.organizationId ?? undefined)
          await refresh()
          Modal.info({ title: 'Cancel requested', content: message })
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Could not schedule cancel.')
        } finally {
          setBusy(null)
        }
      },
    })
  }

  return (
    <EdocPage
      title="Billing"
      description="Plan and usage for this eDoc organization. Access changes only after the payment provider confirms — not from this page."
      icon={CreditCard}
      action={
        <Link to="/pricing" className="button secondary">
          View plans
        </Link>
      }
    >
      {error ? <EdocError message={error} /> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
          <h2 className="m-0 text-base font-semibold text-[var(--navy)]">Current plan</h2>
          <p className="mt-3 mb-1 text-3xl font-bold tracking-tight text-[var(--navy)]">{overview?.planName ?? '—'}</p>
          <p className="mt-0 mb-4 text-sm text-[var(--muted)]">
            Status: {overview?.status ?? '…'}
            {overview?.cancelAtPeriodEnd ? ' · cancels at period end' : ''}
          </p>
          <p className="m-0 text-sm text-[var(--muted)]">
            {overview?.periodEnd ? `Current period ends ${formatAppDate(overview.periodEnd)}.` : 'No paid renewal date.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="primary"
              icon={<CreditCard size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
              loading={busy === 'portal'}
              disabled={!isBillingPortalEnabled() || !overview?.hasPaddleSubscription || busy !== null}
              onClick={() => void onPortal()}
            >
              Manage billing
            </Button>
            <Button
              danger
              loading={busy === 'cancel'}
              disabled={
                !isBillingPortalEnabled() ||
                !(overview?.hasPaddleSubscription || overview?.hasPaymongoSubscription) ||
                Boolean(overview.cancelAtPeriodEnd) ||
                busy !== null
              }
              onClick={onCancel}
            >
              Cancel at period end
            </Button>
          </div>
          {!isBillingPortalEnabled() ? (
            <p className="mb-0 mt-3 flex items-start gap-2 text-xs text-[var(--muted)]">
              <CircleAlert size={14} strokeWidth={iconStroke} aria-hidden />
              Portal actions stay off until VITE_BILLING_PORTAL_ENABLED and the matching Edge flag are on.
            </p>
          ) : null}
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
          <h2 className="m-0 mb-5 text-base font-semibold text-[var(--navy)]">Usage this period</h2>
          <div className="flex flex-col gap-5">
            <Meter
              label="Documents sent"
              used={overview?.documentsUsed ?? 0}
              limit={overview?.documentsLimit ?? 0}
              icon={FileText}
            />
            <Meter
              label="Billable seats"
              used={overview?.seatsUsed ?? 0}
              limit={overview?.seatsLimit ?? 0}
              icon={Users}
            />
          </div>
          <p className="mb-0 mt-5 text-xs text-[var(--muted)]">
            External signers do not consume seats. Signing on existing routes is never blocked by billing.
          </p>
        </article>
      </div>
      <EdocBillingLegalLinks />
    </EdocPage>
  )
}
