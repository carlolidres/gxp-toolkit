-- Auth signup profile trigger: first/last name display names and admin bootstrap

CREATE OR REPLACE FUNCTION public.handle_vrms_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display_name_value text;
  role_value text;
BEGIN
  display_name_value := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(trim(concat_ws(' ',
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name'
    )), ''),
    split_part(NEW.email, '@', 1)
  );

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
    role_value := 'admin';
  ELSE
    role_value := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'user');
  END IF;

  INSERT INTO public.profiles (id, email, display_name, role, auth_user_id)
  VALUES (
    'p-' || substr(replace(NEW.id::text, '-', ''), 1, 12),
    NEW.email,
    display_name_value,
    role_value,
    NEW.id
  )
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- ponytail: bootstrap one admin when none exists yet (helps OAuth-first deployments)
UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE auth_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin')
  AND id = (
    SELECT id FROM public.profiles
    WHERE auth_user_id IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 1
  );
