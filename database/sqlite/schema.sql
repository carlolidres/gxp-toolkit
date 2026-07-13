-- SQLite schema — GxP Toolkit (navigation source; production uses Supabase migrations)
-- eDoc tables: database/sqlite/edoc_schema.sql (included by npm run db:map and db:init)
-- APQR tables: database/sqlite/apqr_schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id                            TEXT PRIMARY KEY,
  auth_user_id                  TEXT,
  email                         TEXT NOT NULL,
  display_name                  TEXT NOT NULL,
  role                          TEXT NOT NULL DEFAULT 'viewer',
  active                        INTEGER NOT NULL DEFAULT 1,
  must_change_password          INTEGER NOT NULL DEFAULT 0,
  password_reset_at             TEXT,
  password_reset_by             TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  password_reset_requested_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_profiles_password_reset_requested_at
  ON profiles(password_reset_requested_at)
  WHERE password_reset_requested_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS app_feedback_messages (
  id                           TEXT PRIMARY KEY,
  sender_profile_id            TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name                  TEXT NOT NULL,
  sender_email                 TEXT NOT NULL,
  category                     TEXT NOT NULL CHECK (category IN ('improvement', 'bug')),
  content                      TEXT NOT NULL,
  status                       TEXT NOT NULL DEFAULT 'unread'
                                 CHECK (status IN ('unread', 'read', 'addressed', 'rejected')),
  submitted_at                 TEXT NOT NULL,
  status_updated_by_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  status_updated_by_name       TEXT,
  status_updated_at            TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_feedback_messages_status ON app_feedback_messages(status);
CREATE INDEX IF NOT EXISTS idx_app_feedback_messages_sender ON app_feedback_messages(sender_profile_id);

CREATE TABLE IF NOT EXISTS vmp_masterlist_records (
  id                    TEXT PRIMARY KEY,
  record_id             TEXT NOT NULL UNIQUE,
  validation_area       TEXT NOT NULL,
  site_plant            TEXT NOT NULL,
  department            TEXT NOT NULL,
  group_name            TEXT NOT NULL,
  room_line             TEXT,
  item_name             TEXT NOT NULL,
  asset_tag_no          TEXT,
  protocol_tracer       TEXT,
  report_tracer         TEXT,
  report_approval_date  TEXT,
  review_frequency      TEXT,
  next_due_date         TEXT,
  validation_status     TEXT NOT NULL,
  lifecycle_status      TEXT NOT NULL,
  criticality           TEXT NOT NULL,
  responsible_owner     TEXT,
  remarks               TEXT,
  is_draft              INTEGER NOT NULL DEFAULT 0,
  is_archived           INTEGER NOT NULL DEFAULT 0,
  version               INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL,
  created_by            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  updated_by            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vmp_masterlist_record_id ON vmp_masterlist_records(record_id);
CREATE INDEX IF NOT EXISTS idx_vmp_masterlist_validation_area ON vmp_masterlist_records(validation_area);
CREATE INDEX IF NOT EXISTS idx_vmp_masterlist_next_due_date ON vmp_masterlist_records(next_due_date);
CREATE INDEX IF NOT EXISTS idx_vmp_masterlist_is_archived ON vmp_masterlist_records(is_archived);
CREATE INDEX IF NOT EXISTS idx_vmp_masterlist_is_draft ON vmp_masterlist_records(is_draft);

CREATE TABLE IF NOT EXISTS vmp_field_options (
  id                    TEXT PRIMARY KEY,
  field_type            TEXT NOT NULL CHECK (field_type IN ('site_plant', 'group', 'department', 'room_line')),
  validation_area       TEXT,
  site_id               TEXT,
  department_id         TEXT,
  parent_option_id      TEXT,
  display_value         TEXT NOT NULL,
  normalized_value      TEXT NOT NULL,
  display_order         INTEGER NOT NULL DEFAULT 0,
  is_system_default     INTEGER NOT NULL DEFAULT 0,
  is_user_defined       INTEGER NOT NULL DEFAULT 0,
  is_active             INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL,
  created_by            TEXT,
  updated_at            TEXT,
  updated_by            TEXT,
  FOREIGN KEY (parent_option_id) REFERENCES vmp_field_options(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_vmp_field_options_lookup
  ON vmp_field_options(field_type, validation_area, site_id, department_id, is_active);

CREATE TABLE IF NOT EXISTS vmp_qc_instruments (
  id                    TEXT PRIMARY KEY,
  masterlist_record_id  TEXT NOT NULL REFERENCES vmp_masterlist_records(id) ON DELETE CASCADE,
  instrument_name       TEXT NOT NULL,
  display_order         INTEGER NOT NULL DEFAULT 0,
  is_active             INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL,
  created_by            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  updated_by            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vmp_qc_instruments_record
  ON vmp_qc_instruments(masterlist_record_id, is_active);

-- VRMS reusable dropdown suggestions (mirrors public.registry_values on Supabase).
-- Stored routing documents keep their own text values; deleting a suggestion does not rewrite history.
CREATE TABLE IF NOT EXISTS registry_values (
  id            TEXT PRIMARY KEY,
  registry_type TEXT NOT NULL,
  value         TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (registry_type, value)
);

CREATE INDEX IF NOT EXISTS idx_registry_values_type ON registry_values(registry_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_registry_values_type_value_ci
  ON registry_values(registry_type, lower(trim(value)));

