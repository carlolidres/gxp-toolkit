-- eDoc staging fixtures for disposable test accounts (@example.test).
-- Prerequisite: npm run edoc:provision-test-users
-- Run: supabase db query --linked -f supabase/scripts/seed_edoc_staging_test_accounts.sql

-- Stable test emails (see docs/edoc/STAGING_TEST_ACCOUNTS.md)
--   edoc-reviewer@example.test  — assignee / inbox smoke
--   edoc-creator@example.test   — create wizard smoke
--   edoc-outsider@example.test  — not in org (RLS + menu deny)

INSERT INTO public.edoc_organizations (id, name, slug, created_at, updated_at)
VALUES (
  'staging-edoc-org',
  'Staging Quality Organization',
  'staging-quality',
  now(), now()
)
ON CONFLICT (slug) DO UPDATE SET updated_at = now();

-- Org members: owner (admin) + test accounts only
INSERT INTO public.edoc_organization_members (id, organization_id, profile_id, department_name, membership_role, status, created_at)
SELECT 'staging-member-owner', 'staging-edoc-org', p.id, 'QA', 'owner', 'active', now()
FROM public.profiles p
WHERE lower(p.email) = lower('carlolidres@gmail.com')
ON CONFLICT (organization_id, profile_id) DO UPDATE SET status = 'active';

INSERT INTO public.edoc_organization_members (id, organization_id, profile_id, department_name, membership_role, status, created_at)
SELECT 'staging-member-reviewer', 'staging-edoc-org', p.id, 'Validation', 'member', 'active', now()
FROM public.profiles p
WHERE lower(p.email) = 'edoc-reviewer@example.test'
ON CONFLICT (organization_id, profile_id) DO UPDATE SET status = 'active';

INSERT INTO public.edoc_organization_members (id, organization_id, profile_id, department_name, membership_role, status, created_at)
SELECT 'staging-member-creator', 'staging-edoc-org', p.id, 'Production', 'member', 'active', now()
FROM public.profiles p
WHERE lower(p.email) = 'edoc-creator@example.test'
ON CONFLICT (organization_id, profile_id) DO UPDATE SET status = 'active';

-- Fixture document
INSERT INTO public.edoc_documents (
  id, organization_id, owner_id, document_number, title, description, status,
  current_version_number, created_at, updated_at
)
SELECT
  'staging-edoc-doc-001', 'staging-edoc-org', owner_p.id, 'EDOC-STAGING-001',
  'RLS Pilot Document', 'Staging test fixture — assignee is edoc-reviewer@example.test.', 'awaiting_action', 1, now(), now()
FROM public.profiles owner_p
WHERE lower(owner_p.email) = lower('carlolidres@gmail.com')
ON CONFLICT (organization_id, document_number) DO UPDATE SET updated_at = now();

INSERT INTO public.edoc_document_versions (
  id, organization_id, document_id, version_number, status, original_sha256, created_by, created_at
)
SELECT
  'staging-edoc-version-001', 'staging-edoc-org', 'staging-edoc-doc-001', 1, 'active',
  repeat('a', 64), owner_p.id, now()
FROM public.profiles owner_p
WHERE lower(owner_p.email) = lower('carlolidres@gmail.com')
ON CONFLICT (document_id, version_number) DO NOTHING;

INSERT INTO public.edoc_document_routes (
  id, organization_id, document_id, version_id, mode, status, started_at, created_at
) VALUES (
  'staging-edoc-route-001', 'staging-edoc-org', 'staging-edoc-doc-001', 'staging-edoc-version-001',
  'sequential', 'active', now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.edoc_route_steps (
  id, organization_id, route_id, group_id, sequence, action, completion_rule, status, created_at
) VALUES (
  'staging-edoc-step-001', 'staging-edoc-org', 'staging-edoc-route-001', 'staging-edoc-step-001',
  1, 'review', 'all', 'active', now()
)
ON CONFLICT (id) DO NOTHING;

-- Assignment → test reviewer (not real users)
INSERT INTO public.edoc_route_step_assignees (
  id, organization_id, route_id, step_id, assignee_id, status, created_at
)
SELECT
  'staging-edoc-assignment-001', 'staging-edoc-org', 'staging-edoc-route-001', 'staging-edoc-step-001',
  p.id, 'active', now()
FROM public.profiles p
WHERE lower(p.email) = 'edoc-reviewer@example.test'
ON CONFLICT (id) DO UPDATE SET assignee_id = EXCLUDED.assignee_id, status = 'active';

INSERT INTO public.edoc_audit_events (
  id, organization_id, actor_id, actor_name, event_type, entity_type, entity_id,
  document_id, version_id, source, created_at
)
SELECT
  'staging-edoc-audit-001', 'staging-edoc-org', owner_p.id, coalesce(owner_p.display_name, 'Admin'),
  'document_created', 'document', 'staging-edoc-doc-001', 'staging-edoc-doc-001', 'staging-edoc-version-001',
  'staging_test_seed', now()
FROM public.profiles owner_p
WHERE lower(owner_p.email) = lower('carlolidres@gmail.com')
ON CONFLICT (id) DO NOTHING;

-- Reviewer permissions
INSERT INTO public.user_menu_permissions (user_id, menu_id, permissions, updated_at)
SELECT p.id, menu_id, permissions, now()
FROM public.profiles p
CROSS JOIN (
  VALUES
    ('edoc-dashboard', '{"view":true,"export":true}'::jsonb),
    ('edoc-inbox', '{"view":true,"approve":true}'::jsonb),
    ('edoc-my-documents', '{"view":true,"create":false,"edit":false,"export":true}'::jsonb),
    ('edoc-all-documents', '{"view":true,"export":true}'::jsonb),
    ('edoc-returned', '{"view":true,"edit":false,"export":true}'::jsonb),
    ('edoc-completed', '{"view":true,"export":true}'::jsonb),
    ('edoc-reports', '{"view":true,"export":true}'::jsonb),
    ('edoc-audit', '{"view":true,"export":true}'::jsonb),
    ('edoc-create', '{"view":false,"create":false}'::jsonb),
    ('edoc-routing-templates', '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb),
    ('edoc-admin', '{"view":false,"edit":false}'::jsonb)
) AS t(menu_id, permissions)
WHERE lower(p.email) = 'edoc-reviewer@example.test'
ON CONFLICT (user_id, menu_id) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now();

-- Creator permissions
INSERT INTO public.user_menu_permissions (user_id, menu_id, permissions, updated_at)
SELECT p.id, menu_id, permissions, now()
FROM public.profiles p
CROSS JOIN (
  VALUES
    ('edoc-dashboard', '{"view":true,"export":true}'::jsonb),
    ('edoc-inbox', '{"view":true,"approve":true}'::jsonb),
    ('edoc-my-documents', '{"view":true,"create":true,"edit":true,"export":true}'::jsonb),
    ('edoc-all-documents', '{"view":true,"export":true}'::jsonb),
    ('edoc-create', '{"view":true,"create":true}'::jsonb),
    ('edoc-returned', '{"view":true,"edit":true,"export":true}'::jsonb),
    ('edoc-completed', '{"view":true,"export":true}'::jsonb),
    ('edoc-routing-templates', '{"view":true,"create":true,"edit":true,"delete":false}'::jsonb),
    ('edoc-reports', '{"view":true,"export":true}'::jsonb),
    ('edoc-audit', '{"view":true,"export":true}'::jsonb)
) AS t(menu_id, permissions)
WHERE lower(p.email) = 'edoc-creator@example.test'
ON CONFLICT (user_id, menu_id) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now();

-- Outsider: explicit eDoc deny
INSERT INTO public.user_menu_permissions (user_id, menu_id, permissions, updated_at)
SELECT p.id, menu_id, permissions, now()
FROM public.profiles p
CROSS JOIN (
  VALUES
    ('edoc-dashboard', '{"view":false,"export":false}'::jsonb),
    ('edoc-inbox', '{"view":false,"approve":false}'::jsonb),
    ('edoc-my-documents', '{"view":false,"create":false,"edit":false,"export":false}'::jsonb),
    ('edoc-all-documents', '{"view":false,"export":false}'::jsonb),
    ('edoc-create', '{"view":false,"create":false}'::jsonb)
) AS t(menu_id, permissions)
WHERE lower(p.email) = 'edoc-outsider@example.test'
ON CONFLICT (user_id, menu_id) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now();

DO $$
DECLARE
  reviewer_count integer;
  creator_count integer;
BEGIN
  SELECT count(*) INTO reviewer_count FROM public.profiles WHERE lower(email) = 'edoc-reviewer@example.test';
  SELECT count(*) INTO creator_count FROM public.profiles WHERE lower(email) = 'edoc-creator@example.test';
  IF reviewer_count = 0 OR creator_count = 0 THEN
    RAISE EXCEPTION 'Missing test profiles. Run: npm run edoc:provision-test-users';
  END IF;
  RAISE NOTICE 'Staging test account seed complete.';
END $$;
