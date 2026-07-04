-- APQR audit trail plain-English descriptions + follow-up reminder log

ALTER TABLE public.apqr_audit_events
  ADD COLUMN IF NOT EXISTS entity_label TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS performed_by_name TEXT;

UPDATE public.apqr_audit_events
SET description = coalesce(
      description,
      initcap(replace(action_type, '_', ' ')) || ' on ' || entity_type || ' ' || entity_id
    ),
    performed_by_name = coalesce(performed_by_name, 'Unknown user')
WHERE description IS NULL OR performed_by_name IS NULL;

ALTER TABLE public.apqr_audit_events
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN performed_by_name SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.apqr_reminder_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  record_id TEXT NOT NULL REFERENCES public.apqr_records(id) ON DELETE CASCADE,
  apqr_id TEXT NOT NULL,
  reminder_due_date DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_name TEXT NOT NULL,
  notification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (notification_status IN ('pending', 'sent', 'acknowledged')),
  related_follow_up_id TEXT REFERENCES public.apqr_follow_ups(id)
);

CREATE INDEX IF NOT EXISTS idx_apqr_reminder_log_record ON public.apqr_reminder_log(record_id);
CREATE INDEX IF NOT EXISTS idx_apqr_reminder_log_due ON public.apqr_reminder_log(reminder_due_date);

ALTER TABLE public.apqr_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apqr_reminder_log_authenticated_all ON public.apqr_reminder_log;
CREATE POLICY apqr_reminder_log_authenticated_all ON public.apqr_reminder_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.apqr_reminder_log TO authenticated;
