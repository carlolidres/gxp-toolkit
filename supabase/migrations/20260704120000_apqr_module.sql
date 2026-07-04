-- APQR module for GxP Toolkit.
-- Prefixed apqr_* tables; mirrors database/sqlite/apqr_schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.apqr_clients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT NOT NULL UNIQUE,
  account_manager TEXT NOT NULL,
  client_name TEXT NOT NULL,
  qa TEXT,
  technical TEXT,
  regulatory TEXT,
  apqr_package TEXT NOT NULL DEFAULT 'Billable'
    CHECK (apqr_package IN ('Billable', 'Not Billable')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT REFERENCES public.profiles(id),
  updated_by TEXT REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_apqr_clients_code ON public.apqr_clients(code);
CREATE INDEX IF NOT EXISTS idx_apqr_clients_name ON public.apqr_clients(client_name);
CREATE INDEX IF NOT EXISTS idx_apqr_clients_status ON public.apqr_clients(status);

CREATE TABLE IF NOT EXISTS public.apqr_scheduler_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  apqr_id TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES public.apqr_clients(id),
  stability_pull_out_date DATE,
  product_name TEXT NOT NULL,
  product_code TEXT NOT NULL,
  review_coverage_start DATE NOT NULL,
  review_coverage_end DATE NOT NULL,
  review_coverage_adjustment_reason TEXT,
  commitment_schedule DATE NOT NULL,
  commitment_schedule_status TEXT NOT NULL DEFAULT 'Planned'
    CHECK (commitment_schedule_status IN ('Planned', 'For Client Approval', 'Client Approved')),
  schedule_status_date DATE,
  stability_pull_out_adjustment_reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ,
  archive_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT REFERENCES public.profiles(id),
  updated_by TEXT REFERENCES public.profiles(id),
  UNIQUE (client_id, product_code, review_coverage_start, review_coverage_end)
);

CREATE INDEX IF NOT EXISTS idx_apqr_scheduler_client ON public.apqr_scheduler_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_apqr_scheduler_apqr_id ON public.apqr_scheduler_entries(apqr_id);
CREATE INDEX IF NOT EXISTS idx_apqr_scheduler_active ON public.apqr_scheduler_entries(is_active);
CREATE INDEX IF NOT EXISTS idx_apqr_scheduler_commitment ON public.apqr_scheduler_entries(commitment_schedule);

CREATE TABLE IF NOT EXISTS public.apqr_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scheduler_entry_id TEXT NOT NULL UNIQUE REFERENCES public.apqr_scheduler_entries(id) ON DELETE CASCADE,
  department TEXT,
  stability_tabulation_status TEXT
    CHECK (stability_tabulation_status IS NULL OR stability_tabulation_status IN (
      'No Ongoing Stability', 'Not Sent', 'Sent'
    )),
  stability_tabulation_status_date DATE,
  no_ongoing_stability_justification TEXT,
  billing_reference_number TEXT,
  apqr_report_status TEXT
    CHECK (apqr_report_status IS NULL OR apqr_report_status IN (
      'Draft Sent', 'For Client Approval', 'Client Approved'
    )),
  sent_by TEXT,
  date_sent DATE,
  apr_reference_number TEXT UNIQUE,
  number_of_batches INTEGER CHECK (number_of_batches IS NULL OR number_of_batches >= 0),
  zero_batch_explanation TEXT,
  date_client_signed DATE,
  final_apqr_delivery_date DATE,
  delivery_classification TEXT
    CHECK (delivery_classification IS NULL OR delivery_classification IN (
      'Delivered On Time', 'Delivered Overdue', 'Currently Overdue and Undelivered'
    )),
  days_early_or_overdue INTEGER,
  delay_category TEXT,
  delay_reason TEXT,
  delay_reason_change_note TEXT,
  expected_final_delivery_date DATE,
  remarks TEXT,
  next_follow_up_due_date DATE,
  record_status TEXT NOT NULL DEFAULT 'active' CHECK (record_status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_apqr_records_scheduler ON public.apqr_records(scheduler_entry_id);
CREATE INDEX IF NOT EXISTS idx_apqr_records_apr_ref ON public.apqr_records(apr_reference_number);

CREATE TABLE IF NOT EXISTS public.apqr_follow_ups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  record_id TEXT NOT NULL REFERENCES public.apqr_records(id) ON DELETE CASCADE,
  follow_up_date DATE NOT NULL,
  follow_up_remarks TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apqr_follow_ups_record ON public.apqr_follow_ups(record_id);

CREATE TABLE IF NOT EXISTS public.apqr_audit_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  action_type TEXT NOT NULL,
  reason TEXT,
  performed_by TEXT REFERENCES public.profiles(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apqr_audit_entity ON public.apqr_audit_events(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS public.apqr_id_sequences (
  year INTEGER NOT NULL PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.apqr_clients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.apqr_scheduler_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.apqr_records TO authenticated;
GRANT SELECT, INSERT ON public.apqr_follow_ups TO authenticated;
GRANT SELECT ON public.apqr_audit_events TO authenticated;
GRANT SELECT, UPDATE ON public.apqr_id_sequences TO authenticated;

-- RLS
ALTER TABLE public.apqr_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apqr_scheduler_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apqr_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apqr_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apqr_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apqr_id_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apqr_clients_authenticated_all ON public.apqr_clients;
CREATE POLICY apqr_clients_authenticated_all ON public.apqr_clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS apqr_scheduler_authenticated_all ON public.apqr_scheduler_entries;
CREATE POLICY apqr_scheduler_authenticated_all ON public.apqr_scheduler_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS apqr_records_authenticated_all ON public.apqr_records;
CREATE POLICY apqr_records_authenticated_all ON public.apqr_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS apqr_follow_ups_authenticated_all ON public.apqr_follow_ups;
CREATE POLICY apqr_follow_ups_authenticated_all ON public.apqr_follow_ups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS apqr_audit_select ON public.apqr_audit_events;
CREATE POLICY apqr_audit_select ON public.apqr_audit_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS apqr_audit_insert ON public.apqr_audit_events;
CREATE POLICY apqr_audit_insert ON public.apqr_audit_events
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS apqr_sequences_authenticated ON public.apqr_id_sequences;
CREATE POLICY apqr_sequences_authenticated ON public.apqr_id_sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- APQR ID generator
CREATE OR REPLACE FUNCTION public.apqr_next_id(p_year INTEGER DEFAULT EXTRACT(YEAR FROM now())::INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num INTEGER;
BEGIN
  INSERT INTO public.apqr_id_sequences (year, last_number)
  VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_number = public.apqr_id_sequences.last_number + 1
  RETURNING last_number INTO v_num;

  RETURN 'APQR-' || p_year::TEXT || '-' || lpad(v_num::TEXT, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.apqr_next_id(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apqr_next_id(INTEGER) TO authenticated;
