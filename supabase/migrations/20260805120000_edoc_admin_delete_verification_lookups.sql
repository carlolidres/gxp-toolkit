-- Purge public verification lookups before deleting completion certificates.
-- Also delete page integrity rows explicitly for clarity (they CASCADE from certificates).

CREATE OR REPLACE FUNCTION public.edoc_admin_delete_document(p_document_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_title TEXT;
  v_number TEXT;
  v_org TEXT;
  v_files JSONB := '[]'::jsonb;
  v_certs JSONB := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_vrms_admin() THEN
    RAISE EXCEPTION 'Only administrators can permanently delete eDoc documents';
  END IF;
  IF p_document_id IS NULL OR btrim(p_document_id) = '' THEN
    RAISE EXCEPTION 'Document id is required';
  END IF;

  SELECT d.title, d.document_number, d.organization_id
  INTO v_title, v_number, v_org
  FROM public.edoc_documents d
  WHERE d.id = p_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  SELECT coalesce(
    jsonb_agg(jsonb_build_object('bucket_id', f.bucket_id, 'object_key', f.object_key)),
    '[]'::jsonb
  )
  INTO v_files
  FROM public.edoc_document_files f
  WHERE f.document_id = p_document_id;

  SELECT coalesce(
    jsonb_agg(jsonb_build_object('bucket_id', c.bucket_id, 'object_key', c.object_key)),
    '[]'::jsonb
  )
  INTO v_certs
  FROM public.edoc_completion_certificates c
  WHERE c.document_id = p_document_id;

  PERFORM set_config('app.edoc_audit_purge', '1', true);

  DELETE FROM public.edoc_file_access_logs
  WHERE file_id IN (
    SELECT id FROM public.edoc_document_files WHERE document_id = p_document_id
  );

  DELETE FROM public.edoc_verification_lookups
  WHERE certificate_id IN (
    SELECT id FROM public.edoc_completion_certificates WHERE document_id = p_document_id
  )
  OR verification_code IN (
    SELECT verification_code FROM public.edoc_completion_certificates WHERE document_id = p_document_id
  );

  DELETE FROM public.edoc_page_integrity_codes WHERE document_id = p_document_id;
  DELETE FROM public.edoc_signature_events WHERE document_id = p_document_id;
  DELETE FROM public.edoc_completion_certificates WHERE document_id = p_document_id;

  DELETE FROM public.edoc_route_step_actions
  WHERE route_id IN (SELECT id FROM public.edoc_document_routes WHERE document_id = p_document_id);

  DELETE FROM public.edoc_route_step_assignees
  WHERE route_id IN (SELECT id FROM public.edoc_document_routes WHERE document_id = p_document_id);

  DELETE FROM public.edoc_route_steps
  WHERE route_id IN (SELECT id FROM public.edoc_document_routes WHERE document_id = p_document_id);

  DELETE FROM public.edoc_document_routes WHERE document_id = p_document_id;
  DELETE FROM public.edoc_signature_fields WHERE document_id = p_document_id;
  DELETE FROM public.edoc_comments WHERE document_id = p_document_id;
  DELETE FROM public.edoc_notifications WHERE document_id = p_document_id;
  DELETE FROM public.edoc_audit_events WHERE document_id = p_document_id;
  DELETE FROM public.edoc_document_access_grants WHERE document_id = p_document_id;
  DELETE FROM public.edoc_document_files WHERE document_id = p_document_id;
  DELETE FROM public.edoc_document_versions WHERE document_id = p_document_id;
  DELETE FROM public.edoc_documents WHERE id = p_document_id;

  RETURN jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'document_number', v_number,
    'title', v_title,
    'organization_id', v_org,
    'storage_objects', coalesce(v_files, '[]'::jsonb) || coalesce(v_certs, '[]'::jsonb)
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
