/**
 * Compare local subscription rows with a Paddle snapshot.
 * Keep in sync with supabase/functions/_shared/edocBillingReconcile.ts
 */

export type ReconcileComparable = {
  status: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  paddlePriceId: string | null
}

function normalizeInstant(value: string | null): string {
  if (!value) return ''
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value.trim()
  return new Date(parsed).toISOString()
}

export function subscriptionDriftFields(
  local: ReconcileComparable,
  remote: ReconcileComparable,
): string[] {
  const fields: string[] = []
  if (local.status !== remote.status) fields.push('status')
  if (normalizeInstant(local.currentPeriodEnd) !== normalizeInstant(remote.currentPeriodEnd)) {
    fields.push('currentPeriodEnd')
  }
  if (Boolean(local.cancelAtPeriodEnd) !== Boolean(remote.cancelAtPeriodEnd)) {
    fields.push('cancelAtPeriodEnd')
  }
  if ((local.paddlePriceId ?? '') !== (remote.paddlePriceId ?? '')) fields.push('paddlePriceId')
  return fields
}
