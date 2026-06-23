-- Re-apply profiles RLS recursion fix (idempotent).
-- Root cause: admin policies calling is_vrms_admin() without row_security = off recurse on profiles SELECT.

CREATE OR REPLACE FUNCTION public.is_vrms_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
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
SET row_security = off
AS $$
  SELECT id FROM public.profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS TABLE (
  id text,
  email text,
  display_name text,
  role text,
  active boolean,
  auth_user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  user_email text;
  user_meta jsonb;
  display_name_value text;
  role_value text;
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.display_name, p.role, p.active, p.auth_user_id
  FROM public.profiles p
  WHERE p.auth_user_id = uid
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  SELECT u.email, u.raw_user_meta_data INTO user_email, user_meta
  FROM auth.users u
  WHERE u.id = uid;

  IF user_email IS NULL THEN
    RETURN;
  END IF;

  display_name_value := COALESCE(
    NULLIF(trim(user_meta->>'display_name'), ''),
    NULLIF(trim(concat_ws(' ', user_meta->>'first_name', user_meta->>'last_name')), ''),
    split_part(user_email, '@', 1)
  );

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
    role_value := 'admin';
  ELSE
    role_value := COALESCE(NULLIF(trim(user_meta->>'role'), ''), 'user');
  END IF;

  INSERT INTO public.profiles (id, email, display_name, role, auth_user_id)
  VALUES (
    'p-' || substr(replace(uid::text, '-', ''), 1, 12),
    user_email,
    display_name_value,
    role_value,
    uid
  )
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    updated_at = now();

  RETURN QUERY
  SELECT p.id, p.email, p.display_name, p.role, p.active, p.auth_user_id
  FROM public.profiles p
  WHERE p.auth_user_id = uid
  LIMIT 1;
END;
$$;

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
    AND (p.auth_user_id = auth.uid() OR public.is_vrms_admin());
$$;

GRANT EXECUTE ON FUNCTION public.is_vrms_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_by_id(text) TO authenticated;

DROP POLICY IF EXISTS "Authenticated read profiles" ON profiles;

DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;
CREATE POLICY "Admins read all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (public.is_vrms_admin());

DROP POLICY IF EXISTS "Admins update profiles" ON profiles;
CREATE POLICY "Admins update profiles" ON profiles
  FOR UPDATE TO authenticated
  USING (public.is_vrms_admin())
  WITH CHECK (public.is_vrms_admin());

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

NOTIFY pgrst, 'reload schema';
