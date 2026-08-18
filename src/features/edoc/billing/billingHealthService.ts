import { getSupabaseClient, isSupabaseConfigured } from '../../../lib/supabase'

export type BillingReconcileRun = {
  started_at: string
  finished_at: string | null
  status: 'SKIPPED' | 'OK' | 'ERROR'
  checked_count: number
  mismatch_count: number
  repaired_count: number
  failed_event_count: number
  past_due_count: number
}

export type BillingHealthSnapshot = {
  reconcileEnabled: boolean
  lastRun: BillingReconcileRun | null
}

export async function loadBillingHealthSnapshot(): Promise<BillingHealthSnapshot | null> {
  if (!isSupabaseConfigured()) return null
  const client = getSupabaseClient()
  if (!client) return null
  const { data, error } = await client.functions.invoke('edoc-billing-reconcile', {
    body: { action: 'snapshot' },
  })
  if (error) throw new Error(error.message)
  const payload = (data ?? {}) as {
    error?: string
    reconcileEnabled?: boolean
    lastRun?: BillingReconcileRun | null
  }
  if (payload.error) throw new Error(payload.error)
  return {
    reconcileEnabled: Boolean(payload.reconcileEnabled),
    lastRun: payload.lastRun ?? null,
  }
}
