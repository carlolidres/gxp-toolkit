import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'

import { isBillingEnabled } from './billingFlags'
import { loadBillingOverview, type BillingOverview } from './billingOverview'
import { PAST_DUE_GRACE_DAYS } from './billingTypes'
import { iconSize, iconStroke } from '../../../theme/iconSizes'
import { formatAppDate } from '../../../utils/dateUtils'

let cached: { at: number; value: BillingOverview | null } = { at: 0, value: null }
const TTL_MS = 30_000

async function overviewOnce(): Promise<BillingOverview | null> {
  const now = Date.now()
  if (cached.value && now - cached.at < TTL_MS) return cached.value
  const value = await loadBillingOverview()
  cached = { at: now, value }
  return value
}

export function invalidateBillingOverviewCache() {
  cached = { at: 0, value: null }
}

function graceLabel(periodEnd: string | null): string | null {
  if (!periodEnd) return null
  const end = Date.parse(periodEnd)
  if (!Number.isFinite(end)) return null
  return formatAppDate(new Date(end + PAST_DUE_GRACE_DAYS * 86_400_000).toISOString())
}

export function EdocBillingAlerts() {
  const [overview, setOverview] = useState<BillingOverview | null>(cached.value)
  const enabled = isBillingEnabled()

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void overviewOnce()
      .then((value) => {
        if (!cancelled) setOverview(value)
      })
      .catch(() => {
        if (!cancelled) setOverview(null)
      })
    return () => {
      cancelled = true
    }
  }, [enabled])

  if (!enabled || !overview) return null

  if (overview.status === 'PAST_DUE') {
    const until = graceLabel(overview.periodEnd)
    return (
      <div
        className="mb-4 flex items-start gap-3 rounded-xl border border-[var(--badge-danger-bg)] bg-[var(--alert-critical-bg)] px-4 py-3 text-[var(--danger-text)]"
        role="status"
      >
        <CircleAlert size={iconSize.md} strokeWidth={iconStroke} aria-hidden />
        <p className="m-0 text-sm font-medium">
          Payment is past due.{' '}
          {until ? `Full send access continues until ${until}. ` : ''}
          <Link className="underline" to="/settings/billing">
            Update billing
          </Link>
          . Existing routes can still be signed.
        </p>
      </div>
    )
  }

  if (overview.cancelAtPeriodEnd) {
    const until = overview.periodEnd ? formatAppDate(overview.periodEnd) : null
    return (
      <div
        className="mb-4 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-[var(--navy)]"
        role="status"
      >
        <CircleAlert size={iconSize.md} strokeWidth={iconStroke} aria-hidden />
        <p className="m-0 text-sm font-medium">
          This plan cancels at period end{until ? ` (${until})` : ''}. New paid sends follow Free limits after that.
          Existing routes can still be signed.{' '}
          <Link className="underline" to="/settings/billing">
            Manage billing
          </Link>
        </p>
      </div>
    )
  }

  return null
}
