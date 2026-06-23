-- Run in Supabase SQL Editor after applying signup fix migrations.

-- 1) Only VRMS trigger should remain on auth.users (no eDocs on_auth_user_created)
SELECT
  t.tgname AS trigger_name,
  p.proname AS function_name,
  t.tgenabled AS enabled
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'auth.users'::regclass
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 2) Legacy eDocs function must be gone
SELECT EXISTS (
  SELECT 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
) AS edocs_handle_new_user_still_exists;

-- 3) VRMS signup function settings
SELECT
  p.proname AS function_name,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  (
    SELECT string_agg(opt, ', ')
    FROM unnest(p.proconfig) AS opt
  ) AS function_settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('handle_vrms_new_user', 'get_own_profile');

-- 4) Table grants (informational)
SELECT
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND grantee IN ('postgres', 'service_role', 'authenticated', 'supabase_auth_admin')
GROUP BY grantee
ORDER BY grantee;
