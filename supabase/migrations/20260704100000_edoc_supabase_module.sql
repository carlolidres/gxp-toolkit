-- eDoc module for GxP Toolkit.
-- Uses prefixed edoc_* objects to avoid collisions with existing VRMS tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.edoc_organizations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_organization_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_name TEXT,
  business_unit_name TEXT,
  membership_role TEXT NOT NULL DEFAULT 'member'
    CHECK (membership_role IN ('owner', 'admin', 'controller', 'auditor', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.edoc_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  owner_id TEXT NOT NULL REFERENCES public.profiles(id),
  document_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  document_type TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  department_name TEXT NOT NULL DEFAULT '',
  business_unit_name TEXT NOT NULL DEFAULT '',
  confidentiality TEXT NOT NULL DEFAULT 'internal',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_at TIMESTAMPTZ,
  retention_class TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'preparing', 'ready_for_routing', 'in_routing', 'awaiting_action',
    'returned', 'rejected', 'completed', 'cancelled', 'expired', 'archived'
  )),
  current_version_number INTEGER NOT NULL DEFAULT 1 CHECK (current_version_number > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lock_version INTEGER NOT NULL DEFAULT 0,
  UNIQUE (organization_id, document_number)
);

CREATE TABLE IF NOT EXISTS public.edoc_document_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  document_id TEXT NOT NULL REFERENCES public.edoc_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'superseded', 'completed', 'void')),
  source_version_id TEXT REFERENCES public.edoc_document_versions(id),
  change_summary TEXT,
  original_sha256 TEXT,
  final_sha256 TEXT,
  created_by TEXT NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.edoc_document_files (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  document_id TEXT NOT NULL REFERENCES public.edoc_documents(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES public.edoc_document_versions(id) ON DELETE CASCADE,
  file_role TEXT NOT NULL CHECK (file_role IN ('original', 'revised', 'signed', 'certificate', 'attachment')),
  bucket_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  sha256 TEXT,
  created_by TEXT REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_document_access_grants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  document_id TEXT NOT NULL REFERENCES public.edoc_documents(id) ON DELETE CASCADE,
  grantee_id TEXT NOT NULL REFERENCES public.profiles(id),
  permission_level TEXT NOT NULL CHECK (permission_level IN ('view', 'comment', 'edit')),
  granted_by TEXT NOT NULL REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_routing_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL CHECK (mode IN ('sequential', 'parallel', 'mixed')),
  created_by TEXT NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.edoc_document_routes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  document_id TEXT NOT NULL REFERENCES public.edoc_documents(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES public.edoc_document_versions(id),
  template_id TEXT REFERENCES public.edoc_routing_templates(id),
  mode TEXT NOT NULL CHECK (mode IN ('sequential', 'parallel', 'mixed')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'rejected', 'returned', 'cancelled', 'expired')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_route_steps (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  route_id TEXT NOT NULL REFERENCES public.edoc_document_routes(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  action TEXT NOT NULL CHECK (action IN ('review', 'approve', 'sign', 'acknowledge')),
  completion_rule TEXT NOT NULL DEFAULT 'all' CHECK (completion_rule IN ('all', 'any', 'majority', 'minimum_count')),
  minimum_count INTEGER,
  due_at TIMESTAMPTZ,
  allow_delegation BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'rejected', 'returned', 'skipped', 'invalidated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_route_step_assignees (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  route_id TEXT NOT NULL REFERENCES public.edoc_document_routes(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL REFERENCES public.edoc_route_steps(id) ON DELETE CASCADE,
  assignee_id TEXT NOT NULL REFERENCES public.profiles(id),
  delegated_from_profile_id TEXT REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'rejected', 'returned', 'delegated', 'invalidated')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_route_step_actions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  route_id TEXT NOT NULL REFERENCES public.edoc_document_routes(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL REFERENCES public.edoc_route_steps(id) ON DELETE CASCADE,
  assignment_id TEXT NOT NULL REFERENCES public.edoc_route_step_assignees(id),
  actor_id TEXT NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL CHECK (action IN ('review', 'approve', 'sign', 'acknowledge', 'reject', 'return', 'delegate', 'cancel')),
  status TEXT NOT NULL CHECK (status IN ('completed', 'rejected', 'returned', 'delegated', 'cancelled')),
  comment TEXT NOT NULL DEFAULT '',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_signature_fields (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  document_id TEXT NOT NULL REFERENCES public.edoc_documents(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES public.edoc_document_versions(id) ON DELETE CASCADE,
  assignment_id TEXT NOT NULL REFERENCES public.edoc_route_step_assignees(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL CHECK (field_type IN (
    'signature', 'initial', 'date_signed', 'name', 'job_title', 'text',
    'approval_meaning', 'review_meaning', 'acknowledgment', 'checkbox'
  )),
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  x NUMERIC NOT NULL CHECK (x >= 0 AND x <= 1),
  y NUMERIC NOT NULL CHECK (y >= 0 AND y <= 1),
  width NUMERIC NOT NULL CHECK (width > 0 AND width <= 1),
  height NUMERIC NOT NULL CHECK (height > 0 AND height <= 1),
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_signature_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  document_id TEXT NOT NULL REFERENCES public.edoc_documents(id),
  version_id TEXT NOT NULL REFERENCES public.edoc_document_versions(id),
  route_id TEXT NOT NULL REFERENCES public.edoc_document_routes(id),
  step_id TEXT NOT NULL REFERENCES public.edoc_route_steps(id),
  assignment_id TEXT NOT NULL REFERENCES public.edoc_route_step_assignees(id),
  signer_id TEXT NOT NULL REFERENCES public.profiles(id),
  signer_display_name TEXT NOT NULL,
  signature_meaning TEXT NOT NULL,
  auth_method TEXT NOT NULL,
  auth_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  signing_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_ip TEXT,
  user_agent TEXT,
  session_id TEXT,
  original_pdf_hash TEXT NOT NULL,
  signed_pdf_hash TEXT,
  integrity_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_completion_certificates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  document_id TEXT NOT NULL REFERENCES public.edoc_documents(id),
  version_id TEXT NOT NULL REFERENCES public.edoc_document_versions(id),
  route_id TEXT NOT NULL REFERENCES public.edoc_document_routes(id),
  bucket_id TEXT NOT NULL DEFAULT 'edoc-certificates',
  object_key TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  document_id TEXT NOT NULL REFERENCES public.edoc_documents(id) ON DELETE CASCADE,
  version_id TEXT REFERENCES public.edoc_document_versions(id),
  route_step_id TEXT REFERENCES public.edoc_route_steps(id),
  parent_comment_id TEXT REFERENCES public.edoc_comments(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES public.profiles(id),
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  private BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  recipient_id TEXT NOT NULL REFERENCES public.profiles(id),
  document_id TEXT REFERENCES public.edoc_documents(id) ON DELETE CASCADE,
  route_step_id TEXT REFERENCES public.edoc_route_steps(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipient_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS public.edoc_audit_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  actor_id TEXT REFERENCES public.profiles(id),
  actor_name TEXT,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  document_id TEXT REFERENCES public.edoc_documents(id),
  version_id TEXT REFERENCES public.edoc_document_versions(id),
  previous_value JSONB,
  new_value JSONB,
  reason TEXT,
  source_ip TEXT,
  user_agent TEXT,
  request_id TEXT,
  source TEXT NOT NULL DEFAULT 'app',
  integrity_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_file_access_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  file_id TEXT NOT NULL REFERENCES public.edoc_document_files(id),
  profile_id TEXT NOT NULL REFERENCES public.profiles(id),
  access_type TEXT NOT NULL CHECK (access_type IN ('preview', 'download')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES public.edoc_organizations(id),
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_edoc_documents_org_status ON public.edoc_documents (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_edoc_documents_owner ON public.edoc_documents (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_edoc_versions_document ON public.edoc_document_versions (document_id, version_number);
CREATE INDEX IF NOT EXISTS idx_edoc_routes_document ON public.edoc_document_routes (document_id, status);
CREATE INDEX IF NOT EXISTS idx_edoc_assignments_inbox ON public.edoc_route_step_assignees (assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_edoc_audit_document ON public.edoc_audit_events (document_id, created_at DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('edoc-originals', 'edoc-originals', false),
  ('edoc-versions', 'edoc-versions', false),
  ('edoc-signed', 'edoc-signed', false),
  ('edoc-attachments', 'edoc-attachments', false),
  ('edoc-certificates', 'edoc-certificates', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE OR REPLACE FUNCTION public.edoc_current_profile_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.edoc_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.edoc_is_org_member(target_org_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.edoc_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.edoc_organization_members m
      WHERE m.organization_id = target_org_id
        AND m.profile_id = public.edoc_current_profile_id()
        AND m.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.edoc_can_access_document(target_document_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.edoc_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.edoc_documents d
      WHERE d.id = target_document_id
        AND (
          d.owner_id = public.edoc_current_profile_id()
          OR public.edoc_is_org_member(d.organization_id)
          OR EXISTS (
            SELECT 1 FROM public.edoc_document_access_grants g
            WHERE g.document_id = d.id
              AND g.grantee_id = public.edoc_current_profile_id()
              AND (g.expires_at IS NULL OR g.expires_at > now())
          )
          OR EXISTS (
            SELECT 1
            FROM public.edoc_route_step_assignees a
            WHERE a.route_id IN (
              SELECT r.id FROM public.edoc_document_routes r WHERE r.document_id = d.id
            )
              AND a.assignee_id = public.edoc_current_profile_id()
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.edoc_prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'edoc_audit_events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS prevent_edoc_audit_update ON public.edoc_audit_events;
CREATE TRIGGER prevent_edoc_audit_update
BEFORE UPDATE ON public.edoc_audit_events
FOR EACH ROW EXECUTE FUNCTION public.edoc_prevent_audit_mutation();

DROP TRIGGER IF EXISTS prevent_edoc_audit_delete ON public.edoc_audit_events;
CREATE TRIGGER prevent_edoc_audit_delete
BEFORE DELETE ON public.edoc_audit_events
FOR EACH ROW EXECUTE FUNCTION public.edoc_prevent_audit_mutation();

CREATE OR REPLACE VIEW public.edoc_assignment_inbox AS
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
WHERE a.status IN ('active', 'pending');

CREATE OR REPLACE FUNCTION public.edoc_create_audit_event(
  p_organization_id TEXT,
  p_event_type TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_document_id TEXT DEFAULT NULL,
  p_version_id TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_previous_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id TEXT := public.edoc_current_profile_id();
  profile_name TEXT;
  event_id TEXT := gen_random_uuid()::text;
BEGIN
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT display_name INTO profile_name FROM public.profiles WHERE id = profile_id;

  INSERT INTO public.edoc_audit_events (
    id, organization_id, actor_id, actor_name, event_type, entity_type, entity_id,
    document_id, version_id, reason, previous_value, new_value, integrity_hash
  )
  VALUES (
    event_id, p_organization_id, profile_id, profile_name, p_event_type, p_entity_type, p_entity_id,
    p_document_id, p_version_id, p_reason, p_previous_value, p_new_value,
    encode(digest(event_id || p_event_type || COALESCE(p_entity_id, '') || now()::text, 'sha256'), 'hex')
  );

  RETURN event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.edoc_start_route(p_route_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  route_row public.edoc_document_routes%ROWTYPE;
  first_sequence INTEGER;
BEGIN
  SELECT * INTO route_row FROM public.edoc_document_routes WHERE id = p_route_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Route not found'; END IF;
  IF NOT public.edoc_can_access_document(route_row.document_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF route_row.status <> 'draft' THEN RAISE EXCEPTION 'Only draft routes can be started'; END IF;

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
BEGIN
  IF profile_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_action IN ('return', 'reject') AND COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  SELECT * INTO assignment_row FROM public.edoc_route_step_assignees WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
  IF assignment_row.route_id <> p_route_id THEN RAISE EXCEPTION 'Route mismatch'; END IF;
  IF assignment_row.assignee_id <> profile_id THEN RAISE EXCEPTION 'Not authorized for this assignment'; END IF;
  IF assignment_row.status <> 'active' THEN RAISE EXCEPTION 'Assignment is not active'; END IF;

  SELECT * INTO step_row FROM public.edoc_route_steps WHERE id = assignment_row.step_id FOR UPDATE;
  SELECT * INTO route_row FROM public.edoc_document_routes WHERE id = p_route_id FOR UPDATE;
  IF step_row.status <> 'active' OR route_row.status <> 'active' THEN RAISE EXCEPTION 'Route step is not active'; END IF;

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
      UPDATE public.edoc_route_steps SET status = 'completed' WHERE id = step_row.id;
      UPDATE public.edoc_route_step_assignees
      SET status = 'invalidated'
      WHERE step_id = step_row.id AND status IN ('active', 'pending');

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

  PERFORM public.edoc_create_audit_event(route_row.organization_id, p_action || '_completed', 'assignment', p_assignment_id, route_row.document_id, route_row.version_id, p_reason);

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

CREATE OR REPLACE FUNCTION public.edoc_return_document(
  p_route_id TEXT,
  p_assignment_id TEXT,
  p_reason TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.edoc_advance_route(p_route_id, p_assignment_id, 'return', p_reason, p_comment);
$$;

CREATE OR REPLACE FUNCTION public.edoc_complete_acknowledgment(
  p_route_id TEXT,
  p_assignment_id TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.edoc_advance_route(p_route_id, p_assignment_id, 'acknowledge', NULL, p_comment);
$$;

CREATE OR REPLACE FUNCTION public.edoc_create_revision(
  p_document_id TEXT,
  p_change_summary TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id TEXT := public.edoc_current_profile_id();
  doc_row public.edoc_documents%ROWTYPE;
  current_version public.edoc_document_versions%ROWTYPE;
  next_version_number INTEGER;
  next_version_id TEXT := gen_random_uuid()::text;
BEGIN
  SELECT * INTO doc_row FROM public.edoc_documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found'; END IF;
  IF doc_row.owner_id <> profile_id AND NOT public.edoc_is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF doc_row.status <> 'returned' THEN RAISE EXCEPTION 'Only returned documents can be revised'; END IF;

  SELECT * INTO current_version
  FROM public.edoc_document_versions
  WHERE document_id = p_document_id
  ORDER BY version_number DESC
  LIMIT 1;

  next_version_number := COALESCE(current_version.version_number, 0) + 1;

  UPDATE public.edoc_document_versions SET status = 'superseded' WHERE document_id = p_document_id AND status <> 'completed';
  UPDATE public.edoc_route_step_assignees SET status = 'invalidated'
  WHERE route_id IN (SELECT id FROM public.edoc_document_routes WHERE document_id = p_document_id)
    AND status IN ('pending', 'active');

  INSERT INTO public.edoc_document_versions (
    id, organization_id, document_id, version_number, status, source_version_id, change_summary, created_by
  )
  VALUES (
    next_version_id, doc_row.organization_id, p_document_id, next_version_number, 'draft', current_version.id, p_change_summary, profile_id
  );

  UPDATE public.edoc_documents
  SET status = 'preparing', current_version_number = next_version_number, updated_at = now()
  WHERE id = p_document_id;

  PERFORM public.edoc_create_audit_event(doc_row.organization_id, 'revision_uploaded', 'document_version', next_version_id, p_document_id, next_version_id, p_change_summary);

  RETURN jsonb_build_object('versionId', next_version_id, 'versionNumber', next_version_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.edoc_create_and_start_route(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id TEXT := public.edoc_current_profile_id();
  org_id TEXT;
  doc_id TEXT := gen_random_uuid()::text;
  version_id TEXT := gen_random_uuid()::text;
  route_id TEXT := gen_random_uuid()::text;
  step_json JSONB;
  assignee_id TEXT;
  step_id TEXT;
  assignment_id TEXT;
  field_json JSONB;
BEGIN
  IF profile_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT organization_id INTO org_id
  FROM public.edoc_organization_members
  WHERE edoc_organization_members.profile_id = profile_id AND status = 'active'
  LIMIT 1;

  IF org_id IS NULL THEN
    INSERT INTO public.edoc_organizations (name, slug)
    VALUES ('Default eDoc Organization', 'default-edoc')
    ON CONFLICT (slug) DO UPDATE SET updated_at = now()
    RETURNING id INTO org_id;

    INSERT INTO public.edoc_organization_members (organization_id, profile_id, membership_role)
    VALUES (org_id, profile_id, 'owner')
    ON CONFLICT (organization_id, profile_id) DO NOTHING;
  END IF;

  INSERT INTO public.edoc_documents (
    id, organization_id, owner_id, document_number, title, description,
    document_type, category, department_name, business_unit_name, confidentiality,
    priority, due_at, retention_class, tags, status
  )
  VALUES (
    doc_id, org_id, profile_id,
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
  VALUES (version_id, org_id, doc_id, 1, 'active', p_payload #>> '{file,sha256}', profile_id);

  IF p_payload ? 'file' AND p_payload->'file' IS NOT NULL THEN
    INSERT INTO public.edoc_document_files (
      organization_id, document_id, version_id, file_role, bucket_id, object_key,
      file_name, mime_type, size_bytes, sha256, created_by
    )
    VALUES (
      org_id, doc_id, version_id, 'original', 'edoc-originals',
      'organizations/' || org_id || '/documents/' || doc_id || '/versions/' || version_id || '/original/' || (p_payload #>> '{file,name}'),
      p_payload #>> '{file,name}',
      COALESCE(p_payload #>> '{file,mimeType}', 'application/pdf'),
      COALESCE((p_payload #>> '{file,sizeBytes}')::bigint, 1),
      p_payload #>> '{file,sha256}',
      profile_id
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
      assignment_id := gen_random_uuid()::text;
      INSERT INTO public.edoc_route_step_assignees (id, organization_id, route_id, step_id, assignee_id)
      VALUES (assignment_id, org_id, route_id, step_id, assignee_id);
    END LOOP;
  END LOOP;

  FOR field_json IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{fields}', '[]'::jsonb))
  LOOP
    SELECT a.id INTO assignment_id
    FROM public.edoc_route_step_assignees a
    JOIN public.edoc_route_steps s ON s.id = a.step_id
    WHERE a.route_id = route_id
    LIMIT 1;

    IF assignment_id IS NOT NULL THEN
      INSERT INTO public.edoc_signature_fields (
        organization_id, document_id, version_id, assignment_id, field_type,
        page_number, x, y, width, height, required
      )
      VALUES (
        org_id, doc_id, version_id, assignment_id, field_json->>'fieldType',
        COALESCE((field_json->>'pageNumber')::integer, 1),
        COALESCE((field_json->>'x')::numeric, 0),
        COALESCE((field_json->>'y')::numeric, 0),
        COALESCE((field_json->>'width')::numeric, 0.2),
        COALESCE((field_json->>'height')::numeric, 0.08),
        COALESCE((field_json->>'required')::boolean, true)
      );
    END IF;
  END LOOP;

  PERFORM public.edoc_create_audit_event(org_id, 'document_created', 'document', doc_id, doc_id, version_id);
  PERFORM public.edoc_start_route(route_id);

  RETURN jsonb_build_object('document_id', doc_id, 'route_id', route_id, 'version_id', version_id);
END;
$$;

ALTER TABLE public.edoc_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_document_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_document_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_routing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_document_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_route_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_route_step_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_route_step_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_signature_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_signature_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_completion_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_file_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'edoc_organization_members', 'edoc_documents', 'edoc_document_versions',
    'edoc_document_files', 'edoc_document_access_grants',
    'edoc_routing_templates', 'edoc_document_routes', 'edoc_route_steps',
    'edoc_route_step_assignees', 'edoc_route_step_actions', 'edoc_signature_fields',
    'edoc_signature_events', 'edoc_completion_certificates', 'edoc_comments',
    'edoc_notifications', 'edoc_audit_events', 'edoc_file_access_logs'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "eDoc org read" ON public.%I', table_name);
    EXECUTE format('CREATE POLICY "eDoc org read" ON public.%I FOR SELECT TO authenticated USING (organization_id IS NULL OR public.edoc_is_org_member(organization_id))', table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "eDoc organizations member read" ON public.edoc_organizations;
CREATE POLICY "eDoc organizations member read" ON public.edoc_organizations
  FOR SELECT TO authenticated
  USING (public.edoc_is_org_member(id));

DROP POLICY IF EXISTS "eDoc settings scoped read" ON public.edoc_settings;
CREATE POLICY "eDoc settings scoped read" ON public.edoc_settings
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.edoc_is_org_member(organization_id));

DROP POLICY IF EXISTS "eDoc document owner insert" ON public.edoc_documents;
CREATE POLICY "eDoc document owner insert" ON public.edoc_documents
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.edoc_current_profile_id() AND public.edoc_is_org_member(organization_id));

DROP POLICY IF EXISTS "eDoc document owner update mutable" ON public.edoc_documents;
CREATE POLICY "eDoc document owner update mutable" ON public.edoc_documents
  FOR UPDATE TO authenticated
  USING ((owner_id = public.edoc_current_profile_id() OR public.edoc_is_admin()) AND status IN ('draft', 'preparing', 'returned'))
  WITH CHECK ((owner_id = public.edoc_current_profile_id() OR public.edoc_is_admin()));

DROP POLICY IF EXISTS "eDoc assignments readable by assignee" ON public.edoc_route_step_assignees;
CREATE POLICY "eDoc assignments readable by assignee" ON public.edoc_route_step_assignees
  FOR SELECT TO authenticated
  USING (assignee_id = public.edoc_current_profile_id() OR public.edoc_is_org_member(organization_id));

DROP POLICY IF EXISTS "eDoc notifications own read" ON public.edoc_notifications;
CREATE POLICY "eDoc notifications own read" ON public.edoc_notifications
  FOR SELECT TO authenticated
  USING (recipient_id = public.edoc_current_profile_id() OR public.edoc_is_admin());

DROP POLICY IF EXISTS "eDoc storage private read" ON storage.objects;
CREATE POLICY "eDoc storage private read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('edoc-originals', 'edoc-versions', 'edoc-signed', 'edoc-attachments', 'edoc-certificates')
    AND EXISTS (
      SELECT 1 FROM public.edoc_document_files f
      WHERE f.bucket_id = storage.objects.bucket_id
        AND f.object_key = storage.objects.name
        AND public.edoc_can_access_document(f.document_id)
    )
  );

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.edoc_assignment_inbox TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_is_org_member(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_can_access_document(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_create_audit_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_start_route(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_advance_route(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_return_document(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_complete_acknowledgment(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_create_revision(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edoc_create_and_start_route(JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
