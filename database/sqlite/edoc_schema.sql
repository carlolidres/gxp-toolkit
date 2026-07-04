-- eDoc SQLite reference schema — mirrors supabase/migrations/20260704100000_edoc_supabase_module.sql
-- Tables/functions/RLS/storage live in Supabase; this file is the agent-readable local reference.

PRAGMA foreign_keys = ON;

-- Organization
CREATE TABLE IF NOT EXISTS edoc_organizations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_organization_members (
  id                  TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL REFERENCES edoc_organizations(id) ON DELETE CASCADE,
  profile_id          TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_name     TEXT,
  business_unit_name  TEXT,
  membership_role     TEXT NOT NULL DEFAULT 'member'
                        CHECK (membership_role IN ('owner', 'admin', 'controller', 'auditor', 'member')),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  created_at          TEXT NOT NULL,
  UNIQUE (organization_id, profile_id)
);

-- Documents
CREATE TABLE IF NOT EXISTS edoc_documents (
  id                      TEXT PRIMARY KEY,
  organization_id         TEXT NOT NULL REFERENCES edoc_organizations(id),
  owner_id                TEXT NOT NULL REFERENCES profiles(id),
  document_number         TEXT NOT NULL,
  title                   TEXT NOT NULL,
  description             TEXT NOT NULL DEFAULT '',
  document_type           TEXT NOT NULL DEFAULT '',
  category                TEXT NOT NULL DEFAULT '',
  department_name         TEXT NOT NULL DEFAULT '',
  business_unit_name      TEXT NOT NULL DEFAULT '',
  confidentiality         TEXT NOT NULL DEFAULT 'internal',
  priority                TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_at                  TEXT,
  retention_class         TEXT NOT NULL DEFAULT '',
  tags                    TEXT NOT NULL DEFAULT '[]',
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'preparing', 'ready_for_routing', 'in_routing', 'awaiting_action',
    'returned', 'rejected', 'completed', 'cancelled', 'expired', 'archived'
  )),
  current_version_number  INTEGER NOT NULL DEFAULT 1 CHECK (current_version_number > 0),
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  lock_version            INTEGER NOT NULL DEFAULT 0,
  UNIQUE (organization_id, document_number)
);

CREATE TABLE IF NOT EXISTS edoc_document_versions (
  id                  TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL REFERENCES edoc_organizations(id),
  document_id         TEXT NOT NULL REFERENCES edoc_documents(id) ON DELETE CASCADE,
  version_number      INTEGER NOT NULL CHECK (version_number > 0),
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'superseded', 'completed', 'void')),
  source_version_id   TEXT REFERENCES edoc_document_versions(id),
  change_summary      TEXT,
  original_sha256     TEXT,
  final_sha256        TEXT,
  created_by          TEXT NOT NULL REFERENCES profiles(id),
  created_at          TEXT NOT NULL,
  UNIQUE (document_id, version_number)
);

CREATE TABLE IF NOT EXISTS edoc_document_files (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES edoc_organizations(id),
  document_id     TEXT NOT NULL REFERENCES edoc_documents(id) ON DELETE CASCADE,
  version_id      TEXT NOT NULL REFERENCES edoc_document_versions(id) ON DELETE CASCADE,
  file_role       TEXT NOT NULL CHECK (file_role IN ('original', 'revised', 'signed', 'certificate', 'attachment')),
  bucket_id       TEXT NOT NULL,
  object_key      TEXT NOT NULL UNIQUE,
  file_name       TEXT NOT NULL,
  mime_type       TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes      INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256          TEXT,
  created_by      TEXT REFERENCES profiles(id),
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_document_access_grants (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES edoc_organizations(id),
  document_id       TEXT NOT NULL REFERENCES edoc_documents(id) ON DELETE CASCADE,
  grantee_id        TEXT NOT NULL REFERENCES profiles(id),
  permission_level  TEXT NOT NULL CHECK (permission_level IN ('view', 'comment', 'edit')),
  granted_by        TEXT NOT NULL REFERENCES profiles(id),
  expires_at        TEXT,
  created_at        TEXT NOT NULL
);

-- Routing
CREATE TABLE IF NOT EXISTS edoc_routing_templates (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES edoc_organizations(id),
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  mode            TEXT NOT NULL CHECK (mode IN ('sequential', 'parallel', 'mixed')),
  created_by      TEXT NOT NULL REFERENCES profiles(id),
  created_at      TEXT NOT NULL,
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS edoc_document_routes (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES edoc_organizations(id),
  document_id     TEXT NOT NULL REFERENCES edoc_documents(id) ON DELETE CASCADE,
  version_id      TEXT NOT NULL REFERENCES edoc_document_versions(id),
  template_id     TEXT REFERENCES edoc_routing_templates(id),
  mode            TEXT NOT NULL CHECK (mode IN ('sequential', 'parallel', 'mixed')),
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'completed', 'rejected', 'returned', 'cancelled', 'expired')),
  started_at      TEXT,
  completed_at    TEXT,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_route_steps (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES edoc_organizations(id),
  route_id        TEXT NOT NULL REFERENCES edoc_document_routes(id) ON DELETE CASCADE,
  group_id        TEXT NOT NULL,
  sequence        INTEGER NOT NULL CHECK (sequence > 0),
  action          TEXT NOT NULL CHECK (action IN ('review', 'approve', 'sign', 'acknowledge')),
  completion_rule TEXT NOT NULL DEFAULT 'all'
                    CHECK (completion_rule IN ('all', 'any', 'majority', 'minimum_count')),
  minimum_count   INTEGER,
  due_at          TEXT,
  allow_delegation INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'completed', 'rejected', 'returned', 'skipped', 'invalidated')),
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_route_step_assignees (
  id                       TEXT PRIMARY KEY,
  organization_id          TEXT NOT NULL REFERENCES edoc_organizations(id),
  route_id                 TEXT NOT NULL REFERENCES edoc_document_routes(id) ON DELETE CASCADE,
  step_id                  TEXT NOT NULL REFERENCES edoc_route_steps(id) ON DELETE CASCADE,
  assignee_id              TEXT NOT NULL REFERENCES profiles(id),
  delegated_from_profile_id TEXT REFERENCES profiles(id),
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'active', 'completed', 'rejected', 'returned', 'delegated', 'invalidated')),
  completed_at             TEXT,
  created_at               TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_route_step_actions (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES edoc_organizations(id),
  route_id        TEXT NOT NULL REFERENCES edoc_document_routes(id) ON DELETE CASCADE,
  step_id         TEXT NOT NULL REFERENCES edoc_route_steps(id) ON DELETE CASCADE,
  assignment_id   TEXT NOT NULL REFERENCES edoc_route_step_assignees(id),
  actor_id        TEXT NOT NULL REFERENCES profiles(id),
  action          TEXT NOT NULL CHECK (action IN ('review', 'approve', 'sign', 'acknowledge', 'reject', 'return', 'delegate', 'cancel')),
  status          TEXT NOT NULL CHECK (status IN ('completed', 'rejected', 'returned', 'delegated', 'cancelled')),
  comment         TEXT NOT NULL DEFAULT '',
  reason          TEXT,
  created_at      TEXT NOT NULL
);

-- Signatures
CREATE TABLE IF NOT EXISTS edoc_signature_fields (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES edoc_organizations(id),
  document_id     TEXT NOT NULL REFERENCES edoc_documents(id) ON DELETE CASCADE,
  version_id      TEXT NOT NULL REFERENCES edoc_document_versions(id) ON DELETE CASCADE,
  assignment_id   TEXT NOT NULL REFERENCES edoc_route_step_assignees(id) ON DELETE CASCADE,
  field_type      TEXT NOT NULL CHECK (field_type IN (
    'signature', 'initial', 'date_signed', 'name', 'job_title', 'text',
    'approval_meaning', 'review_meaning', 'acknowledgment', 'checkbox'
  )),
  page_number     INTEGER NOT NULL CHECK (page_number > 0),
  x               REAL NOT NULL CHECK (x >= 0 AND x <= 1),
  y               REAL NOT NULL CHECK (y >= 0 AND y <= 1),
  width           REAL NOT NULL CHECK (width > 0 AND width <= 1),
  height          REAL NOT NULL CHECK (height > 0 AND height <= 1),
  required        INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_signature_events (
  id                    TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL REFERENCES edoc_organizations(id),
  document_id           TEXT NOT NULL REFERENCES edoc_documents(id),
  version_id            TEXT NOT NULL REFERENCES edoc_document_versions(id),
  route_id              TEXT NOT NULL REFERENCES edoc_document_routes(id),
  step_id               TEXT NOT NULL REFERENCES edoc_route_steps(id),
  assignment_id         TEXT NOT NULL REFERENCES edoc_route_step_assignees(id),
  signer_id             TEXT NOT NULL REFERENCES profiles(id),
  signer_display_name   TEXT NOT NULL,
  signature_meaning     TEXT NOT NULL,
  auth_method           TEXT NOT NULL,
  auth_timestamp        TEXT NOT NULL,
  signing_timestamp     TEXT NOT NULL,
  source_ip             TEXT,
  user_agent            TEXT,
  session_id            TEXT,
  original_pdf_hash     TEXT NOT NULL,
  signed_pdf_hash       TEXT,
  integrity_hash        TEXT,
  created_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_completion_certificates (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES edoc_organizations(id),
  document_id       TEXT NOT NULL REFERENCES edoc_documents(id),
  version_id        TEXT NOT NULL REFERENCES edoc_document_versions(id),
  route_id          TEXT NOT NULL REFERENCES edoc_document_routes(id),
  bucket_id         TEXT NOT NULL DEFAULT 'edoc-certificates',
  object_key        TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL UNIQUE,
  issued_at         TEXT NOT NULL
);

-- Collaboration and compliance
CREATE TABLE IF NOT EXISTS edoc_comments (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES edoc_organizations(id),
  document_id       TEXT NOT NULL REFERENCES edoc_documents(id) ON DELETE CASCADE,
  version_id        TEXT REFERENCES edoc_document_versions(id),
  route_step_id     TEXT REFERENCES edoc_route_steps(id),
  parent_comment_id TEXT REFERENCES edoc_comments(id) ON DELETE CASCADE,
  author_id         TEXT NOT NULL REFERENCES profiles(id),
  body              TEXT NOT NULL CHECK (length(trim(body)) > 0),
  private           INTEGER NOT NULL DEFAULT 0,
  resolved_at       TEXT,
  created_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_notifications (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES edoc_organizations(id),
  recipient_id      TEXT NOT NULL REFERENCES profiles(id),
  document_id       TEXT REFERENCES edoc_documents(id) ON DELETE CASCADE,
  route_step_id     TEXT REFERENCES edoc_route_steps(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  dedupe_key        TEXT NOT NULL,
  title             TEXT NOT NULL,
  body              TEXT NOT NULL DEFAULT '',
  read_at           TEXT,
  created_at        TEXT NOT NULL,
  UNIQUE (recipient_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS edoc_audit_events (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES edoc_organizations(id),
  actor_id        TEXT REFERENCES profiles(id),
  actor_name      TEXT,
  event_type      TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT,
  document_id     TEXT REFERENCES edoc_documents(id),
  version_id      TEXT REFERENCES edoc_document_versions(id),
  previous_value  TEXT,
  new_value       TEXT,
  reason          TEXT,
  source_ip       TEXT,
  user_agent      TEXT,
  request_id      TEXT,
  source          TEXT NOT NULL DEFAULT 'app',
  integrity_hash  TEXT,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_file_access_logs (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES edoc_organizations(id),
  file_id         TEXT NOT NULL REFERENCES edoc_document_files(id),
  profile_id      TEXT NOT NULL REFERENCES profiles(id),
  access_type     TEXT NOT NULL CHECK (access_type IN ('preview', 'download')),
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_settings (
  id              TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES edoc_organizations(id),
  setting_key     TEXT NOT NULL,
  setting_value   TEXT NOT NULL DEFAULT '{}',
  updated_at      TEXT NOT NULL,
  UNIQUE (organization_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_edoc_documents_org_status ON edoc_documents (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_edoc_documents_owner ON edoc_documents (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_edoc_versions_document ON edoc_document_versions (document_id, version_number);
CREATE INDEX IF NOT EXISTS idx_edoc_routes_document ON edoc_document_routes (document_id, status);
CREATE INDEX IF NOT EXISTS idx_edoc_assignments_inbox ON edoc_route_step_assignees (assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_edoc_audit_document ON edoc_audit_events (document_id, created_at);
