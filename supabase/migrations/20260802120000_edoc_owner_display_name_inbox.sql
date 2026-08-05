-- Inbox Owner must show the creator display name.
-- security_invoker views cannot join profiles under "Users read own profile" RLS,
-- so resolve the name through a SECURITY DEFINER helper.

CREATE OR REPLACE FUNCTION public.edoc_profile_display_name(p_profile_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    NULLIF(btrim(p.display_name), ''),
    NULLIF(btrim(p.email), ''),
    p.id
  )
  FROM public.profiles p
  WHERE p.id = p_profile_id
$$;

REVOKE ALL ON FUNCTION public.edoc_profile_display_name(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edoc_profile_display_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_profile_display_name(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.edoc_profile_labels(p_profile_ids TEXT[])
RETURNS TABLE (id TEXT, display_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    p.id,
    COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.email), ''), p.id) AS display_name
  FROM public.profiles p
  WHERE p.id = ANY (COALESCE(p_profile_ids, ARRAY[]::TEXT[]))
$$;

REVOKE ALL ON FUNCTION public.edoc_profile_labels(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edoc_profile_labels(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_profile_labels(TEXT[]) TO service_role;

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
  s.step_kind,
  s.due_at,
  d.id AS document_id,
  d.document_number,
  d.title AS document_title,
  d.owner_id,
  public.edoc_profile_display_name(d.owner_id) AS owner_name,
  v.id AS version_id,
  v.original_sha256 AS version_sha256
FROM public.edoc_route_step_assignees a
JOIN public.edoc_route_steps s ON s.id = a.step_id
JOIN public.edoc_document_routes r ON r.id = a.route_id
JOIN public.edoc_documents d ON d.id = r.document_id
JOIN public.edoc_document_versions v ON v.id = r.version_id
WHERE a.status = 'active'
  AND s.status = 'active'
  AND r.status = 'active';

REVOKE ALL ON public.edoc_assignment_inbox FROM PUBLIC;
REVOKE ALL ON public.edoc_assignment_inbox FROM anon;
GRANT SELECT ON public.edoc_assignment_inbox TO authenticated;

NOTIFY pgrst, 'reload schema';
