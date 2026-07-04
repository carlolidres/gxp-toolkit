-- Seed staging eDoc pilot org, fixtures, and menu permissions.
-- DEPRECATED for browser smoke — used real user profiles. Prefer:
--   docs/edoc/STAGING_TEST_ACCOUNTS.md
--   seed_edoc_staging_test_accounts.sql + revert_edoc_real_user_pilot.sql
-- Run: supabase db query --linked -f supabase/scripts/seed_edoc_pilot.sql
-- Idempotent — safe to re-run.

-- Historical pilot profiles (do not use for Phase 4 browser / Playwright):
-- Owner:   p-1 / carlolidres@gmail.com
-- Assignee: p-b85dfe2d0c914195a795a15544cbf619 / ghinogabriel@gmail.com
-- Outsider: p-06c0e143ac4c42d4ba90e531180118a1 / isaiah014290118@gmail.com (NOT in org — for RLS tests)
-- Creator: p-8aafbf25f88640ba8e81e1c822edd722 / mmbuen@pharmaindustries.com

INSERT INTO public.edoc_organizations (id, name, slug, created_at, updated_at)
VALUES (
  'staging-edoc-org',
  'Staging Quality Organization',
  'staging-quality',
  now(), now()
)
ON CONFLICT (slug) DO UPDATE SET updated_at = now();

INSERT INTO public.edoc_organization_members (id, organization_id, profile_id, department_name, membership_role, status, created_at)
VALUES
  ('staging-member-owner', 'staging-edoc-org', 'p-1', 'QA', 'owner', 'active', now()),
  ('staging-member-reviewer', 'staging-edoc-org', 'p-b85dfe2d0c914195a795a15544cbf619', 'Validation', 'member', 'active', now()),
  ('staging-member-creator', 'staging-edoc-org', 'p-8aafbf25f88640ba8e81e1c822edd722', 'Production', 'member', 'active', now())
ON CONFLICT (organization_id, profile_id) DO UPDATE SET status = 'active';

-- RLS test fixture: document + active assignment for Ghino
INSERT INTO public.edoc_documents (
  id, organization_id, owner_id, document_number, title, description, status,
  current_version_number, created_at, updated_at
) VALUES (
  'staging-edoc-doc-001', 'staging-edoc-org', 'p-1', 'EDOC-STAGING-001',
  'RLS Pilot Document', 'Phase 3 manual RLS test fixture.', 'awaiting_action', 1, now(), now()
)
ON CONFLICT (organization_id, document_number) DO UPDATE SET updated_at = now();

INSERT INTO public.edoc_document_versions (
  id, organization_id, document_id, version_number, status, original_sha256, created_by, created_at
) VALUES (
  'staging-edoc-version-001', 'staging-edoc-org', 'staging-edoc-doc-001', 1, 'active',
  repeat('a', 64), 'p-1', now()
)
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

INSERT INTO public.edoc_route_step_assignees (
  id, organization_id, route_id, step_id, assignee_id, status, created_at
) VALUES (
  'staging-edoc-assignment-001', 'staging-edoc-org', 'staging-edoc-route-001', 'staging-edoc-step-001',
  'p-b85dfe2d0c914195a795a15544cbf619', 'active', now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.edoc_audit_events (
  id, organization_id, actor_id, actor_name, event_type, entity_type, entity_id,
  document_id, version_id, source, created_at
) VALUES (
  'staging-edoc-audit-001', 'staging-edoc-org', 'p-1', 'Carlo Lidres',
  'document_created', 'document', 'staging-edoc-doc-001', 'staging-edoc-doc-001', 'staging-edoc-version-001',
  'pilot_seed', now()
)
ON CONFLICT (id) DO NOTHING;

-- eDoc menu permissions: Ghino (reviewer / assignee pilot)
INSERT INTO public.user_menu_permissions (user_id, menu_id, permissions, updated_at)
VALUES
  ('p-b85dfe2d0c914195a795a15544cbf619', 'edoc-dashboard', '{"view":true,"export":true}'::jsonb, now()),
  ('p-b85dfe2d0c914195a795a15544cbf619', 'edoc-inbox', '{"view":true,"approve":true}'::jsonb, now()),
  ('p-b85dfe2d0c914195a795a15544cbf619', 'edoc-my-documents', '{"view":true,"create":false,"edit":false,"export":true}'::jsonb, now()),
  ('p-b85dfe2d0c914195a795a15544cbf619', 'edoc-all-documents', '{"view":true,"export":true}'::jsonb, now()),
  ('p-b85dfe2d0c914195a795a15544cbf619', 'edoc-returned', '{"view":true,"edit":false,"export":true}'::jsonb, now()),
  ('p-b85dfe2d0c914195a795a15544cbf619', 'edoc-completed', '{"view":true,"export":true}'::jsonb, now()),
  ('p-b85dfe2d0c914195a795a15544cbf619', 'edoc-reports', '{"view":true,"export":true}'::jsonb, now()),
  ('p-b85dfe2d0c914195a795a15544cbf619', 'edoc-audit', '{"view":true,"export":true}'::jsonb, now())
ON CONFLICT (user_id, menu_id) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now();

-- eDoc menu permissions: Michael Buen (creator pilot)
INSERT INTO public.user_menu_permissions (user_id, menu_id, permissions, updated_at)
VALUES
  ('p-8aafbf25f88640ba8e81e1c822edd722', 'edoc-dashboard', '{"view":true,"export":true}'::jsonb, now()),
  ('p-8aafbf25f88640ba8e81e1c822edd722', 'edoc-inbox', '{"view":true,"approve":true}'::jsonb, now()),
  ('p-8aafbf25f88640ba8e81e1c822edd722', 'edoc-my-documents', '{"view":true,"create":true,"edit":true,"export":true}'::jsonb, now()),
  ('p-8aafbf25f88640ba8e81e1c822edd722', 'edoc-all-documents', '{"view":true,"export":true}'::jsonb, now()),
  ('p-8aafbf25f88640ba8e81e1c822edd722', 'edoc-create', '{"view":true,"create":true}'::jsonb, now()),
  ('p-8aafbf25f88640ba8e81e1c822edd722', 'edoc-returned', '{"view":true,"edit":true,"export":true}'::jsonb, now()),
  ('p-8aafbf25f88640ba8e81e1c822edd722', 'edoc-completed', '{"view":true,"export":true}'::jsonb, now()),
  ('p-8aafbf25f88640ba8e81e1c822edd722', 'edoc-routing-templates', '{"view":true,"create":true,"edit":true,"delete":false}'::jsonb, now()),
  ('p-8aafbf25f88640ba8e81e1c822edd722', 'edoc-reports', '{"view":true,"export":true}'::jsonb, now()),
  ('p-8aafbf25f88640ba8e81e1c822edd722', 'edoc-audit', '{"view":true,"export":true}'::jsonb, now())
ON CONFLICT (user_id, menu_id) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now();

-- Isaiah: explicit deny on eDoc menus (outsider + no UI access for clean RLS/UI test)
INSERT INTO public.user_menu_permissions (user_id, menu_id, permissions, updated_at)
SELECT 'p-06c0e143ac4c42d4ba90e531180118a1', menu_id, permissions, now()
FROM (
  VALUES
    ('edoc-dashboard', '{"view":false,"export":false}'::jsonb),
    ('edoc-inbox', '{"view":false,"approve":false}'::jsonb),
    ('edoc-my-documents', '{"view":false,"create":false,"edit":false,"export":false}'::jsonb),
    ('edoc-all-documents', '{"view":false,"export":false}'::jsonb),
    ('edoc-create', '{"view":false,"create":false}'::jsonb)
) AS t(menu_id, permissions)
ON CONFLICT (user_id, menu_id) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now();
