-- eDoc RLS and integrity validation — run on staging after applying 20260704100000_edoc_supabase_module.sql
--
-- Usage (linked Supabase project):
--   supabase db push
--   supabase db query --linked -f supabase/scripts/verify_edoc_rls.sql

-- ---------------------------------------------------------------------------
-- 1. Schema presence
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  missing TEXT;
BEGIN
  SELECT string_agg(expected.table_name, ', ')
  INTO missing
  FROM (
    VALUES
      ('edoc_organizations'),
      ('edoc_organization_members'),
      ('edoc_documents'),
      ('edoc_document_versions'),
      ('edoc_document_files'),
      ('edoc_document_routes'),
      ('edoc_route_steps'),
      ('edoc_route_step_assignees'),
      ('edoc_audit_events'),
      ('edoc_assignment_inbox')
  ) AS expected(table_name)
  LEFT JOIN information_schema.tables t
    ON t.table_schema = 'public' AND t.table_name = expected.table_name
  WHERE t.table_name IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing eDoc objects: %', missing;
  END IF;

  RAISE NOTICE 'PASS: core eDoc tables and inbox view exist';
END $$;

-- ---------------------------------------------------------------------------
-- 2. Audit append-only triggers registered
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT count(*) INTO trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'edoc_audit_events'
    AND t.tgname IN ('prevent_edoc_audit_update', 'prevent_edoc_audit_delete')
    AND NOT t.tgisinternal;

  IF trigger_count < 2 THEN
    RAISE EXCEPTION 'FAIL: expected 2 append-only triggers on edoc_audit_events, found %', trigger_count;
  END IF;

  RAISE NOTICE 'PASS: append-only triggers present on edoc_audit_events';
END $$;

-- ---------------------------------------------------------------------------
-- 3. Helper functions callable
-- ---------------------------------------------------------------------------
SELECT
  public.edoc_current_profile_id() IS NULL AS profile_null_without_auth,
  public.edoc_is_admin() AS admin_false_without_auth;

DO $$ BEGIN RAISE NOTICE 'PASS: edoc helper functions execute'; END $$;

-- ---------------------------------------------------------------------------
-- 4. Storage buckets private
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  public_bucket TEXT;
BEGIN
  SELECT id INTO public_bucket
  FROM storage.buckets
  WHERE id LIKE 'edoc-%' AND public = true
  LIMIT 1;

  IF public_bucket IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: bucket % is public', public_bucket;
  END IF;

  RAISE NOTICE 'PASS: edoc-* storage buckets are private';
END $$;

-- ---------------------------------------------------------------------------
-- 5. RLS enabled on eDoc tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  unprotected TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ')
  INTO unprotected
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname LIKE 'edoc\_%' ESCAPE '\'
    AND c.relkind = 'r'
    AND NOT c.relrowsecurity;

  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on: %', unprotected;
  END IF;

  RAISE NOTICE 'PASS: RLS enabled on all edoc_* tables';
END $$;

-- ---------------------------------------------------------------------------
-- 6. RPC grants for authenticated role
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  missing_rpc TEXT;
BEGIN
  SELECT string_agg(expected.routine_name, ', ')
  INTO missing_rpc
  FROM (
    VALUES
      ('edoc_create_and_start_route'),
      ('edoc_advance_route'),
      ('edoc_start_route'),
      ('edoc_return_document'),
      ('edoc_complete_acknowledgment'),
      ('edoc_create_revision'),
      ('edoc_create_audit_event')
  ) AS expected(routine_name)
  LEFT JOIN information_schema.routine_privileges rp
    ON rp.routine_schema = 'public'
   AND rp.routine_name = expected.routine_name
   AND rp.grantee = 'authenticated'
  WHERE rp.routine_name IS NULL;

  IF missing_rpc IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: authenticated EXECUTE missing for: %', missing_rpc;
  END IF;

  RAISE NOTICE 'PASS: eDoc RPCs granted to authenticated';
END $$;

-- ---------------------------------------------------------------------------
-- Manual checks (document in staging checklist — require two test users)
-- ---------------------------------------------------------------------------
-- A. User outside org cannot SELECT another org document (expect 0 rows or permission denied).
-- B. Assignee B cannot edoc_advance_route on assignee A assignment (expect exception).
-- C. Non-owner cannot UPDATE completed document version hash (expect RLS denial).
-- D. Storage signed URL for foreign document fails authorization in edoc-file-access Edge Function.

DO $$ BEGIN RAISE NOTICE 'Static eDoc RLS verification complete. Run manual cross-user checks next.'; END $$;
