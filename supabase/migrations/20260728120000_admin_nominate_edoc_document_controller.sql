-- Allow app admins to nominate an eDoc Document Controller (membership_role = controller).
-- Client cannot UPDATE edoc_organization_members under existing SELECT-only RLS.

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
  v_org_id TEXT;
  v_existing_role TEXT;
  v_member_id TEXT;
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

  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id
    FROM public.edoc_organizations
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No eDoc organization exists. Seed or create an organization first.';
  END IF;

  -- Preserve org owner/admin membership roles; still treat them as nominated controllers in app UI via permissions.
  IF v_existing_role IN ('owner', 'admin') THEN
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

  RETURN is_controller;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_edoc_document_controller(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_edoc_document_controller(TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_edoc_document_controllers()
RETURNS TABLE (profile_id TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT m.profile_id
  FROM public.edoc_organization_members m
  WHERE m.status = 'active'
    AND m.membership_role = 'controller'
    AND public.current_user_is_admin();
$$;

REVOKE ALL ON FUNCTION public.admin_list_edoc_document_controllers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_edoc_document_controllers() TO authenticated;

NOTIFY pgrst, 'reload schema';
