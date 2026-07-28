-- External auth: advance-route first-action handling, inbox step_kind, DC nomination audit.

-- ---------------------------------------------------------------------------
-- Inbox exposes step_kind for UI banners
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
  s.step_kind,
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

-- ---------------------------------------------------------------------------
-- Advance route with external_auth notifications + deferred member bootstrap
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.edoc_advance_route(
  p_route_id TEXT,
  p_assignment_id TEXT,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  profile_id TEXT := public.edoc_current_profile_id();
  assignment_row public.edoc_route_step_assignees%ROWTYPE;
  step_row public.edoc_route_steps%ROWTYPE;
  route_row public.edoc_document_routes%ROWTYPE;
  required_count INTEGER;
  completed_count INTEGER;
  eligible_count INTEGER;
  next_sequence INTEGER;
  route_complete BOOLEAN;
  v_is_external_auth BOOLEAN := false;
  v_actor_name TEXT;
  v_sibling_ids TEXT[] := ARRAY[]::TEXT[];
  v_pending_assignee_ids TEXT[] := ARRAY[]::TEXT[];
  v_notify_body TEXT;
BEGIN
  IF profile_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_action IN ('return', 'reject') AND COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  SELECT * INTO assignment_row FROM public.edoc_route_step_assignees WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
  IF assignment_row.route_id <> p_route_id THEN RAISE EXCEPTION 'Route mismatch'; END IF;
  IF assignment_row.assignee_id <> profile_id THEN RAISE EXCEPTION 'Not authorized for this assignment'; END IF;
  IF assignment_row.status <> 'active' THEN
    RAISE EXCEPTION 'This authorization request was already completed.';
  END IF;

  SELECT * INTO step_row FROM public.edoc_route_steps WHERE id = assignment_row.step_id FOR UPDATE;
  SELECT * INTO route_row FROM public.edoc_document_routes WHERE id = p_route_id FOR UPDATE;
  IF step_row.status <> 'active' OR route_row.status <> 'active' THEN
    RAISE EXCEPTION 'This authorization request was already completed.';
  END IF;

  v_is_external_auth := COALESCE(step_row.step_kind, 'signatory') = 'external_auth';
  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = profile_id;

  IF p_action = 'return' THEN
    UPDATE public.edoc_route_step_assignees SET status = 'returned', completed_at = now() WHERE id = p_assignment_id;
    UPDATE public.edoc_route_steps SET status = 'returned' WHERE id = step_row.id;
    UPDATE public.edoc_document_routes SET status = 'returned' WHERE id = p_route_id;
    UPDATE public.edoc_documents SET status = 'returned', updated_at = now() WHERE id = route_row.document_id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.edoc_route_step_assignees SET status = 'rejected', completed_at = now() WHERE id = p_assignment_id;
    UPDATE public.edoc_route_steps SET status = 'rejected' WHERE id = step_row.id;
    UPDATE public.edoc_document_routes SET status = 'rejected' WHERE id = p_route_id;
    UPDATE public.edoc_documents SET status = 'rejected', updated_at = now() WHERE id = route_row.document_id;

    IF v_is_external_auth THEN
      SELECT coalesce(array_agg(DISTINCT uid), ARRAY[]::TEXT[])
      INTO v_sibling_ids
      FROM (
        SELECT a.assignee_id AS uid
        FROM public.edoc_route_step_assignees a
        WHERE a.step_id = step_row.id
          AND a.assignee_id <> profile_id
          AND a.status IN ('active', 'pending', 'rejected')
        UNION
        SELECT d.owner_id
        FROM public.edoc_documents d
        WHERE d.id = route_row.document_id AND d.owner_id <> profile_id
      ) q;

      UPDATE public.edoc_route_step_assignees
      SET status = 'invalidated'
      WHERE step_id = step_row.id AND status IN ('active', 'pending');

      v_notify_body := 'External authorization was rejected by ' || COALESCE(v_actor_name, profile_id)
        || ' at ' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI "UTC"')
        || '. Reason: ' || COALESCE(p_reason, '');

      PERFORM public.edoc_notify_profiles(
        route_row.organization_id, v_sibling_ids, 'external_auth_rejected',
        'External authorization rejected', v_notify_body,
        route_row.document_id, step_row.id, 'rejected'
      );

      PERFORM public.edoc_create_audit_event(
        route_row.organization_id, 'external_auth_rejected', 'assignment', p_assignment_id,
        route_row.document_id, route_row.version_id, p_reason,
        NULL, jsonb_build_object('actor_id', profile_id, 'actor_name', v_actor_name, 'comment', p_comment)
      );
    END IF;
  ELSE
    UPDATE public.edoc_route_step_assignees SET status = 'completed', completed_at = now() WHERE id = p_assignment_id;

    SELECT count(*) INTO eligible_count
    FROM public.edoc_route_step_assignees
    WHERE step_id = step_row.id AND status <> 'invalidated' AND status <> 'delegated';

    SELECT count(*) INTO completed_count
    FROM public.edoc_route_step_assignees
    WHERE step_id = step_row.id AND status = 'completed';

    required_count := CASE step_row.completion_rule
      WHEN 'any' THEN 1
      WHEN 'majority' THEN floor(eligible_count / 2.0)::integer + 1
      WHEN 'minimum_count' THEN LEAST(eligible_count, GREATEST(1, COALESCE(step_row.minimum_count, 1)))
      ELSE eligible_count
    END;

    IF completed_count >= required_count THEN
      -- Capture siblings before invalidate
      SELECT coalesce(array_agg(a.assignee_id), ARRAY[]::TEXT[])
      INTO v_sibling_ids
      FROM public.edoc_route_step_assignees a
      WHERE a.step_id = step_row.id
        AND a.status IN ('active', 'pending')
        AND a.assignee_id <> profile_id;

      UPDATE public.edoc_route_steps SET status = 'completed' WHERE id = step_row.id;
      UPDATE public.edoc_route_step_assignees
      SET status = 'invalidated'
      WHERE step_id = step_row.id AND status IN ('active', 'pending');

      IF v_is_external_auth THEN
        v_notify_body := 'External authorization was approved by ' || COALESCE(v_actor_name, profile_id)
          || ' at ' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI "UTC"')
          || '. This request is closed for remaining Document Controllers.';

        PERFORM public.edoc_notify_profiles(
          route_row.organization_id, v_sibling_ids, 'external_auth_approved',
          'External authorization already approved', v_notify_body,
          route_row.document_id, step_row.id, 'approved'
        );

        PERFORM public.edoc_create_audit_event(
          route_row.organization_id, 'external_auth_approved', 'assignment', p_assignment_id,
          route_row.document_id, route_row.version_id, NULL,
          NULL, jsonb_build_object(
            'actor_id', profile_id,
            'actor_name', v_actor_name,
            'siblings_notified', to_jsonb(v_sibling_ids)
          )
        );

        PERFORM public.edoc_create_audit_event(
          route_row.organization_id, 'external_auth_siblings_notified', 'route_step', step_row.id,
          route_row.document_id, route_row.version_id, NULL,
          NULL, jsonb_build_object('recipient_ids', to_jsonb(v_sibling_ids))
        );

        -- Bootstrap deferred signatory members
        SELECT coalesce(array_agg(DISTINCT a.assignee_id), ARRAY[]::TEXT[])
        INTO v_pending_assignee_ids
        FROM public.edoc_route_step_assignees a
        JOIN public.edoc_route_steps s ON s.id = a.step_id
        WHERE a.route_id = p_route_id
          AND s.step_kind = 'signatory';

        IF coalesce(array_length(v_pending_assignee_ids, 1), 0) > 0 THEN
          INSERT INTO public.edoc_organization_members (organization_id, profile_id, membership_role)
          SELECT route_row.organization_id, uid, 'member'
          FROM unnest(v_pending_assignee_ids) AS uid
          ON CONFLICT (organization_id, profile_id) DO NOTHING;
        END IF;
      END IF;

      IF route_row.mode = 'parallel' THEN
        UPDATE public.edoc_route_steps
        SET status = 'active'
        WHERE route_id = p_route_id AND status = 'pending';
      ELSE
        SELECT min(sequence) INTO next_sequence
        FROM public.edoc_route_steps
        WHERE route_id = p_route_id AND status = 'pending';
        IF next_sequence IS NOT NULL THEN
          UPDATE public.edoc_route_steps
          SET status = 'active'
          WHERE route_id = p_route_id AND sequence = next_sequence;
        END IF;
      END IF;

      UPDATE public.edoc_route_step_assignees a
      SET status = 'active'
      WHERE a.route_id = p_route_id
        AND a.status = 'pending'
        AND a.step_id IN (SELECT id FROM public.edoc_route_steps WHERE route_id = p_route_id AND status = 'active');

      IF v_is_external_auth THEN
        PERFORM public.edoc_create_audit_event(
          route_row.organization_id, 'external_auth_transmitted', 'route', p_route_id,
          route_row.document_id, route_row.version_id, NULL,
          NULL, jsonb_build_object('bootstrapped_assignees', to_jsonb(v_pending_assignee_ids))
        );
      END IF;
    END IF;
  END IF;

  INSERT INTO public.edoc_route_step_actions (
    organization_id, route_id, step_id, assignment_id, actor_id, action, status, comment, reason
  )
  VALUES (
    route_row.organization_id, p_route_id, step_row.id, p_assignment_id, profile_id, p_action,
    CASE WHEN p_action = 'return' THEN 'returned' WHEN p_action = 'reject' THEN 'rejected' ELSE 'completed' END,
    COALESCE(p_comment, ''), p_reason
  );

  route_complete := NOT EXISTS (
    SELECT 1 FROM public.edoc_route_steps
    WHERE route_id = p_route_id AND status NOT IN ('completed', 'skipped')
  );

  IF route_complete THEN
    UPDATE public.edoc_document_routes SET status = 'completed', completed_at = now() WHERE id = p_route_id;
    UPDATE public.edoc_documents SET status = 'completed', updated_at = now() WHERE id = route_row.document_id;
    UPDATE public.edoc_document_versions SET status = 'completed' WHERE id = route_row.version_id;
  END IF;

  PERFORM public.edoc_create_audit_event(
    route_row.organization_id, p_action || '_completed', 'assignment', p_assignment_id,
    route_row.document_id, route_row.version_id, p_reason
  );

  RETURN jsonb_build_object(
    'ok', true,
    'routeCompleted', route_complete,
    'documentStatus', CASE
      WHEN p_action = 'return' THEN 'returned'
      WHEN p_action = 'reject' THEN 'rejected'
      WHEN route_complete THEN 'completed'
      ELSE 'awaiting_action'
    END,
    'message', 'Assignment action recorded.'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Document Controller nomination: audit + own-org self-assign only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_edoc_document_controller(
  target_profile_id TEXT,
  is_controller BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_actor_id TEXT := public.edoc_current_profile_id();
  v_org_id TEXT;
  v_existing_role TEXT;
  v_member_id TEXT;
  v_actor_org_key TEXT;
  v_target_org_key TEXT;
  v_was_controller BOOLEAN := false;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Only administrators can nominate a Document Controller.';
  END IF;

  IF target_profile_id IS NULL OR btrim(target_profile_id) = '' THEN
    RAISE EXCEPTION 'target_profile_id is required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_profile_id) THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  -- Self-assign only for own organization (profile organization label)
  IF v_actor_id IS NOT NULL AND target_profile_id = v_actor_id THEN
    SELECT lower(btrim(COALESCE(organization, ''))) INTO v_actor_org_key
    FROM public.profiles WHERE id = v_actor_id;
    IF v_actor_org_key IS NULL OR v_actor_org_key = '' THEN
      RAISE EXCEPTION 'Set your organization in Account Settings before assigning yourself as Document Controller.';
    END IF;
  END IF;

  SELECT m.organization_id, m.membership_role
  INTO v_org_id, v_existing_role
  FROM public.edoc_organization_members m
  WHERE m.profile_id = target_profile_id
    AND m.status = 'active'
  ORDER BY CASE m.membership_role
    WHEN 'owner' THEN 0
    WHEN 'admin' THEN 1
    WHEN 'controller' THEN 2
    ELSE 3
  END
  LIMIT 1;

  v_was_controller := (v_existing_role = 'controller');

  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id
    FROM public.edoc_organizations
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No eDoc organization exists. Seed or create an organization first.';
  END IF;

  -- Cross-org self-assign guard: target profile org must match actor when self-assigning
  IF v_actor_id IS NOT NULL AND target_profile_id = v_actor_id THEN
    SELECT lower(btrim(COALESCE(organization, ''))) INTO v_target_org_key
    FROM public.profiles WHERE id = target_profile_id;
    IF v_target_org_key IS DISTINCT FROM v_actor_org_key THEN
      RAISE EXCEPTION 'Administrators may only self-assign as Document Controller for their own organization.';
    END IF;
  END IF;

  -- Preserve org owner/admin membership roles; still treat them as nominated controllers in app UI via permissions.
  IF v_existing_role IN ('owner', 'admin') THEN
    PERFORM public.edoc_create_audit_event(
      v_org_id,
      CASE WHEN is_controller THEN 'document_controller_assigned' ELSE 'document_controller_removed' END,
      'profile',
      target_profile_id,
      NULL,
      NULL,
      'Owner/admin membership preserved; controller flag recorded for permissions',
      NULL,
      jsonb_build_object(
        'target_profile_id', target_profile_id,
        'is_controller', is_controller,
        'preserved_role', v_existing_role,
        'actor_id', v_actor_id
      )
    );
    RETURN is_controller;
  END IF;

  v_member_id := 'edoc-dc-' || md5(target_profile_id);

  INSERT INTO public.edoc_organization_members (
    id, organization_id, profile_id, department_name, membership_role, status, created_at
  )
  VALUES (
    v_member_id,
    v_org_id,
    target_profile_id,
    NULL,
    CASE WHEN is_controller THEN 'controller' ELSE 'member' END,
    'active',
    now()
  )
  ON CONFLICT (organization_id, profile_id) DO UPDATE
  SET
    membership_role = CASE WHEN is_controller THEN 'controller' ELSE 'member' END,
    status = 'active';

  IF is_controller IS DISTINCT FROM v_was_controller THEN
    PERFORM public.edoc_create_audit_event(
      v_org_id,
      CASE WHEN is_controller THEN 'document_controller_assigned' ELSE 'document_controller_removed' END,
      'profile',
      target_profile_id,
      NULL,
      NULL,
      NULL,
      NULL,
      jsonb_build_object(
        'target_profile_id', target_profile_id,
        'is_controller', is_controller,
        'actor_id', v_actor_id,
        'changed_at', now()
      )
    );
  END IF;

  RETURN is_controller;
END;
$$;

NOTIFY pgrst, 'reload schema';
