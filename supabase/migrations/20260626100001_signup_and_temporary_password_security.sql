-- BUG-010: Public signup must not auto-assign admin when no admin profile exists.
-- BUG-008: check_temporary_password_required must not leak account state to anon callers.

CREATE OR REPLACE FUNCTION public.handle_vrms_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  profile_id text;
  display_name_value text;
  role_value text;
BEGIN
  IF NEW.email IS NULL OR trim(NEW.email) = '' THEN
    RAISE EXCEPTION 'auth user email is required for profile provisioning';
  END IF;

  profile_id := 'p-' || replace(NEW.id::text, '-', '');
  display_name_value := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(trim(concat_ws(' ',
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name'
    )), ''),
    split_part(NEW.email, '@', 1)
  );

  IF lower(NEW.email) = lower('carlolidres@gmail.com') THEN
    role_value := 'admin';
  ELSE
    role_value := 'user';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, role, auth_user_id)
  VALUES (profile_id, NEW.email, display_name_value, role_value, NEW.id)
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    role = CASE
      WHEN lower(EXCLUDED.email) = lower('carlolidres@gmail.com') THEN 'admin'
      WHEN public.profiles.role = 'admin' THEN public.profiles.role
      ELSE EXCLUDED.role
    END,
    updated_at = now();

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    UPDATE public.profiles pr
    SET
      auth_user_id = NEW.id,
      email = NEW.email,
      display_name = COALESCE(pr.display_name, display_name_value),
      role = CASE
        WHEN lower(NEW.email) = lower('carlolidres@gmail.com') THEN 'admin'
        WHEN pr.role = 'admin' THEN pr.role
        ELSE role_value
      END,
      updated_at = now()
    WHERE pr.auth_user_id = NEW.id
       OR lower(pr.email) = lower(NEW.email)
       OR pr.id = profile_id;

    IF NOT FOUND THEN
      RAISE;
    END IF;

    RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.get_own_profile();

CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS TABLE (
  id text,
  email text,
  display_name text,
  role text,
  active boolean,
  auth_user_id uuid,
  must_change_password boolean
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
  SELECT p.id, p.email, p.display_name, p.role, p.active, p.auth_user_id, p.must_change_password
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
  SELECT p.id, p.email, p.display_name, p.role, p.active, p.auth_user_id, p.must_change_password
  FROM public.profiles AS p
  WHERE p.auth_user_id = uid
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_temporary_password_required(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    (
      SELECT p.must_change_password
      FROM public.profiles AS p
      WHERE lower(p.email) = lower(trim(p_email))
        AND p.auth_user_id = auth.uid()
        AND p.active = true
      LIMIT 1
    ),
    false
  );
$$;

ALTER FUNCTION public.handle_vrms_new_user() OWNER TO postgres;
ALTER FUNCTION public.get_own_profile() OWNER TO postgres;
ALTER FUNCTION public.check_temporary_password_required(text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_temporary_password_required(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_temporary_password_required(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_temporary_password_required(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
