-- APQR Report Status: allow free-text values from the searchable combobox UI.
-- Workflow statuses (Draft Sent, For Client Approval, Client Approved) remain
-- the canonical defaults; users may add custom entries such as Cancelled.

ALTER TABLE public.apqr_records
  DROP CONSTRAINT IF EXISTS apqr_records_apqr_report_status_check;
