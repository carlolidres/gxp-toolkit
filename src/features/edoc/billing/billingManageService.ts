import { getSupabaseClient, isSupabaseConfigured } from '../../../lib/supabase'
import type { PaidPlanCode } from './billingCatalog'
import { isBillingPortalEnabled } from './billingFlags'

export type BillingManageAction = 'portal' | 'cancel' | 'change_plan'

function requireClient() {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.')
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase is not configured.')
  return client
}

async function invokeManage(body: {
  action: BillingManageAction
  planCode?: PaidPlanCode
  organizationId?: string
}): Promise<Record<string, unknown>> {
  if (!isBillingPortalEnabled()) {
    throw new Error('Billing management is not enabled in this environment.')
  }
  const client = requireClient()
  const { data, error } = await client.functions.invoke('edoc-billing-portal', { body })
  if (error) throw new Error(error.message)
  const payload = (data ?? {}) as { error?: string; url?: string; message?: string }
  if (payload.error) throw new Error(payload.error)
  return payload
}

export async function openBillingPortal(organizationId?: string): Promise<void> {
  const payload = await invokeManage({ action: 'portal', organizationId })
  const url = typeof payload.url === 'string' ? payload.url : ''
  if (!url) throw new Error('Paddle did not return a portal link.')
  window.location.assign(url)
}

export async function cancelAtPeriodEnd(organizationId?: string): Promise<string> {
  const payload = await invokeManage({ action: 'cancel', organizationId })
  return typeof payload.message === 'string'
    ? payload.message
    : 'Cancel is scheduled at the period end. Access stays until Paddle confirms.'
}

export async function changePaidPlan(planCode: PaidPlanCode, organizationId?: string): Promise<string> {
  const payload = await invokeManage({ action: 'change_plan', planCode, organizationId })
  return typeof payload.message === 'string'
    ? payload.message
    : 'Plan change was sent to Paddle. Access updates after the webhook.'
}
