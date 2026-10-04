/**
 * Compare local subscription rows with a Paddle snapshot.
 * Keep in sync with src/features/edoc/billing/billingReconcile.ts
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

export function isEdgeReconcileEnabled(): boolean {
  return Deno.env.get('BILLING_ENABLED') === 'true' && Deno.env.get('BILLING_RECONCILE_ENABLED') === 'true'
}

export function reconcileSecretMatches(headerValue: string): boolean {
  const expected = Deno.env.get('BILLING_RECONCILE_SECRET')?.trim() ?? ''
  const provided = headerValue.trim()
  if (!expected || !provided || expected.length !== provided.length) return false
  let out = 0
  for (let i = 0; i < expected.length; i += 1) out |= expected.charCodeAt(i) ^ provided.charCodeAt(i)
  return out === 0
}
