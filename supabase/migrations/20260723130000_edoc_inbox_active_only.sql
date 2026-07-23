-- Inbox must only show assignments that are currently actionable.
-- Pending signatories wait until their step activates (sequential / level-parallel modes).

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
WHERE a.status = 'active'
  AND s.status = 'active'
  AND r.status = 'active';

REVOKE ALL ON public.edoc_assignment_inbox FROM PUBLIC;
REVOKE ALL ON public.edoc_assignment_inbox FROM anon;
GRANT SELECT ON public.edoc_assignment_inbox TO authenticated;
