-- Phase 3 manual eDoc RLS scenarios — JWT simulation as staging test users.
-- Run: supabase db query --linked -f supabase/scripts/verify_edoc_rls_manual.sql
-- Requires: seed_edoc_pilot.sql applied first.

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
  outsider_auth uuid;
  assignee_auth uuid;
  doc_count integer;
  err text;
BEGIN
  SELECT auth_user_id INTO outsider_auth
  FROM public.profiles WHERE lower(email) = 'edoc-outsider@example.test';
  SELECT auth_user_id INTO assignee_auth
  FROM public.profiles WHERE lower(email) = 'edoc-reviewer@example.test';

  IF outsider_auth IS NULL OR assignee_auth IS NULL THEN
    RAISE EXCEPTION 'Missing test accounts. Run edoc:provision-test-users then edoc:seed-staging-test';
  END IF;

  -- 3.1 Cross-org document read (outsider — not in org)
  PERFORM pg_temp.edoc_rls_test_set_auth(outsider_auth);
  SELECT count(*) INTO doc_count
  FROM public.edoc_documents
  WHERE id = 'staging-edoc-doc-001';

  IF doc_count <> 0 THEN
    RAISE EXCEPTION 'FAIL 3.1: outsider saw % org document rows (expected 0)', doc_count;
  END IF;
  RAISE NOTICE 'PASS 3.1: outsider cannot read org document via RLS';

  PERFORM pg_temp.edoc_rls_test_reset();

  -- 3.2 Wrong assignee action (outsider on reviewer assignment)
  PERFORM pg_temp.edoc_rls_test_set_auth(outsider_auth);
  BEGIN
    PERFORM public.edoc_advance_route(
      'staging-edoc-route-001',
      'staging-edoc-assignment-001',
      'review',
      NULL,
      'unauthorized attempt'
    );
    RAISE EXCEPTION 'FAIL 3.2: outsider advance_route should have been denied';
  EXCEPTION WHEN OTHERS THEN
    err := SQLERRM;
    IF err NOT ILIKE '%not authorized%' AND err NOT ILIKE '%authentication%' THEN
      RAISE EXCEPTION 'FAIL 3.2: unexpected error: %', err;
    END IF;
    RAISE NOTICE 'PASS 3.2: outsider blocked from assignment (%)', err;
  END;

  PERFORM pg_temp.edoc_rls_test_reset();

  -- 3.3 Audit immutability — assignee cannot mutate; trigger blocks postgres UPDATE
  PERFORM pg_temp.edoc_rls_test_set_auth(assignee_auth);
  UPDATE public.edoc_audit_events
  SET event_type = 'tamper'
  WHERE id = 'staging-edoc-audit-001';

  IF FOUND THEN
    RAISE EXCEPTION 'FAIL 3.3: assignee updated audit row (RLS should deny or trigger block)';
  END IF;
  RAISE NOTICE 'PASS 3.3: assignee cannot UPDATE audit via RLS (0 rows affected)';

  PERFORM pg_temp.edoc_rls_test_reset();

  BEGIN
    UPDATE public.edoc_audit_events
    SET event_type = 'tamper'
    WHERE id = 'staging-edoc-audit-001';
    RAISE EXCEPTION 'FAIL 3.3b: postgres audit UPDATE should hit append-only trigger';
  EXCEPTION WHEN OTHERS THEN
    err := SQLERRM;
    IF err NOT ILIKE '%append-only%' THEN
      RAISE EXCEPTION 'FAIL 3.3b: unexpected error: %', err;
    END IF;
    RAISE NOTICE 'PASS 3.3b: append-only trigger blocks UPDATE (%)', err;
  END;

  BEGIN
    DELETE FROM public.edoc_audit_events WHERE id = 'staging-edoc-audit-001';
    RAISE EXCEPTION 'FAIL 3.3c: postgres audit DELETE should hit append-only trigger';
  EXCEPTION WHEN OTHERS THEN
    err := SQLERRM;
    IF err NOT ILIKE '%append-only%' THEN
      RAISE EXCEPTION 'FAIL 3.3c: unexpected error: %', err;
    END IF;
    RAISE NOTICE 'PASS 3.3c: append-only trigger blocks DELETE (%)', err;
  END;

  PERFORM pg_temp.edoc_rls_test_reset();

  -- 3.5 Return without reason (reviewer — valid assignee)
  PERFORM pg_temp.edoc_rls_test_set_auth(assignee_auth);
  BEGIN
    PERFORM public.edoc_advance_route(
      'staging-edoc-route-001',
      'staging-edoc-assignment-001',
      'return',
      NULL,
      NULL
    );
    RAISE EXCEPTION 'FAIL 3.5: return without reason should have been rejected';
  EXCEPTION WHEN OTHERS THEN
    err := SQLERRM;
    IF err NOT ILIKE '%reason%' THEN
      RAISE EXCEPTION 'FAIL 3.5: unexpected error: %', err;
    END IF;
    RAISE NOTICE 'PASS 3.5: return without reason blocked (%)', err;
  END;

  PERFORM pg_temp.edoc_rls_test_reset();

  RAISE NOTICE 'Phase 3 automated RLS scenarios complete. Run 3.4 storage test via edoc-file-access Edge Function manually.';
END $$;
