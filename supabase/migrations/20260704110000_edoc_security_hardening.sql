-- eDoc security hardening (Supabase advisor follow-up)
-- 1. Revoke anon/PUBLIC EXECUTE on edoc_* RPCs — authenticated only
-- 2. Recreate edoc_assignment_inbox with security_invoker (RLS applies as caller)
-- 3. Pin search_path on edoc_prevent_audit_mutation trigger function

-- ---------------------------------------------------------------------------
-- 1. Lock down eDoc RPC execute grants
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'edoc\_%' ESCAPE '\'
      AND p.proname <> 'edoc_prevent_audit_mutation'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn.signature);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.edoc_current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_is_org_member(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_can_access_document(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_create_audit_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_start_route(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_advance_route(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_return_document(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_complete_acknowledgment(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_create_revision(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_create_and_start_route(JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Inbox view — security invoker so underlying table RLS applies
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.edoc_assignment_inbox;

CREATE VIEW public.edoc_assignment_inbox
WITH (security_invoker = true)
AS
SELECT
  a.id AS assignment_id,
  a.assignee_id,
  a.status AS assignment_status,
  a.route_id,
  s.id AS step_id,
  s.action,
  s.due_at,
  d.id AS document_id,
  d.document_number,
  d.title AS document_title,
  d.owner_id,
  owner.display_name AS owner_name,
  v.id AS version_id,
  v.original_sha256 AS version_sha256
FROM public.edoc_route_step_assignees a
JOIN public.edoc_route_steps s ON s.id = a.step_id
JOIN public.edoc_document_routes r ON r.id = a.route_id
JOIN public.edoc_documents d ON d.id = r.document_id
JOIN public.edoc_document_versions v ON v.id = r.version_id
LEFT JOIN public.profiles owner ON owner.id = d.owner_id
WHERE a.status IN ('active', 'pending');

REVOKE ALL ON public.edoc_assignment_inbox FROM PUBLIC;
REVOKE ALL ON public.edoc_assignment_inbox FROM anon;
GRANT SELECT ON public.edoc_assignment_inbox TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Trigger function — immutable search_path
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.edoc_prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'edoc_audit_events are append-only';
END;
$$;

REVOKE ALL ON FUNCTION public.edoc_prevent_audit_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edoc_prevent_audit_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.edoc_prevent_audit_mutation() FROM authenticated;

NOTIFY pgrst, 'reload schema';
