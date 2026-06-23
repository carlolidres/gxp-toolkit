-- Assign designated owner administrator and prefer email/password auth policy.

UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE lower(email) = lower('carlolidres@gmail.com');

DROP FUNCTION IF EXISTS public.get_own_profile();

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
    UPDATE public.profiles
    SET role = 'admin', updated_at = now()
    WHERE auth_user_id = uid
      AND lower(email) = lower('carlolidres@gmail.com')
      AND role IS DISTINCT FROM 'admin';

    RETURN QUERY
    SELECT p.id, p.email, p.display_name, p.role, p.active, p.auth_user_id
    FROM public.profiles p
    WHERE p.auth_user_id = uid
    LIMIT 1;
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

  IF lower(user_email) = lower('carlolidres@gmail.com') THEN
    role_value := 'admin';
  ELSIF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
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
    role = CASE
      WHEN lower(EXCLUDED.email) = lower('carlolidres@gmail.com') THEN 'admin'
      ELSE public.profiles.role
    END,
    updated_at = now();

  RETURN QUERY
  SELECT p.id, p.email, p.display_name, p.role, p.active, p.auth_user_id
  FROM public.profiles p
  WHERE p.auth_user_id = uid
  LIMIT 1;
END;
$$;

NOTIFY pgrst, 'reload schema';
