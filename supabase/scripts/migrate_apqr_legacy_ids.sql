-- One-time APQR legacy ID migration (Supabase linked project)
-- Rewrites APQR-YYYY-NNNN -> 4-char mixed-case alphanumeric (e.g. aB12)
--
-- Run after migrations are applied:
--   npm run apqr:migrate-legacy-ids
-- or:
--   supabase db query --linked -f supabase/scripts/migrate_apqr_legacy_ids.sql
--
-- Idempotent: only rows matching ^APQR-[0-9]{4}-[0-9]+$ are changed.

SELECT 'legacy_rows_before' AS step, count(*) AS value
FROM public.apqr_scheduler_entries
WHERE apqr_id ~ '^APQR-[0-9]{4}-[0-9]+$';

SELECT migrated_scheduler_entry_id, legacy_apqr_id, short_apqr_id
FROM public.apqr_migrate_legacy_ids();

SELECT 'legacy_rows_after' AS step, count(*) AS value
FROM public.apqr_scheduler_entries
WHERE apqr_id ~ '^APQR-[0-9]{4}-[0-9]+$';

SELECT apqr_id, id, product_name, updated_at
FROM public.apqr_scheduler_entries
ORDER BY updated_at DESC, apqr_id;
