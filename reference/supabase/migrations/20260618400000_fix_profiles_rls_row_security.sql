-- Stop RLS recursion: helper functions must bypass row security on profiles.

ALTER FUNCTION public.is_vrms_admin() SET row_security = off;
ALTER FUNCTION public.current_profile_id() SET row_security = off;

-- Legacy policy (USING true) is redundant and can interact badly with admin checks.
DROP POLICY IF EXISTS "Authenticated read profiles" ON profiles;

CREATE OR REPLACE FUNCTION public.get_profile_by_id(target_id text)
RETURNS TABLE (
  id text,
  email text,
  display_name text,
  role text,
  active boolean,
  auth_user_id uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT p.id, p.email, p.display_name, p.role, p.active, p.auth_user_id
  FROM public.profiles p
  WHERE p.id = target_id
    AND (
      p.auth_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles a
        WHERE a.auth_user_id = auth.uid() AND a.role = 'admin'
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_by_id(text) TO authenticated;
