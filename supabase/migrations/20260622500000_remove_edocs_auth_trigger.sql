-- Remove legacy eDocs auth trigger (references missing public.roles) and fix email ambiguity.
-- Live project had on_auth_user_created -> handle_new_user() from eDocs schema alongside VRMS trigger.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

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
  profile_id text;
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
    UPDATE public.profiles pr
    SET role = 'admin', updated_at = now()
    WHERE pr.auth_user_id = uid
      AND lower(pr.email) = lower('carlolidres@gmail.com')
      AND pr.role IS DISTINCT FROM 'admin';

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

  profile_id := 'p-' || replace(uid::text, '-', '');
  display_name_value := COALESCE(
    NULLIF(trim(user_meta->>'display_name'), ''),
    NULLIF(trim(concat_ws(' ', user_meta->>'first_name', user_meta->>'last_name')), ''),
    split_part(user_email, '@', 1)
  );

  IF lower(user_email) = lower('carlolidres@gmail.com') THEN
    role_value := 'admin';
  ELSIF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.role = 'admin') THEN
    role_value := 'admin';
  ELSE
    role_value := 'user';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, role, auth_user_id)
  VALUES (profile_id, user_email, display_name_value, role_value, uid)
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
  ELSIF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.role = 'admin') THEN
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

ALTER FUNCTION public.handle_vrms_new_user() OWNER TO postgres;
ALTER FUNCTION public.get_own_profile() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_auth_user_created_vrms ON auth.users;
CREATE TRIGGER on_auth_user_created_vrms
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_vrms_new_user();

GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;

NOTIFY pgrst, 'reload schema';
