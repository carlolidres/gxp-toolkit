-- Inbox version_sha256 must reflect the PDF content currently stamped next
-- (latest signed file when present), not only the original upload hash.
-- Otherwise subsequent signers send the original hash and hit "Document hash mismatch".

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
  COALESCE(
    (
      SELECT f.sha256
      FROM public.edoc_document_files f
      WHERE f.document_id = d.id
        AND f.version_id = v.id
        AND f.file_role = 'signed'
        AND f.sha256 IS NOT NULL
        AND btrim(f.sha256) <> ''
      ORDER BY f.created_at DESC
      LIMIT 1
    ),
    v.original_sha256
  ) AS version_sha256
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
