import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, CreditCard, FileText, ShieldCheck, Users, type LucideIcon } from 'lucide-react'

import { EdocBillingLegalLinks } from '../../components/edoc/EdocBillingLegalLinks'
import { EdocPage } from '../../components/edoc/EdocComponents'
import {
  BILLING_CATALOG,
  formatUsdFromMinor,
  type CatalogPlan,
  type PaidPlanCode,
} from '../../features/edoc/billing/billingCatalog'
import { startPaidCheckout } from '../../features/edoc/billing/billingCheckoutService'
import {
  canOpenPaddleCheckout,
  canOpenPaymongoCheckout,
  isAnnualBillingEnabled,
  isBillingEnabled,
  isBillingPortalEnabled,
  isBusinessPlanEnabled,
  isPaddleCheckoutEnabled,
  isPaymongoCheckoutEnabled,
  isPaymongoEnabled,
} from '../../features/edoc/billing/billingFlags'
import { formatPhpFromMinor, PAYMONGO_PHP_AMOUNT_MINOR } from '../../features/edoc/billing/paymongoCatalog'
import type { BillingProviderName, PlanCode } from '../../features/edoc/billing/billingTypes'
import { changePaidPlan } from '../../features/edoc/billing/billingManageService'
import { loadBillingOverview } from '../../features/edoc/billing/billingOverview'
import { classifyPlanChange } from '../../features/edoc/billing/planChange'
import { iconSize, iconStroke } from '../../theme/iconSizes'

export function EdocPricingPage() {
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [currentPlan, setCurrentPlan] = useState<PlanCode>('FREE')
  const [hasPaddleSubscription, setHasPaddleSubscription] = useState(false)
  const [hasPaymongoSubscription, setHasPaymongoSubscription] = useState(false)
  const [method, setMethod] = useState<BillingProviderName>('paddle')

  const includeAnnual = isAnnualBillingEnabled()
  const includeBusiness = isBusinessPlanEnabled()
  const portalEnabled = isBillingPortalEnabled()
  const showPaymongo = isPaymongoEnabled()

  useEffect(() => {
    let cancelled = false
    void loadBillingOverview()
      .then((overview) => {
        if (cancelled) return
        setCurrentPlan(overview.planCode)
        setHasPaddleSubscription(overview.hasPaddleSubscription)
        setHasPaymongoSubscription(overview.hasPaymongoSubscription)
      })
      .catch(() => {
        /* pricing still works without a snapshot */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(
    () =>
      BILLING_CATALOG.filter((plan) => {
        if (plan.code === 'FREE') return true
        if (plan.family === 'Business' && !includeBusiness) return false
        if (plan.interval === 'year') return includeAnnual && interval === 'year'
        return interval === 'month'
      }),
    [includeAnnual, includeBusiness, interval],
  )

  async function onSubscribe(planCode: PaidPlanCode) {
    setError(null)
    setNotice(null)
    setBusyCode(planCode)
    try {
      if (hasPaddleSubscription) {
        if (method === 'paymongo') {
          throw new Error('This organization already has a Paddle subscription. Cancel it before paying with PayMongo.')
        }
        if (!portalEnabled) {
          throw new Error('Plan changes use Billing settings when the portal flag is on.')
        }
        setNotice(await changePaidPlan(planCode))
        return
      }
      if (hasPaymongoSubscription) {
        if (method === 'paddle') {
          throw new Error('This organization already has a PayMongo subscription. Cancel it before paying with Paddle.')
        }
        throw new Error('PayMongo plan changes are not enabled yet. Cancel from Billing settings, then subscribe again.')
      }
      await startPaidCheckout(planCode, undefined, method)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Checkout could not start.')
    } finally {
      setBusyCode(null)
    }
  }

  if (!isBillingEnabled()) {
    return (
      <EdocPage
        title="Pricing"
        description="Subscription billing is not enabled in this environment."
        icon={CreditCard}
      >
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
          <p className="m-0 text-[var(--muted)]">
            eDoc Free remains available. Paid plans stay off until the owner turns billing on.
          </p>
          <EdocBillingLegalLinks />
        </div>
      </EdocPage>
    )
  }

  return (
    <EdocPage
      title="Pricing"
      description={
        method === 'paymongo'
          ? 'Choose a plan. Access changes only after PayMongo confirms payment — not when this page returns.'
          : 'Choose a plan. Access changes only after Paddle confirms payment — not when this page returns.'
      }
      icon={CreditCard}
      action={
        includeAnnual ? (
          <div
            className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-1"
            role="group"
            aria-label="Billing interval"
          >
            <IntervalButton selected={interval === 'month'} onClick={() => setInterval('month')}>
              Monthly
            </IntervalButton>
            <IntervalButton selected={interval === 'year'} onClick={() => setInterval('year')}>
              Annual
            </IntervalButton>
          </div>
        ) : null
      }
    >
      {showPaymongo ? (
        <div
          className="mb-4 inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-1"
          role="group"
          aria-label="Payment method"
        >
          <IntervalButton selected={method === 'paddle'} onClick={() => setMethod('paddle')}>
            International — Paddle
          </IntervalButton>
          <IntervalButton selected={method === 'paymongo'} onClick={() => setMethod('paymongo')}>
            Philippines — PayMongo
          </IntervalButton>
        </div>
      ) : null}
      {showPaymongo && method === 'paymongo' ? (
        <p className="mb-4 mt-0 text-sm text-[var(--muted)]">
          GCash, Visa, Mastercard, and PayMaya.
        </p>
      ) : null}

      {notice ? (
        <div
          className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--navy)]"
          role="status"
        >
          {notice}
        </div>
      ) : null}
      {error ? (
        <div
          className="mb-4 flex items-start gap-3 rounded-xl border border-[var(--badge-danger-bg)] bg-[var(--alert-critical-bg)] px-4 py-3 text-[var(--danger-text)]"
          role="alert"
          aria-live="polite"
        >
          <CircleAlert size={iconSize.md} strokeWidth={iconStroke} aria-hidden />
          <p className="m-0 text-sm font-medium">{error}</p>
        </div>
      ) : null}

      <p className="mb-4 mt-0 text-sm text-[var(--muted)]">
        <Link className="font-semibold text-[var(--teal)]" to="/settings/billing">
          Open billing settings
        </Link>
        {' '}for usage, billing management, and cancel-at-period-end.
      </p>

      <div className="mt-1 grid grid-cols-1 gap-4 pt-2 md:grid-cols-2 xl:grid-cols-4">
        {visible.map((plan) => (
          <PricingCard
            key={plan.code}
            plan={plan}
            featured={plan.family === 'Professional'}
            busy={busyCode === plan.code}
            currentPlan={currentPlan}
            hasPaddleSubscription={hasPaddleSubscription}
            hasPaymongoSubscription={hasPaymongoSubscription}
            method={method}
            portalEnabled={portalEnabled}
            checkoutReady={
              plan.code !== 'FREE' &&
              (method === 'paymongo' ? canOpenPaymongoCheckout() : canOpenPaddleCheckout())
            }
            checkoutEnabled={method === 'paymongo' ? isPaymongoCheckoutEnabled() : isPaddleCheckoutEnabled()}
            onSubscribe={onSubscribe}
          />
        ))}
      </div>
      <EdocBillingLegalLinks />
    </EdocPage>
  )
}

function IntervalButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)] ${
        selected
          ? 'bg-[var(--teal)] text-white shadow-sm'
          : 'bg-transparent text-[var(--navy)] hover:bg-[var(--surface)]'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function PricingCard({
  plan,
  featured,
  busy,
  currentPlan,
  hasPaddleSubscription,
  hasPaymongoSubscription,
  method,
  portalEnabled,
  checkoutReady,
  checkoutEnabled,
  onSubscribe,
}: {
  plan: CatalogPlan
  featured: boolean
  busy: boolean
  currentPlan: PlanCode
  hasPaddleSubscription: boolean
  hasPaymongoSubscription: boolean
  method: BillingProviderName
  portalEnabled: boolean
  checkoutReady: boolean
  checkoutEnabled: boolean
  onSubscribe: (planCode: PaidPlanCode) => void
}) {
  const paid = plan.code !== 'FREE'
  const period = plan.interval === 'month' ? 'month' : plan.interval === 'year' ? 'year' : null
  const isCurrent = plan.code === currentPlan
  const changeKind = paid ? classifyPlanChange(currentPlan, plan.code) : 'same'
  const actionReady = isCurrent
    ? false
    : hasPaddleSubscription
      ? portalEnabled && method === 'paddle'
      : hasPaymongoSubscription
        ? false
        : checkoutReady
  const actionLabel = busy
    ? 'Starting…'
    : isCurrent
      ? 'Current plan'
      : hasPaddleSubscription
        ? changeKind === 'upgrade'
          ? 'Upgrade now'
          : 'Switch at period end'
        : hasPaymongoSubscription
          ? 'Manage in billing'
          : checkoutEnabled
            ? method === 'paymongo'
              ? 'Pay locally'
              : 'Subscribe'
            : 'Checkout off'
  const priceLabel =
    paid && method === 'paymongo'
      ? formatPhpFromMinor(PAYMONGO_PHP_AMOUNT_MINOR[plan.code as PaidPlanCode])
      : formatUsdFromMinor(plan.amountMinor)

  return (
    <article
      className={`relative flex h-full flex-col rounded-2xl border bg-[var(--surface)] p-6 shadow-[var(--shadow)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        featured
          ? 'border-[var(--teal)] ring-2 ring-[var(--glow-ring)]'
          : 'border-[var(--border)] hover:border-[var(--teal)]'
      }`}
    >
      {featured ? (
        <p className="absolute -top-3 left-6 m-0 rounded-full bg-[var(--teal)] px-3 py-0.5 text-xs font-semibold tracking-wide text-white">
          Recommended
        </p>
      ) : null}

      <div className="mb-5">
        <h2 className="m-0 text-base font-semibold tracking-tight text-[var(--navy)]">{plan.family}</h2>
        <p className="mt-3 mb-0 flex items-baseline gap-1.5 text-[var(--navy)]">
          <span className="text-3xl font-bold leading-none tracking-tight">{priceLabel}</span>
          {period ? <span className="text-sm font-medium text-[var(--muted)]">/ {period}</span> : null}
        </p>
        <p className="mt-3 mb-0 text-sm leading-relaxed text-[var(--muted)]">{plan.description}</p>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        <Feature icon={FileText}>{`${plan.documentsPerMonth} documents per month`}</Feature>
        <Feature icon={Users}>{`${plan.seats} seat${plan.seats === 1 ? '' : 's'}`}</Feature>
        <Feature icon={ShieldCheck}>Audit trail and certificate of completion</Feature>
      </ul>

      <div className="mt-auto pt-6">
        {paid ? (
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--teal)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
            disabled={!actionReady || busy}
            aria-busy={busy}
            onClick={() => onSubscribe(plan.code as PaidPlanCode)}
          >
            <CreditCard size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
            {actionLabel}
          </button>
        ) : (
          <p className="m-0 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-center text-sm text-[var(--muted)]">
            Current default for existing users. No card required.
          </p>
        )}
      </div>
    </article>
  )
}

function Feature({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: string
}) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-[var(--app-text)]">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--teal-soft)] text-[var(--teal)]">
        <Icon size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
      </span>
      <span>{children}</span>
    </li>
  )
}
