-- BUG-001: Prevent non-admin self-elevation of profiles.role / profiles.active.
-- Replaces unrestricted "Users update own profile" with display_name-only self-service.

CREATE OR REPLACE FUNCTION public.profile_self_update_allowed(
  target_id text,
  new_role text,
  new_active boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = target_id
      AND p.auth_user_id = auth.uid()
      AND new_role IS NOT DISTINCT FROM p.role
      AND new_active IS NOT DISTINCT FROM p.active
  );
$$;

ALTER FUNCTION public.profile_self_update_allowed(text, text, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.profile_self_update_allowed(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_self_update_allowed(text, text, boolean) TO authenticated;

DROP POLICY IF EXISTS "Users update own profile" ON profiles;

CREATE POLICY "Users update own display name" ON profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (
    public.profile_self_update_allowed(id, role, active)
  );

NOTIFY pgrst, 'reload schema';
