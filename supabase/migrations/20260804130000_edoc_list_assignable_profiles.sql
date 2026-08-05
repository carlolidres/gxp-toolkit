-- eDoc assignee directory: profiles RLS is own-row (or admin), so a direct
-- SELECT from profiles cannot populate the signatory picker for non-admins.
-- Return active peers who share an eDoc organization with the caller.

CREATE OR REPLACE FUNCTION public.edoc_list_assignable_profiles()
RETURNS TABLE (
  id TEXT,
  display_name TEXT,
  email TEXT,
  organization TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_profile_id TEXT := public.edoc_current_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    p.id,
    p.display_name,
    p.email,
    p.organization
  FROM public.edoc_organization_members me
  JOIN public.edoc_organization_members peer
    ON peer.organization_id = me.organization_id
   AND peer.status = 'active'
  JOIN public.profiles p
    ON p.id = peer.profile_id
  WHERE me.profile_id = v_profile_id
    AND me.status = 'active'
    AND p.active = true
  ORDER BY p.display_name;

  IF FOUND THEN
    RETURN;
  END IF;

  -- Caller has no org membership yet — still expose self so the picker is usable.
  RETURN QUERY
  SELECT p.id, p.display_name, p.email, p.organization
  FROM public.profiles p
  WHERE p.id = v_profile_id
    AND p.active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.edoc_list_assignable_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edoc_list_assignable_profiles() TO authenticated;

NOTIFY pgrst, 'reload schema';
