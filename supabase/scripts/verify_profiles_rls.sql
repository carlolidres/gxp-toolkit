-- Manual verification for BUG-001 profiles RLS (run as non-admin authenticated role).
-- Expect: role self-update denied; display_name self-update allowed.

-- 1) Confirm self-elevation policy is gone
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.profiles'::regclass
  AND polname IN ('Users update own profile', 'Users update own display name');

-- 2) As non-admin: attempt role escalation (should affect 0 rows or raise policy violation)
-- UPDATE public.profiles SET role = 'admin' WHERE auth_user_id = auth.uid();

-- 3) As non-admin: display_name update (should succeed)
-- UPDATE public.profiles SET display_name = display_name WHERE auth_user_id = auth.uid();

-- 4) Anon cannot execute enumeration RPC
SELECT has_function_privilege('anon', 'public.check_temporary_password_required(text)', 'EXECUTE') AS anon_can_check_temp_password;
