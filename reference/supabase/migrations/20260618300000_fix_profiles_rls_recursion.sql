-- Fix RLS infinite recursion: admin checks must not subquery profiles under RLS.

CREATE OR REPLACE FUNCTION public.is_vrms_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_vrms_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;

-- profiles
DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;
CREATE POLICY "Admins read all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (public.is_vrms_admin());

DROP POLICY IF EXISTS "Admins update profiles" ON profiles;
CREATE POLICY "Admins update profiles" ON profiles
  FOR UPDATE TO authenticated
  USING (public.is_vrms_admin())
  WITH CHECK (public.is_vrms_admin());

-- user_menu_permissions
DROP POLICY IF EXISTS "Admins manage user permissions" ON user_menu_permissions;
CREATE POLICY "Admins manage user permissions" ON user_menu_permissions
  FOR ALL TO authenticated
  USING (public.is_vrms_admin())
  WITH CHECK (public.is_vrms_admin());

DROP POLICY IF EXISTS "Admins read all user permissions" ON user_menu_permissions;
CREATE POLICY "Admins read all user permissions" ON user_menu_permissions
  FOR SELECT TO authenticated
  USING (public.is_vrms_admin());

DROP POLICY IF EXISTS "Users read own menu permissions" ON user_menu_permissions;
CREATE POLICY "Users read own menu permissions" ON user_menu_permissions
  FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
