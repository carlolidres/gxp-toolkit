-- eDoc pilot seed — local SQLite reference only (non-production fixtures).
-- Requires profiles from edoc pilot users below (or existing profiles rows).

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO profiles (id, auth_user_id, email, display_name, role, active) VALUES
  ('edoc-pilot-owner', NULL, 'edoc.owner@example.com', 'eDoc Pilot Owner', 'admin', 1),
  ('edoc-pilot-reviewer', NULL, 'edoc.reviewer@example.com', 'eDoc Pilot Reviewer', 'editor', 1),
  ('edoc-pilot-viewer', NULL, 'edoc.viewer@example.com', 'eDoc Pilot Viewer', 'viewer', 1);

INSERT OR IGNORE INTO edoc_organizations (id, name, slug, created_at, updated_at) VALUES
  ('edoc-org-pilot', 'Pilot Quality Organization', 'pilot-quality', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO edoc_organization_members (id, organization_id, profile_id, department_name, membership_role, status, created_at) VALUES
  ('edoc-member-owner', 'edoc-org-pilot', 'edoc-pilot-owner', 'QA', 'owner', 'active', '2026-07-04T00:00:00.000Z'),
  ('edoc-member-reviewer', 'edoc-org-pilot', 'edoc-pilot-reviewer', 'Validation', 'member', 'active', '2026-07-04T00:00:00.000Z'),
  ('edoc-member-viewer', 'edoc-org-pilot', 'edoc-pilot-viewer', 'QC', 'member', 'active', '2026-07-04T00:00:00.000Z');

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
