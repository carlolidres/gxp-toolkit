-- Phase 4 browser smoke prerequisites — disposable staging test accounts only.
-- Run: supabase db query --linked -f supabase/scripts/verify_edoc_phase4_browser.sql
-- Requires: seed_edoc_staging_test_accounts.sql applied.

CREATE OR REPLACE FUNCTION pg_temp.edoc_rls_test_set_auth(p_auth_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', p_auth_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.edoc_rls_test_reset()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
END;
$$;

DO $$
DECLARE
  reviewer_auth uuid;
  creator_auth uuid;
  inbox_count integer;
  can_create boolean;
BEGIN
  SELECT auth_user_id INTO reviewer_auth
  FROM public.profiles WHERE lower(email) = 'edoc-reviewer@example.test';
  SELECT auth_user_id INTO creator_auth
  FROM public.profiles WHERE lower(email) = 'edoc-creator@example.test';

  IF reviewer_auth IS NULL OR creator_auth IS NULL THEN
    RAISE EXCEPTION 'Missing test accounts. Run edoc:provision-test-users then edoc:seed-staging-test';
  END IF;

  PERFORM pg_temp.edoc_rls_test_set_auth(reviewer_auth);
  SELECT count(*) INTO inbox_count
  FROM public.edoc_assignment_inbox
  WHERE document_number = 'EDOC-STAGING-001';

  IF inbox_count < 1 THEN
    RAISE EXCEPTION 'FAIL 4.R: reviewer inbox missing EDOC-STAGING-001 (count=%)', inbox_count;
  END IF;
  RAISE NOTICE 'PASS 4.R: reviewer inbox has EDOC-STAGING-001 (% row(s))', inbox_count;

  PERFORM pg_temp.edoc_rls_test_reset();

  PERFORM pg_temp.edoc_rls_test_set_auth(creator_auth);
  SELECT EXISTS (
    SELECT 1
    FROM public.user_menu_permissions ump
    JOIN public.profiles p ON p.id = ump.user_id
    WHERE p.auth_user_id = creator_auth
      AND ump.menu_id = 'edoc-create'
      AND COALESCE((ump.permissions->>'view')::boolean, false) = true
  ) INTO can_create;

  IF NOT can_create THEN
    RAISE EXCEPTION 'FAIL 4.C: creator lacks edoc-create menu permission';
  END IF;
  RAISE NOTICE 'PASS 4.C: creator has edoc-create permission';

  PERFORM pg_temp.edoc_rls_test_reset();

  RAISE NOTICE 'Phase 4 backend prerequisites OK. Browser smoke: npm run e2e:edoc-staging';
END $$;
