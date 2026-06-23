-- Link seed profiles to auth.users, fix get_own_profile RPC (STABLE + double-return),
-- and align is_vrms_admin with email-based admin access.

UPDATE public.profiles AS p
SET auth_user_id = u.id, updated_at = now()
FROM auth.users AS u
WHERE p.auth_user_id IS NULL
  AND lower(p.email) = lower(u.email);

UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE lower(email) = lower('carlolidres@gmail.com')
  AND role IS DISTINCT FROM 'admin';

CREATE OR REPLACE FUNCTION public.is_vrms_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) = lower('carlolidres@gmail.com')
    OR EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.role = 'admin'
        AND (
          p.auth_user_id = auth.uid()
          OR lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    );
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
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  resolved_email text;
  user_meta jsonb;
  display_name_value text;
  role_value text;
  profile_id text;
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  SELECT u.email, u.raw_user_meta_data
  INTO resolved_email, user_meta
  FROM auth.users AS u
  WHERE u.id = uid;

  IF resolved_email IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles AS pr
  SET auth_user_id = uid, updated_at = now()
  WHERE pr.auth_user_id IS NULL
    AND lower(pr.email) = lower(resolved_email);

  IF lower(resolved_email) = lower('carlolidres@gmail.com') THEN
    UPDATE public.profiles AS pr
    SET role = 'admin', updated_at = now()
    WHERE (pr.auth_user_id = uid OR lower(pr.email) = lower(resolved_email))
      AND pr.role IS DISTINCT FROM 'admin';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.display_name, p.role, p.active, p.auth_user_id
  FROM public.profiles AS p
  WHERE p.auth_user_id = uid
     OR lower(p.email) = lower(resolved_email)
  ORDER BY CASE WHEN p.auth_user_id = uid THEN 0 ELSE 1 END
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  profile_id := 'p-' || replace(uid::text, '-', '');
  display_name_value := COALESCE(
    NULLIF(trim(user_meta->>'display_name'), ''),
    NULLIF(trim(concat_ws(' ', user_meta->>'first_name', user_meta->>'last_name')), ''),
    split_part(resolved_email, '@', 1)
  );

  IF lower(resolved_email) = lower('carlolidres@gmail.com') THEN
    role_value := 'admin';
  ELSIF NOT EXISTS (SELECT 1 FROM public.profiles AS pr WHERE pr.role = 'admin') THEN
    role_value := 'admin';
  ELSE
    role_value := 'user';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, role, auth_user_id)
  VALUES (profile_id, resolved_email, display_name_value, role_value, uid)
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    role = CASE
      WHEN lower(EXCLUDED.email) = lower('carlolidres@gmail.com') THEN 'admin'
      ELSE public.profiles.role
    END,
    updated_at = now();

  RETURN QUERY
  SELECT p.id, p.email, p.display_name, p.role, p.active, p.auth_user_id
  FROM public.profiles AS p
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
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT p.id, p.email, p.display_name, p.role, p.active, p.auth_user_id
  FROM public.profiles AS p
  WHERE p.id = target_id
    AND (
      p.auth_user_id = auth.uid()
      OR lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      OR public.is_vrms_admin()
    );
$$;

ALTER FUNCTION public.get_own_profile() OWNER TO postgres;
ALTER FUNCTION public.get_profile_by_id(text) OWNER TO postgres;
ALTER FUNCTION public.is_vrms_admin() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_profile_by_id(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_profile_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_vrms_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_is_approved() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_vrms_new_user() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_by_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vrms_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_approved() TO authenticated;

NOTIFY pgrst, 'reload schema';
