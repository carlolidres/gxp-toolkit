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
  -- C7: assignees added for RLS must stay 0. Owner/admin/controller typically 1.
  counts_toward_seat  INTEGER NOT NULL DEFAULT 0 CHECK (counts_toward_seat IN (0, 1)),
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
  transaction_id  TEXT NOT NULL UNIQUE,
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
  step_kind       TEXT NOT NULL DEFAULT 'signatory'
                    CHECK (step_kind IN ('signatory', 'external_auth')),
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
  rotation        REAL NOT NULL DEFAULT 0,
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
  signer_email          TEXT,
  signer_organization   TEXT,
  signature_meaning     TEXT NOT NULL,
  signature_appearance_type TEXT,
  display_timezone      TEXT,
  field_ids             TEXT,
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
  route_id          TEXT NOT NULL UNIQUE REFERENCES edoc_document_routes(id),
  bucket_id         TEXT NOT NULL DEFAULT 'edoc-certificates',
  object_key        TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL UNIQUE,
  final_pdf_sha256  TEXT,
  page_count        INTEGER,
  status            TEXT NOT NULL DEFAULT 'generated',
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

CREATE TABLE IF NOT EXISTS edoc_page_integrity_codes (
  id                          TEXT PRIMARY KEY,
  organization_id             TEXT NOT NULL REFERENCES edoc_organizations(id),
  document_id                 TEXT NOT NULL REFERENCES edoc_documents(id) ON DELETE CASCADE,
  version_id                  TEXT NOT NULL REFERENCES edoc_document_versions(id) ON DELETE CASCADE,
  route_id                    TEXT NOT NULL REFERENCES edoc_document_routes(id) ON DELETE CASCADE,
  certificate_id              TEXT NOT NULL REFERENCES edoc_completion_certificates(id) ON DELETE CASCADE,
  page_number                 INTEGER NOT NULL CHECK (page_number > 0),
  algorithm                   TEXT NOT NULL DEFAULT 'edoc-page-integrity-v1',
  page_content_sha256         TEXT NOT NULL,
  page_integrity_code         TEXT NOT NULL,
  page_integrity_code_display TEXT NOT NULL,
  created_at                  TEXT NOT NULL,
  UNIQUE (certificate_id, page_number)
);

CREATE TABLE IF NOT EXISTS edoc_verification_lookups (
  id                 TEXT PRIMARY KEY,
  verification_code  TEXT NOT NULL,
  certificate_id     TEXT REFERENCES edoc_completion_certificates(id),
  result_status      TEXT NOT NULL,
  uploaded_sha256    TEXT,
  matched            INTEGER,
  source_ip          TEXT,
  user_agent         TEXT,
  created_at         TEXT NOT NULL
);

-- Billing (Paddle) — SQLite-first; Supabase migration only after db:map + verify:edoc-sqlite.
-- C1: these tables must never be used to delete signed-document evidence.

CREATE TABLE IF NOT EXISTS edoc_subscription_plans (
  id                 TEXT PRIMARY KEY,
  code               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  billing_interval   TEXT NOT NULL CHECK (billing_interval IN ('none', 'month', 'year')),
  paddle_product_id  TEXT,
  paddle_price_id    TEXT,
  paymongo_plan_id   TEXT,
  amount_minor       INTEGER,
  php_amount_minor   INTEGER,
  currency           TEXT NOT NULL DEFAULT 'USD',
  is_active          INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_plan_entitlements (
  id               TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES edoc_subscription_plans(id) ON DELETE CASCADE,
  entitlement_key  TEXT NOT NULL,
  value_type       TEXT NOT NULL CHECK (value_type IN ('numeric', 'boolean', 'text')),
  numeric_value    INTEGER,
  boolean_value    INTEGER CHECK (boolean_value IN (0, 1)),
  text_value       TEXT,
  UNIQUE (plan_id, entitlement_key)
);

CREATE TABLE IF NOT EXISTS edoc_billing_customers (
  id                    TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL UNIQUE REFERENCES edoc_organizations(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL DEFAULT 'paddle',
  provider_customer_id  TEXT NOT NULL UNIQUE,
  email                 TEXT,
  country_code          TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_subscriptions (
  id                         TEXT PRIMARY KEY,
  organization_id            TEXT NOT NULL REFERENCES edoc_organizations(id) ON DELETE CASCADE,
  plan_id                    TEXT NOT NULL REFERENCES edoc_subscription_plans(id),
  provider                   TEXT NOT NULL DEFAULT 'paddle',
  provider_customer_id       TEXT,
  provider_subscription_id   TEXT UNIQUE,
  status                     TEXT NOT NULL CHECK (status IN (
                               'FREE', 'PENDING', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED', 'EXPIRED'
                             )),
  current_period_start       TEXT,
  current_period_end         TEXT,
  scheduled_change_type      TEXT,
  scheduled_change_at        TEXT,
  cancel_at_period_end       INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0, 1)),
  created_at                 TEXT NOT NULL,
  updated_at                 TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_usage_counters (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES edoc_organizations(id) ON DELETE CASCADE,
  metric_key       TEXT NOT NULL,
  period_start     TEXT NOT NULL,
  period_end       TEXT NOT NULL,
  used_quantity    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (organization_id, metric_key, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS edoc_billing_events (
  id                  TEXT PRIMARY KEY,
  provider            TEXT NOT NULL DEFAULT 'paddle',
  provider_event_id   TEXT NOT NULL,
  event_type          TEXT NOT NULL,
  received_at         TEXT NOT NULL,
  processed_at        TEXT,
  processing_status   TEXT NOT NULL CHECK (processing_status IN (
                        'RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED'
                      )),
  payload_json        TEXT NOT NULL DEFAULT '{}',
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS edoc_billing_transactions (
  id                       TEXT PRIMARY KEY,
  organization_id          TEXT NOT NULL REFERENCES edoc_organizations(id),
  provider                 TEXT NOT NULL DEFAULT 'paddle',
  provider_transaction_id  TEXT NOT NULL UNIQUE,
  amount_minor             INTEGER,
  currency                 TEXT,
  status                   TEXT,
  occurred_at              TEXT NOT NULL,
  created_at               TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edoc_subscriptions_org ON edoc_subscriptions (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edoc_subscriptions_provider_sub
  ON edoc_subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_edoc_billing_events_status ON edoc_billing_events (processing_status, received_at);
CREATE INDEX IF NOT EXISTS idx_edoc_usage_org_metric ON edoc_usage_counters (organization_id, metric_key);

-- Server-side limit switch (Postgres reads this; VITE_* flags are display-only).
CREATE TABLE IF NOT EXISTS edoc_billing_runtime (
  id                         TEXT PRIMARY KEY CHECK (id = 'default'),
  billing_enabled            INTEGER NOT NULL DEFAULT 0 CHECK (billing_enabled IN (0, 1)),
  free_plan_limits_enabled   INTEGER NOT NULL DEFAULT 0 CHECK (free_plan_limits_enabled IN (0, 1)),
  paddle_checkout_enabled    INTEGER NOT NULL DEFAULT 0 CHECK (paddle_checkout_enabled IN (0, 1)),
  paymongo_checkout_enabled  INTEGER NOT NULL DEFAULT 0 CHECK (paymongo_checkout_enabled IN (0, 1)),
  updated_at                 TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edoc_billing_reconcile_runs (
  id                   TEXT PRIMARY KEY,
  started_at           TEXT NOT NULL,
  finished_at          TEXT,
  status               TEXT NOT NULL CHECK (status IN ('SKIPPED', 'OK', 'ERROR')),
  checked_count        INTEGER NOT NULL DEFAULT 0,
  mismatch_count       INTEGER NOT NULL DEFAULT 0,
  repaired_count       INTEGER NOT NULL DEFAULT 0,
  failed_event_count   INTEGER NOT NULL DEFAULT 0,
  past_due_count       INTEGER NOT NULL DEFAULT 0,
  summary_json         TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_edoc_documents_org_status ON edoc_documents (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_edoc_documents_owner ON edoc_documents (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_edoc_versions_document ON edoc_document_versions (document_id, version_number);
CREATE INDEX IF NOT EXISTS idx_edoc_routes_document ON edoc_document_routes (document_id, status);
CREATE INDEX IF NOT EXISTS idx_edoc_assignments_inbox ON edoc_route_step_assignees (assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_edoc_audit_document ON edoc_audit_events (document_id, created_at);
