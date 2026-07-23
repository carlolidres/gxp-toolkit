-- eDoc: complete routes immediately when no signatory steps are provided.
-- Preserves existing sequential/parallel activation for non-empty routes.

CREATE OR REPLACE FUNCTION public.edoc_start_route(p_route_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  route_row public.edoc_document_routes%ROWTYPE;
  first_sequence INTEGER;
  step_count INTEGER;
BEGIN
  SELECT * INTO route_row FROM public.edoc_document_routes WHERE id = p_route_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Route not found'; END IF;
  IF NOT public.edoc_can_access_document(route_row.document_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF route_row.status <> 'draft' THEN RAISE EXCEPTION 'Only draft routes can be started'; END IF;

  SELECT count(*) INTO step_count
  FROM public.edoc_route_steps
  WHERE route_id = p_route_id;

  IF step_count = 0 THEN
    UPDATE public.edoc_document_routes
    SET status = 'completed', started_at = now(), completed_at = now()
    WHERE id = p_route_id;
    UPDATE public.edoc_documents
    SET status = 'completed', updated_at = now()
    WHERE id = route_row.document_id;
    UPDATE public.edoc_document_versions
    SET status = 'completed'
    WHERE id = route_row.version_id;
    PERFORM public.edoc_create_audit_event(
      route_row.organization_id,
      'route_started',
      'route',
      p_route_id,
      route_row.document_id,
      route_row.version_id
    );
    PERFORM public.edoc_create_audit_event(
      route_row.organization_id,
      'route_completed_no_signatories',
      'route',
      p_route_id,
      route_row.document_id,
      route_row.version_id
    );
    RETURN jsonb_build_object(
      'ok', true,
      'routeCompleted', true,
      'documentStatus', 'completed',
      'message', 'Route completed with no signatories.'
    );
  END IF;

  UPDATE public.edoc_document_routes SET status = 'active', started_at = now() WHERE id = p_route_id;
  UPDATE public.edoc_documents SET status = 'awaiting_action', updated_at = now() WHERE id = route_row.document_id;

  IF route_row.mode = 'parallel' THEN
    UPDATE public.edoc_route_steps SET status = 'active' WHERE route_id = p_route_id AND status = 'pending';
  ELSE
    SELECT min(sequence) INTO first_sequence FROM public.edoc_route_steps WHERE route_id = p_route_id AND status = 'pending';
    UPDATE public.edoc_route_steps SET status = 'active' WHERE route_id = p_route_id AND sequence = first_sequence;
  END IF;

  UPDATE public.edoc_route_step_assignees a
  SET status = 'active'
  WHERE a.route_id = p_route_id
    AND a.step_id IN (SELECT id FROM public.edoc_route_steps WHERE route_id = p_route_id AND status = 'active');

  PERFORM public.edoc_create_audit_event(route_row.organization_id, 'route_started', 'route', p_route_id, route_row.document_id, route_row.version_id);
  RETURN jsonb_build_object('ok', true, 'routeCompleted', false, 'documentStatus', 'awaiting_action', 'message', 'Route started.');
END;
$$;
