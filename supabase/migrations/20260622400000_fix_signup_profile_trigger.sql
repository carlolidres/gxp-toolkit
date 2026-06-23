-- Fix signup 500: auth.users trigger must bypass profiles RLS on INSERT.
-- The 25P02 "transaction is aborted" log line is a follow-on error; the first error
-- in the same session (earlier session_line_num) is the root cause — usually profile INSERT failure.

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
  ELSIF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
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
    -- ponytail: recover when generated profile id collides (legacy short ids) but email is new
    UPDATE public.profiles
    SET
      auth_user_id = NEW.id,
      email = NEW.email,
      display_name = COALESCE(display_name, display_name_value),
      role = CASE
        WHEN lower(NEW.email) = lower('carlolidres@gmail.com') THEN 'admin'
        WHEN role = 'admin' THEN role
        ELSE role_value
      END,
      updated_at = now()
    WHERE auth_user_id = NEW.id
       OR lower(email) = lower(NEW.email)
       OR id = profile_id;

    IF NOT FOUND THEN
      RAISE;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_vrms_new_user() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_auth_user_created_vrms ON auth.users;
CREATE TRIGGER on_auth_user_created_vrms
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_vrms_new_user();

GRANT USAGE ON SCHEMA public TO postgres, service_role, supabase_auth_admin;
GRANT INSERT, UPDATE, SELECT ON TABLE public.profiles TO postgres, service_role;

NOTIFY pgrst, 'reload schema';
