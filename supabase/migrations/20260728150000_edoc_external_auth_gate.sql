-- External Document Controller authorization gate (profile-org compare = Option A).
-- Prepends first-action-wins DC approve step when any signatory org differs from creator.

ALTER TABLE public.edoc_route_steps
  ADD COLUMN IF NOT EXISTS step_kind TEXT NOT NULL DEFAULT 'signatory'
    CHECK (step_kind IN ('signatory', 'external_auth'));

-- ---------------------------------------------------------------------------
-- Notify helper (uses edoc_notifications)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.edoc_notify_profiles(
  p_organization_id TEXT,
  p_recipient_ids TEXT[],
  p_notification_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_document_id TEXT DEFAULT NULL,
  p_route_step_id TEXT DEFAULT NULL,
  p_dedupe_suffix TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_recipient TEXT;
  v_count INTEGER := 0;
  v_dedupe TEXT;
BEGIN
  IF p_organization_id IS NULL OR p_recipient_ids IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH v_recipient IN ARRAY p_recipient_ids
  LOOP
    IF v_recipient IS NULL OR btrim(v_recipient) = '' THEN
      CONTINUE;
    END IF;
    v_dedupe := p_notification_type || ':' || COALESCE(p_document_id, 'none') || ':' || v_recipient
      || ':' || COALESCE(p_dedupe_suffix, to_char(now(), 'YYYYMMDDHH24MISS'));
    INSERT INTO public.edoc_notifications (
      organization_id, recipient_id, document_id, route_step_id,
      notification_type, dedupe_key, title, body
    )
    VALUES (
      p_organization_id, v_recipient, p_document_id, p_route_step_id,
      p_notification_type, v_dedupe, p_title, COALESCE(p_body, '')
    )
    ON CONFLICT (recipient_id, dedupe_key) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.edoc_notify_profiles(TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edoc_notify_profiles(TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- List active Document Controllers for caller's eDoc org
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.edoc_list_org_document_controllers()
RETURNS TABLE (profile_id TEXT, display_name TEXT, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_profile_id TEXT := public.edoc_current_profile_id();
  v_org_id TEXT;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT m.organization_id INTO v_org_id
  FROM public.edoc_organization_members m
  WHERE m.profile_id = v_profile_id AND m.status = 'active'
  ORDER BY CASE m.membership_role
    WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'controller' THEN 2 ELSE 3
  END
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.display_name, p.email
  FROM public.edoc_organization_members m
  JOIN public.profiles p ON p.id = m.profile_id
  WHERE m.organization_id = v_org_id
    AND m.membership_role = 'controller'
    AND m.status = 'active'
    AND p.active = true
  ORDER BY p.display_name;
END;
$$;

REVOKE ALL ON FUNCTION public.edoc_list_org_document_controllers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edoc_list_org_document_controllers() TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin: orgs (profile labels) that have members but no DC on matching eDoc org
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.edoc_admin_missing_controller_warnings()
RETURNS TABLE (organization_label TEXT, member_count BIGINT, edoc_organization_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Only administrators can view Document Controller warnings.';
  END IF;

  RETURN QUERY
  WITH labeled AS (
    SELECT
      lower(btrim(p.organization)) AS org_key,
      min(p.organization) AS organization_label,
      count(*)::bigint AS member_count
    FROM public.profiles p
    WHERE p.active = true
      AND p.organization IS NOT NULL
      AND btrim(p.organization) <> ''
    GROUP BY lower(btrim(p.organization))
  ),
  org_controllers AS (
    SELECT DISTINCT eo.id AS edoc_organization_id, lower(btrim(eo.name)) AS org_key
    FROM public.edoc_organizations eo
    JOIN public.edoc_organization_members m ON m.organization_id = eo.id
    WHERE m.membership_role = 'controller' AND m.status = 'active'
  )
  SELECT
    l.organization_label,
    l.member_count,
    (
      SELECT m.organization_id
      FROM public.edoc_organization_members m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE lower(btrim(COALESCE(p.organization, ''))) = l.org_key
        AND m.status = 'active'
      ORDER BY m.created_at ASC NULLS LAST
      LIMIT 1
    ) AS edoc_organization_id
  FROM labeled l
  WHERE NOT EXISTS (
    SELECT 1 FROM org_controllers c WHERE c.org_key = l.org_key
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.edoc_organization_members m
    JOIN public.profiles p ON p.id = m.profile_id
    WHERE lower(btrim(COALESCE(p.organization, ''))) = l.org_key
      AND m.membership_role = 'controller'
      AND m.status = 'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.edoc_admin_missing_controller_warnings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edoc_admin_missing_controller_warnings() TO authenticated;

-- ---------------------------------------------------------------------------
-- Create + start route with external auth gate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.edoc_create_and_start_route(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_profile_id TEXT := public.edoc_current_profile_id();
  v_org_id TEXT;
  v_doc_id TEXT := gen_random_uuid()::text;
  v_version_id TEXT := gen_random_uuid()::text;
  v_route_id TEXT := gen_random_uuid()::text;
  v_file_id TEXT := NULL;
  v_bucket_id TEXT := NULL;
  v_object_key TEXT := NULL;
  v_active_assignment_id TEXT := NULL;
  step_json JSONB;
  v_assignee_id TEXT;
  v_step_id TEXT;
  v_assignment_id TEXT;
  field_json JSONB;
  field_assignee_id TEXT;
  v_creator_org TEXT;
  v_creator_org_key TEXT;
  v_needs_external_auth BOOLEAN := false;
  v_assignee_org TEXT;
  v_assignee_org_key TEXT;
  v_signatory_ids TEXT[] := ARRAY[]::TEXT[];
  v_controller_ids TEXT[] := ARRAY[]::TEXT[];
  v_notify_ids TEXT[] := ARRAY[]::TEXT[];
  v_dc_step_id TEXT;
  v_seq_offset INTEGER := 0;
  v_controller_id TEXT;
BEGIN
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT organization_id INTO v_org_id
  FROM public.edoc_organization_members
  WHERE edoc_organization_members.profile_id = v_profile_id AND status = 'active'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO public.edoc_organizations (name, slug)
    VALUES ('Default eDoc Organization', 'default-edoc')
    ON CONFLICT (slug) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_org_id;

    INSERT INTO public.edoc_organization_members (organization_id, profile_id, membership_role)
    VALUES (v_org_id, v_profile_id, 'owner')
    ON CONFLICT (organization_id, profile_id) DO NOTHING;
  END IF;

  SELECT btrim(COALESCE(organization, '')) INTO v_creator_org
  FROM public.profiles WHERE id = v_profile_id;
  v_creator_org_key := lower(v_creator_org);

  IF v_creator_org_key = '' THEN
    RAISE EXCEPTION 'Complete your organization in Account Settings before sending documents.';
  END IF;

  -- Collect unique signatory assignee ids and detect external orgs
  FOR step_json IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{routing,steps}', '[]'::jsonb))
  LOOP
    FOR v_assignee_id IN SELECT * FROM jsonb_array_elements_text(COALESCE(step_json->'assigneeIds', '[]'::jsonb))
    LOOP
      IF v_assignee_id IS NULL OR btrim(v_assignee_id) = '' THEN
        CONTINUE;
      END IF;
      IF NOT (v_assignee_id = ANY (v_signatory_ids)) THEN
        v_signatory_ids := array_append(v_signatory_ids, v_assignee_id);
      END IF;
      SELECT btrim(COALESCE(organization, '')) INTO v_assignee_org
      FROM public.profiles WHERE id = v_assignee_id;
      v_assignee_org_key := lower(v_assignee_org);
      IF v_assignee_org_key IS DISTINCT FROM v_creator_org_key THEN
        v_needs_external_auth := true;
      END IF;
    END LOOP;
  END LOOP;

  IF v_needs_external_auth THEN
    SELECT coalesce(array_agg(m.profile_id ORDER BY p.display_name), ARRAY[]::TEXT[])
    INTO v_controller_ids
    FROM public.edoc_organization_members m
    JOIN public.profiles p ON p.id = m.profile_id
    WHERE m.organization_id = v_org_id
      AND m.membership_role = 'controller'
      AND m.status = 'active'
      AND p.active = true;

    IF coalesce(array_length(v_controller_ids, 1), 0) = 0 THEN
      -- Notify org peers + app admins
      SELECT coalesce(array_agg(DISTINCT p.id), ARRAY[]::TEXT[])
      INTO v_notify_ids
      FROM public.profiles p
      WHERE p.active = true
        AND (
          lower(btrim(COALESCE(p.organization, ''))) = v_creator_org_key
          OR p.role = 'admin'
        );

      PERFORM public.edoc_notify_profiles(
        v_org_id,
        v_notify_ids,
        'missing_document_controller',
        'Document Controller required',
        'At least one Document Controller must be assigned for organization "' || v_creator_org
          || '" before external documents can be sent.',
        NULL,
        NULL,
        'blocked'
      );

      PERFORM public.edoc_create_audit_event(
        v_org_id,
        'external_auth_blocked_no_controller',
        'organization',
        v_org_id,
        NULL,
        NULL,
        'No active Document Controller for creator organization',
        NULL,
        jsonb_build_object(
          'creator_organization', v_creator_org,
          'signatory_ids', to_jsonb(v_signatory_ids)
        )
      );

      RAISE EXCEPTION 'External transmission blocked: assign at least one Document Controller for your organization before sending to recipients in another organization.';
    END IF;

    v_seq_offset := 1;
  END IF;

  INSERT INTO public.edoc_documents (
    id, organization_id, owner_id, document_number, title, description,
    document_type, category, department_name, business_unit_name, confidentiality,
    priority, due_at, retention_class, tags, status
  )
  VALUES (
    v_doc_id, v_org_id, v_profile_id,
    p_payload #>> '{metadata,documentNumber}',
    p_payload #>> '{metadata,title}',
    COALESCE(p_payload #>> '{metadata,description}', ''),
    COALESCE(p_payload #>> '{metadata,documentType}', ''),
    COALESCE(p_payload #>> '{metadata,category}', ''),
    COALESCE(p_payload #>> '{metadata,department}', ''),
    COALESCE(p_payload #>> '{metadata,businessUnit}', ''),
    COALESCE(p_payload #>> '{metadata,confidentiality}', 'internal'),
    COALESCE(p_payload #>> '{metadata,priority}', 'normal'),
    NULLIF(p_payload #>> '{metadata,dueAt}', '')::timestamptz,
    COALESCE(p_payload #>> '{metadata,retentionClass}', ''),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload #> '{metadata,tags}', '[]'::jsonb))),
    'ready_for_routing'
  );

  INSERT INTO public.edoc_document_versions (id, organization_id, document_id, version_number, status, original_sha256, created_by)
  VALUES (v_version_id, v_org_id, v_doc_id, 1, 'active', p_payload #>> '{file,sha256}', v_profile_id);

  IF p_payload ? 'file' AND p_payload->'file' IS NOT NULL THEN
    v_file_id := gen_random_uuid()::text;
    v_bucket_id := 'edoc-originals';
    v_object_key := 'organizations/' || v_org_id || '/documents/' || v_doc_id || '/versions/' || v_version_id || '/original/' || (p_payload #>> '{file,name}');

    INSERT INTO public.edoc_document_files (
      id, organization_id, document_id, version_id, file_role, bucket_id, object_key,
      file_name, mime_type, size_bytes, sha256, created_by
    )
    VALUES (
      v_file_id, v_org_id, v_doc_id, v_version_id, 'original', v_bucket_id, v_object_key,
      p_payload #>> '{file,name}',
      COALESCE(p_payload #>> '{file,mimeType}', 'application/pdf'),
      COALESCE((p_payload #>> '{file,sizeBytes}')::bigint, 1),
      p_payload #>> '{file,sha256}',
      v_profile_id
    );
  END IF;

  INSERT INTO public.edoc_document_routes (id, organization_id, document_id, version_id, mode, status)
  VALUES (v_route_id, v_org_id, v_doc_id, v_version_id, COALESCE(p_payload #>> '{routing,mode}', 'sequential'), 'draft');

  -- Prepend external authorization step (first-action-wins)
  IF v_needs_external_auth THEN
    v_dc_step_id := gen_random_uuid()::text;
    INSERT INTO public.edoc_route_steps (
      id, organization_id, route_id, group_id, sequence, action, completion_rule,
      minimum_count, due_at, allow_delegation, step_kind
    )
    VALUES (
      v_dc_step_id, v_org_id, v_route_id, v_dc_step_id, 1, 'approve', 'any',
      NULL, NULL, false, 'external_auth'
    );

    FOREACH v_controller_id IN ARRAY v_controller_ids
    LOOP
      -- Controllers must be members (already are); ensure membership
      INSERT INTO public.edoc_organization_members (organization_id, profile_id, membership_role)
      VALUES (v_org_id, v_controller_id, 'controller')
      ON CONFLICT (organization_id, profile_id) DO NOTHING;

      v_assignment_id := gen_random_uuid()::text;
      INSERT INTO public.edoc_route_step_assignees (id, organization_id, route_id, step_id, assignee_id)
      VALUES (v_assignment_id, v_org_id, v_route_id, v_dc_step_id, v_controller_id);
    END LOOP;

    PERFORM public.edoc_create_audit_event(
      v_org_id,
      'external_auth_required',
      'route',
      v_route_id,
      v_doc_id,
      v_version_id,
      NULL,
      NULL,
      jsonb_build_object(
        'creator_organization', v_creator_org,
        'controller_ids', to_jsonb(v_controller_ids),
        'signatory_ids', to_jsonb(v_signatory_ids)
      )
    );

    PERFORM public.edoc_notify_profiles(
      v_org_id,
      v_controller_ids,
      'external_auth_requested',
      'External document authorization required',
      'Document "' || COALESCE(p_payload #>> '{metadata,title}', v_doc_id)
        || '" requires Document Controller authorization before external transmission.',
      v_doc_id,
      v_dc_step_id,
      'requested'
    );

    PERFORM public.edoc_create_audit_event(
      v_org_id, 'external_auth_requested', 'route_step', v_dc_step_id, v_doc_id, v_version_id,
      NULL, NULL, jsonb_build_object('controller_ids', to_jsonb(v_controller_ids))
    );
  END IF;

  FOR step_json IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{routing,steps}', '[]'::jsonb))
  LOOP
    v_step_id := gen_random_uuid()::text;
    INSERT INTO public.edoc_route_steps (
      id, organization_id, route_id, group_id, sequence, action, completion_rule,
      minimum_count, due_at, allow_delegation, step_kind
    )
    VALUES (
      v_step_id, v_org_id, v_route_id,
      COALESCE(step_json->>'groupId', v_step_id),
      COALESCE((step_json->>'sequence')::integer, 1) + v_seq_offset,
      step_json->>'action',
      COALESCE(step_json->>'completionRule', 'all'),
      NULLIF(step_json->>'minimumCount', '')::integer,
      NULLIF(step_json->>'dueAt', '')::timestamptz,
      COALESCE((step_json->>'allowDelegation')::boolean, false),
      'signatory'
    );

    FOR v_assignee_id IN SELECT * FROM jsonb_array_elements_text(COALESCE(step_json->'assigneeIds', '[]'::jsonb))
    LOOP
      -- Defer org membership bootstrap for external recipients until DC approval
      IF NOT v_needs_external_auth THEN
        INSERT INTO public.edoc_organization_members (organization_id, profile_id, membership_role)
        VALUES (v_org_id, v_assignee_id, 'member')
        ON CONFLICT (organization_id, profile_id) DO NOTHING;
      END IF;

      v_assignment_id := gen_random_uuid()::text;
      INSERT INTO public.edoc_route_step_assignees (id, organization_id, route_id, step_id, assignee_id)
      VALUES (v_assignment_id, v_org_id, v_route_id, v_step_id, v_assignee_id);
    END LOOP;
  END LOOP;

  FOR field_json IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{fields}', '[]'::jsonb))
  LOOP
    field_assignee_id := NULLIF(field_json->>'assigneeId', '');
    IF field_assignee_id IS NULL AND position(':' in COALESCE(field_json->>'assigneeDraftId', '')) > 0 THEN
      field_assignee_id := substring(field_json->>'assigneeDraftId' from position(':' in field_json->>'assigneeDraftId') + 1);
    END IF;

    SELECT a.id INTO v_assignment_id
    FROM public.edoc_route_step_assignees a
    JOIN public.edoc_route_steps s ON s.id = a.step_id
    WHERE a.route_id = v_route_id
      AND s.step_kind = 'signatory'
      AND (field_assignee_id IS NULL OR a.assignee_id = field_assignee_id)
    ORDER BY CASE WHEN field_assignee_id IS NOT NULL AND a.assignee_id = field_assignee_id THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_assignment_id IS NOT NULL THEN
      INSERT INTO public.edoc_signature_fields (
        organization_id, document_id, version_id, assignment_id, field_type,
        page_number, x, y, width, height, rotation, required
      )
      VALUES (
        v_org_id, v_doc_id, v_version_id, v_assignment_id, field_json->>'fieldType',
        COALESCE((field_json->>'pageNumber')::integer, 1),
        COALESCE((field_json->>'x')::numeric, 0),
        COALESCE((field_json->>'y')::numeric, 0),
        COALESCE((field_json->>'width')::numeric, 0.2),
        COALESCE((field_json->>'height')::numeric, 0.08),
        MOD(COALESCE((field_json->>'rotation')::numeric, 0) + 360, 360),
        COALESCE((field_json->>'required')::boolean, true)
      );
    END IF;
  END LOOP;

  PERFORM public.edoc_create_audit_event(v_org_id, 'document_created', 'document', v_doc_id, v_doc_id, v_version_id);
  PERFORM public.edoc_start_route(v_route_id);

  SELECT a.id INTO v_active_assignment_id
  FROM public.edoc_route_step_assignees a
  WHERE a.route_id = v_route_id
    AND a.assignee_id = v_profile_id
    AND a.status = 'active'
  ORDER BY a.created_at ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'document_id', v_doc_id,
    'route_id', v_route_id,
    'version_id', v_version_id,
    'file_id', v_file_id,
    'bucket_id', v_bucket_id,
    'object_key', v_object_key,
    'active_assignment_id', v_active_assignment_id,
    'needs_external_auth', v_needs_external_auth
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
