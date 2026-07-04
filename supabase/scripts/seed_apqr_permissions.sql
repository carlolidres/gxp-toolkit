-- APQR menu permissions for pilot users.
-- Run after: supabase db push (APQR migrations) and npm run apqr:seed-supabase
--   supabase db query --linked -f supabase/scripts/seed_apqr_permissions.sql

-- Admin / owner: full APQR access
INSERT INTO public.user_menu_permissions (user_id, menu_id, permissions, updated_at)
SELECT p.id, menu_id, permissions, now()
FROM public.profiles p
CROSS JOIN (
  VALUES
    ('apqr-dashboard', '{"view":true,"export":true}'::jsonb),
    ('apqr-registry', '{"view":true,"create":true,"edit":true,"delete":true}'::jsonb),
    ('apqr-scheduler', '{"view":true,"create":true,"edit":true,"delete":true}'::jsonb),
    ('apqr-database', '{"view":true,"export":true}'::jsonb),
    ('apqr-form', '{"view":true,"create":true,"edit":true}'::jsonb),
    ('apqr-audit', '{"view":true,"export":true}'::jsonb)
) AS t(menu_id, permissions)
WHERE lower(p.email) = lower('carlolidres@gmail.com')
   OR p.role = 'Admin'
ON CONFLICT (user_id, menu_id) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now();

-- eDoc staging creator also gets APQR editor access for pilot smoke
INSERT INTO public.user_menu_permissions (user_id, menu_id, permissions, updated_at)
SELECT p.id, menu_id, permissions, now()
FROM public.profiles p
CROSS JOIN (
  VALUES
    ('apqr-dashboard', '{"view":true,"export":true}'::jsonb),
    ('apqr-registry', '{"view":true,"create":true,"edit":true,"delete":false}'::jsonb),
    ('apqr-scheduler', '{"view":true,"create":true,"edit":true,"delete":false}'::jsonb),
    ('apqr-database', '{"view":true,"export":true}'::jsonb),
    ('apqr-form', '{"view":true,"create":true,"edit":true}'::jsonb),
    ('apqr-audit', '{"view":true,"export":true}'::jsonb)
) AS t(menu_id, permissions)
WHERE lower(p.email) = 'edoc-creator@example.test'
ON CONFLICT (user_id, menu_id) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now();

DO $$ BEGIN RAISE NOTICE 'APQR menu permissions seeded.'; END $$;
