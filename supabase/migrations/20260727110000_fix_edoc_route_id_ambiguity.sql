-- Fix ambiguous column/variable name "route_id" in edoc_create_and_start_route
-- (same class of bug as the earlier profile_id ambiguity).

CREATE OR REPLACE FUNCTION public.edoc_create_and_start_route(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  FOR step_json IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{routing,steps}', '[]'::jsonb))
  LOOP
    v_step_id := gen_random_uuid()::text;
    INSERT INTO public.edoc_route_steps (
      id, organization_id, route_id, group_id, sequence, action, completion_rule, minimum_count, due_at, allow_delegation
    )
    VALUES (
      v_step_id, v_org_id, v_route_id,
      COALESCE(step_json->>'groupId', v_step_id),
      COALESCE((step_json->>'sequence')::integer, 1),
      step_json->>'action',
      COALESCE(step_json->>'completionRule', 'all'),
      NULLIF(step_json->>'minimumCount', '')::integer,
      NULLIF(step_json->>'dueAt', '')::timestamptz,
      COALESCE((step_json->>'allowDelegation')::boolean, false)
    );

    FOR v_assignee_id IN SELECT * FROM jsonb_array_elements_text(COALESCE(step_json->'assigneeIds', '[]'::jsonb))
    LOOP
      -- Assignees must be org members or inbox/document joins fail under security_invoker RLS.
      INSERT INTO public.edoc_organization_members (organization_id, profile_id, membership_role)
      VALUES (v_org_id, v_assignee_id, 'member')
      ON CONFLICT (organization_id, profile_id) DO NOTHING;

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
    WHERE a.route_id = v_route_id
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
    'active_assignment_id', v_active_assignment_id
  );
END;
$$;
