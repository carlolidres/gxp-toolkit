-- Edge functions need service_role table grants (RLS bypass alone is not enough).
-- Assignees also need SELECT on route/doc/file rows via edoc_can_access_document
-- (org-member-only policies blocked nested embeds and finalize for non-members).

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

DROP POLICY IF EXISTS "eDoc document accessor read" ON public.edoc_documents;
CREATE POLICY "eDoc document accessor read" ON public.edoc_documents
  FOR SELECT TO authenticated
  USING (public.edoc_can_access_document(id));

DROP POLICY IF EXISTS "eDoc document accessor read" ON public.edoc_document_versions;
CREATE POLICY "eDoc document accessor read" ON public.edoc_document_versions
  FOR SELECT TO authenticated
  USING (public.edoc_can_access_document(document_id));

DROP POLICY IF EXISTS "eDoc document accessor read" ON public.edoc_document_routes;
CREATE POLICY "eDoc document accessor read" ON public.edoc_document_routes
  FOR SELECT TO authenticated
  USING (public.edoc_can_access_document(document_id));

DROP POLICY IF EXISTS "eDoc document accessor read" ON public.edoc_document_files;
CREATE POLICY "eDoc document accessor read" ON public.edoc_document_files
  FOR SELECT TO authenticated
  USING (public.edoc_can_access_document(document_id));

DROP POLICY IF EXISTS "eDoc document accessor read" ON public.edoc_signature_fields;
CREATE POLICY "eDoc document accessor read" ON public.edoc_signature_fields
  FOR SELECT TO authenticated
  USING (public.edoc_can_access_document(document_id));

DROP POLICY IF EXISTS "eDoc document accessor read" ON public.edoc_signature_events;
CREATE POLICY "eDoc document accessor read" ON public.edoc_signature_events
  FOR SELECT TO authenticated
  USING (public.edoc_can_access_document(document_id));

DROP POLICY IF EXISTS "eDoc document accessor read" ON public.edoc_completion_certificates;
CREATE POLICY "eDoc document accessor read" ON public.edoc_completion_certificates
  FOR SELECT TO authenticated
  USING (public.edoc_can_access_document(document_id));

DROP POLICY IF EXISTS "eDoc document accessor read" ON public.edoc_route_steps;
CREATE POLICY "eDoc document accessor read" ON public.edoc_route_steps
  FOR SELECT TO authenticated
  USING (
    public.edoc_can_access_document((
      SELECT r.document_id FROM public.edoc_document_routes r WHERE r.id = route_id
    ))
  );

DROP POLICY IF EXISTS "eDoc document accessor read" ON public.edoc_route_step_actions;
CREATE POLICY "eDoc document accessor read" ON public.edoc_route_step_actions
  FOR SELECT TO authenticated
  USING (
    public.edoc_can_access_document((
      SELECT r.document_id FROM public.edoc_document_routes r WHERE r.id = route_id
    ))
  );

DROP POLICY IF EXISTS "eDoc document accessor read" ON public.edoc_audit_events;
CREATE POLICY "eDoc document accessor read" ON public.edoc_audit_events
  FOR SELECT TO authenticated
  USING (
    document_id IS NOT NULL
    AND public.edoc_can_access_document(document_id)
  );

DROP POLICY IF EXISTS "eDoc document accessor read" ON public.edoc_comments;
CREATE POLICY "eDoc document accessor read" ON public.edoc_comments
  FOR SELECT TO authenticated
  USING (public.edoc_can_access_document(document_id));

DROP POLICY IF EXISTS "eDoc document accessor read" ON public.edoc_document_access_grants;
CREATE POLICY "eDoc document accessor read" ON public.edoc_document_access_grants
  FOR SELECT TO authenticated
  USING (public.edoc_can_access_document(document_id));

NOTIFY pgrst, 'reload schema';
