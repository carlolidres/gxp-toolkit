-- eDoc pilot seed — local SQLite reference only (non-production fixtures).
-- Requires profiles from edoc pilot users below (or existing profiles rows).

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO profiles (id, auth_user_id, email, display_name, role, active) VALUES
  ('edoc-pilot-owner', NULL, 'edoc.owner@example.com', 'eDoc Pilot Owner', 'admin', 1),
  ('edoc-pilot-reviewer', NULL, 'edoc.reviewer@example.com', 'eDoc Pilot Reviewer', 'editor', 1),
  ('edoc-pilot-viewer', NULL, 'edoc.viewer@example.com', 'eDoc Pilot Viewer', 'viewer', 1);

INSERT OR IGNORE INTO edoc_organizations (id, name, slug, created_at, updated_at) VALUES
  ('edoc-org-pilot', 'Pilot Quality Organization', 'pilot-quality', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO edoc_organization_members (id, organization_id, profile_id, department_name, membership_role, status, counts_toward_seat, created_at) VALUES
  ('edoc-member-owner', 'edoc-org-pilot', 'edoc-pilot-owner', 'QA', 'owner', 'active', 1, '2026-07-04T00:00:00.000Z'),
  ('edoc-member-reviewer', 'edoc-org-pilot', 'edoc-pilot-reviewer', 'Validation', 'member', 'active', 0, '2026-07-04T00:00:00.000Z'),
  ('edoc-member-viewer', 'edoc-org-pilot', 'edoc-pilot-viewer', 'QC', 'member', 'active', 0, '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO edoc_documents (
  id, organization_id, owner_id, document_number, title, description, status,
  current_version_number, created_at, updated_at
) VALUES (
  'edoc-doc-pilot-001', 'edoc-org-pilot', 'edoc-pilot-owner', 'EDOC-PILOT-001',
  'Pilot SOP Routing Package', 'Local SQLite reference document for agent validation.',
  'awaiting_action', 1, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'
);

INSERT OR IGNORE INTO edoc_document_versions (
  id, organization_id, document_id, version_number, status, original_sha256, created_by, created_at
) VALUES (
  'edoc-version-pilot-001', 'edoc-org-pilot', 'edoc-doc-pilot-001', 1, 'active',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'edoc-pilot-owner', '2026-07-04T00:00:00.000Z'
);

INSERT OR IGNORE INTO edoc_document_routes (
  id, organization_id, document_id, version_id, mode, status, started_at, created_at
) VALUES (
  'edoc-route-pilot-001', 'edoc-org-pilot', 'edoc-doc-pilot-001', 'edoc-version-pilot-001',
  'sequential', 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'
);

INSERT OR IGNORE INTO edoc_route_steps (
  id, organization_id, route_id, group_id, sequence, action, completion_rule, status, created_at
) VALUES (
  'edoc-step-pilot-001', 'edoc-org-pilot', 'edoc-route-pilot-001', 'edoc-step-pilot-001',
  1, 'review', 'all', 'active', '2026-07-04T00:00:00.000Z'
);

INSERT OR IGNORE INTO edoc_route_step_assignees (
  id, organization_id, route_id, step_id, assignee_id, status, created_at
) VALUES (
  'edoc-assignment-pilot-001', 'edoc-org-pilot', 'edoc-route-pilot-001', 'edoc-step-pilot-001',
  'edoc-pilot-reviewer', 'active', '2026-07-04T00:00:00.000Z'
);

INSERT OR IGNORE INTO edoc_audit_events (
  id, organization_id, actor_id, actor_name, event_type, entity_type, entity_id,
  document_id, version_id, source, created_at
) VALUES (
  'edoc-audit-pilot-001', 'edoc-org-pilot', 'edoc-pilot-owner', 'eDoc Pilot Owner',
  'document_created', 'document', 'edoc-doc-pilot-001', 'edoc-doc-pilot-001', 'edoc-version-pilot-001',
  'seed', '2026-07-04T00:00:00.000Z'
);

-- Billing plans. Sandbox paddle_price_id recorded 2026-08-18. C8: pilot stays FREE.
INSERT OR IGNORE INTO edoc_subscription_plans (
  id, code, name, billing_interval, paddle_product_id, paddle_price_id, paymongo_plan_id,
  amount_minor, php_amount_minor, currency, is_active, created_at, updated_at
) VALUES
  ('edoc-plan-free', 'FREE', 'Free', 'none', NULL, NULL, NULL, 0, 0, 'USD', 1, '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'),
  ('edoc-plan-personal-month', 'PERSONAL_MONTHLY', 'Personal', 'month', NULL, 'pri_01m09kd9fw8tpbeyrcnsrzy4ea', NULL, 599, 19900, 'USD', 1, '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'),
  ('edoc-plan-personal-year', 'PERSONAL_ANNUAL', 'Personal', 'year', NULL, 'pri_01m09kem1734t13qt18y2xn75x', NULL, 5990, 238800, 'USD', 1, '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'),
  ('edoc-plan-pro-month', 'PRO_MONTHLY', 'Professional', 'month', NULL, 'pri_01m09kvd9rxggqb1jf49aknn4k', NULL, 1299, 49900, 'USD', 1, '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'),
  ('edoc-plan-pro-year', 'PRO_ANNUAL', 'Professional', 'year', NULL, 'pri_01m09kwn51w0ej0ptxstf5jwxx', NULL, 12990, 598800, 'USD', 1, '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'),
  ('edoc-plan-biz-month', 'BUSINESS_MONTHLY', 'Business', 'month', NULL, 'pri_01m09m0pt9rmyp7fweexttyd4b', NULL, 2999, 99900, 'USD', 1, '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'),
  ('edoc-plan-biz-year', 'BUSINESS_ANNUAL', 'Business', 'year', NULL, 'pri_01m09m1t2zg6t1pp8ppnwa1858', NULL, 29990, 1198800, 'USD', 1, '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z');

INSERT OR IGNORE INTO edoc_plan_entitlements (id, plan_id, entitlement_key, value_type, numeric_value, boolean_value, text_value) VALUES
  ('edoc-ent-free-docs', 'edoc-plan-free', 'DOCUMENTS_PER_MONTH', 'numeric', 3, NULL, NULL),
  ('edoc-ent-free-seats', 'edoc-plan-free', 'USERS_PER_ORG', 'numeric', 1, NULL, NULL),
  ('edoc-ent-per-m-docs', 'edoc-plan-personal-month', 'DOCUMENTS_PER_MONTH', 'numeric', 25, NULL, NULL),
  ('edoc-ent-per-m-seats', 'edoc-plan-personal-month', 'USERS_PER_ORG', 'numeric', 1, NULL, NULL),
  ('edoc-ent-per-y-docs', 'edoc-plan-personal-year', 'DOCUMENTS_PER_MONTH', 'numeric', 25, NULL, NULL),
  ('edoc-ent-per-y-seats', 'edoc-plan-personal-year', 'USERS_PER_ORG', 'numeric', 1, NULL, NULL),
  ('edoc-ent-pro-m-docs', 'edoc-plan-pro-month', 'DOCUMENTS_PER_MONTH', 'numeric', 100, NULL, NULL),
  ('edoc-ent-pro-m-seats', 'edoc-plan-pro-month', 'USERS_PER_ORG', 'numeric', 1, NULL, NULL),
  ('edoc-ent-pro-y-docs', 'edoc-plan-pro-year', 'DOCUMENTS_PER_MONTH', 'numeric', 100, NULL, NULL),
  ('edoc-ent-pro-y-seats', 'edoc-plan-pro-year', 'USERS_PER_ORG', 'numeric', 1, NULL, NULL),
  ('edoc-ent-biz-m-docs', 'edoc-plan-biz-month', 'DOCUMENTS_PER_MONTH', 'numeric', 300, NULL, NULL),
  ('edoc-ent-biz-m-seats', 'edoc-plan-biz-month', 'USERS_PER_ORG', 'numeric', 5, NULL, NULL),
  ('edoc-ent-biz-y-docs', 'edoc-plan-biz-year', 'DOCUMENTS_PER_MONTH', 'numeric', 300, NULL, NULL),
  ('edoc-ent-biz-y-seats', 'edoc-plan-biz-year', 'USERS_PER_ORG', 'numeric', 5, NULL, NULL);

INSERT OR IGNORE INTO edoc_subscriptions (
  id, organization_id, plan_id, provider, provider_customer_id, provider_subscription_id,
  status, current_period_start, current_period_end, scheduled_change_type, scheduled_change_at,
  cancel_at_period_end, created_at, updated_at
) VALUES (
  'edoc-sub-pilot', 'edoc-org-pilot', 'edoc-plan-free', 'paddle', NULL, NULL,
  'FREE', NULL, NULL, NULL, NULL, 0, '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'
);

INSERT OR IGNORE INTO edoc_billing_runtime (
  id, billing_enabled, free_plan_limits_enabled, paddle_checkout_enabled, paymongo_checkout_enabled, updated_at
) VALUES (
  'default', 0, 0, 0, 0, '2026-08-18T00:00:00.000Z'
);
