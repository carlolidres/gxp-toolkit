-- eDoc send → inbox → PDF access:
-- 1) Add route assignees as org members so inbox view joins pass RLS.
-- 2) Return storage file keys so the client can upload the original PDF.
-- 3) Return the creator's active assignment id for deep-link to workspace.
-- 4) Allow document owners to upload originals into edoc-originals.

CREATE OR REPLACE FUNCTION public.edoc_create_and_start_route(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id TEXT := public.edoc_current_profile_id();
  org_id TEXT;
  doc_id TEXT := gen_random_uuid()::text;
  version_id TEXT := gen_random_uuid()::text;
  route_id TEXT := gen_random_uuid()::text;
  file_id TEXT := NULL;
  bucket_id TEXT := NULL;
  object_key TEXT := NULL;
  active_assignment_id TEXT := NULL;
  step_json JSONB;
  assignee_id TEXT;
  step_id TEXT;
  assignment_id TEXT;
  field_json JSONB;
  field_assignee_id TEXT;
BEGIN
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT organization_id INTO org_id
  FROM public.edoc_organization_members
  WHERE edoc_organization_members.profile_id = v_profile_id AND status = 'active'
  LIMIT 1;

  IF org_id IS NULL THEN
    INSERT INTO public.edoc_organizations (name, slug)
    VALUES ('Default eDoc Organization', 'default-edoc')
    ON CONFLICT (slug) DO UPDATE SET updated_at = now()
    RETURNING id INTO org_id;

    INSERT INTO public.edoc_organization_members (organization_id, profile_id, membership_role)
    VALUES (org_id, v_profile_id, 'owner')
    ON CONFLICT (organization_id, profile_id) DO NOTHING;
  END IF;

  INSERT INTO public.edoc_documents (
    id, organization_id, owner_id, document_number, title, description,
    document_type, category, department_name, business_unit_name, confidentiality,
    priority, due_at, retention_class, tags, status
  )
  VALUES (
    doc_id, org_id, v_profile_id,
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
  VALUES (version_id, org_id, doc_id, 1, 'active', p_payload #>> '{file,sha256}', v_profile_id);

  IF p_payload ? 'file' AND p_payload->'file' IS NOT NULL THEN
    file_id := gen_random_uuid()::text;
    bucket_id := 'edoc-originals';
    object_key := 'organizations/' || org_id || '/documents/' || doc_id || '/versions/' || version_id || '/original/' || (p_payload #>> '{file,name}');

    INSERT INTO public.edoc_document_files (
      id, organization_id, document_id, version_id, file_role, bucket_id, object_key,
      file_name, mime_type, size_bytes, sha256, created_by
    )
    VALUES (
      file_id, org_id, doc_id, version_id, 'original', bucket_id, object_key,
      p_payload #>> '{file,name}',
      COALESCE(p_payload #>> '{file,mimeType}', 'application/pdf'),
      COALESCE((p_payload #>> '{file,sizeBytes}')::bigint, 1),
      p_payload #>> '{file,sha256}',
      v_profile_id
    );
  END IF;

  INSERT INTO public.edoc_document_routes (id, organization_id, document_id, version_id, mode, status)
  VALUES (route_id, org_id, doc_id, version_id, COALESCE(p_payload #>> '{routing,mode}', 'sequential'), 'draft');

  FOR step_json IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{routing,steps}', '[]'::jsonb))
  LOOP
    step_id := gen_random_uuid()::text;
    INSERT INTO public.edoc_route_steps (
      id, organization_id, route_id, group_id, sequence, action, completion_rule, minimum_count, due_at, allow_delegation
    )
    VALUES (
      step_id, org_id, route_id,
      COALESCE(step_json->>'groupId', step_id),
      COALESCE((step_json->>'sequence')::integer, 1),
      step_json->>'action',
      COALESCE(step_json->>'completionRule', 'all'),
      NULLIF(step_json->>'minimumCount', '')::integer,
      NULLIF(step_json->>'dueAt', '')::timestamptz,
      COALESCE((step_json->>'allowDelegation')::boolean, false)
    );

    FOR assignee_id IN SELECT * FROM jsonb_array_elements_text(COALESCE(step_json->'assigneeIds', '[]'::jsonb))
    LOOP
      -- Assignees must be org members or inbox/document joins fail under security_invoker RLS.
      INSERT INTO public.edoc_organization_members (organization_id, profile_id, membership_role)
      VALUES (org_id, assignee_id, 'member')
      ON CONFLICT (organization_id, profile_id) DO NOTHING;

      assignment_id := gen_random_uuid()::text;
      INSERT INTO public.edoc_route_step_assignees (id, organization_id, route_id, step_id, assignee_id)
      VALUES (assignment_id, org_id, route_id, step_id, assignee_id);
    END LOOP;
  END LOOP;

  FOR field_json IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{fields}', '[]'::jsonb))
  LOOP
    field_assignee_id := NULLIF(field_json->>'assigneeId', '');
    IF field_assignee_id IS NULL AND position(':' in COALESCE(field_json->>'assigneeDraftId', '')) > 0 THEN
      field_assignee_id := substring(field_json->>'assigneeDraftId' from position(':' in field_json->>'assigneeDraftId') + 1);
    END IF;

    SELECT a.id INTO assignment_id
    FROM public.edoc_route_step_assignees a
    WHERE a.route_id = route_id
      AND (field_assignee_id IS NULL OR a.assignee_id = field_assignee_id)
    ORDER BY CASE WHEN field_assignee_id IS NOT NULL AND a.assignee_id = field_assignee_id THEN 0 ELSE 1 END
    LIMIT 1;

    IF assignment_id IS NOT NULL THEN
      INSERT INTO public.edoc_signature_fields (
        organization_id, document_id, version_id, assignment_id, field_type,
        page_number, x, y, width, height, rotation, required
      )
      VALUES (
        org_id, doc_id, version_id, assignment_id, field_json->>'fieldType',
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

  PERFORM public.edoc_create_audit_event(org_id, 'document_created', 'document', doc_id, doc_id, version_id);
  PERFORM public.edoc_start_route(route_id);

  SELECT a.id INTO active_assignment_id
  FROM public.edoc_route_step_assignees a
  WHERE a.route_id = route_id
    AND a.assignee_id = v_profile_id
    AND a.status = 'active'
  ORDER BY a.created_at ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'document_id', doc_id,
    'route_id', route_id,
    'version_id', version_id,
    'file_id', file_id,
    'bucket_id', bucket_id,
    'object_key', object_key,
    'active_assignment_id', active_assignment_id
  );
END;
$$;

DROP POLICY IF EXISTS "eDoc storage owner upload originals" ON storage.objects;
CREATE POLICY "eDoc storage owner upload originals" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'edoc-originals'
    AND EXISTS (
      SELECT 1
      FROM public.edoc_document_files f
      JOIN public.edoc_documents d ON d.id = f.document_id
      WHERE f.bucket_id = storage.objects.bucket_id
        AND f.object_key = storage.objects.name
        AND d.owner_id = public.edoc_current_profile_id()
    )
  );

DROP POLICY IF EXISTS "eDoc storage owner update originals" ON storage.objects;
CREATE POLICY "eDoc storage owner update originals" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'edoc-originals'
    AND EXISTS (
      SELECT 1
      FROM public.edoc_document_files f
      JOIN public.edoc_documents d ON d.id = f.document_id
      WHERE f.bucket_id = storage.objects.bucket_id
        AND f.object_key = storage.objects.name
        AND d.owner_id = public.edoc_current_profile_id()
    )
  )
  WITH CHECK (
    bucket_id = 'edoc-originals'
    AND EXISTS (
      SELECT 1
      FROM public.edoc_document_files f
      JOIN public.edoc_documents d ON d.id = f.document_id
      WHERE f.bucket_id = storage.objects.bucket_id
        AND f.object_key = storage.objects.name
        AND d.owner_id = public.edoc_current_profile_id()
    )
  );
