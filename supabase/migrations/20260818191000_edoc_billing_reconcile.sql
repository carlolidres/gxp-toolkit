-- eDoc billing Phase 6: reconcile run log (counts only; no Paddle payloads).
CREATE TABLE IF NOT EXISTS public.edoc_billing_reconcile_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('SKIPPED', 'OK', 'ERROR')),
  checked_count INTEGER NOT NULL DEFAULT 0,
  mismatch_count INTEGER NOT NULL DEFAULT 0,
  repaired_count INTEGER NOT NULL DEFAULT 0,
  failed_event_count INTEGER NOT NULL DEFAULT 0,
  past_due_count INTEGER NOT NULL DEFAULT 0,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_edoc_billing_reconcile_runs_started
  ON public.edoc_billing_reconcile_runs (started_at DESC);

ALTER TABLE public.edoc_billing_reconcile_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.edoc_billing_reconcile_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edoc_billing_reconcile_runs TO service_role;
