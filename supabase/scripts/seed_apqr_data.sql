-- APQR Postgres seed — cleared (no fixture rows)
-- Regenerate from reference CSVs: npm run apqr:seed

DELETE FROM public.apqr_follow_ups;
DELETE FROM public.apqr_audit_events;
DELETE FROM public.apqr_records;
DELETE FROM public.apqr_scheduler_entries;
DELETE FROM public.apqr_clients;
DELETE FROM public.apqr_id_sequences;
