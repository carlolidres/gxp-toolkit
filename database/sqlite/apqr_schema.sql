-- APQR SQLite reference schema — mirrors supabase/migrations/*_apqr_module.sql
-- Annual Product Quality Review: clients, scheduler, records, follow-ups, audit.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS apqr_clients (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  account_manager TEXT NOT NULL,
  client_name     TEXT NOT NULL,
  qa              TEXT,
  technical       TEXT,
  regulatory      TEXT,
  apqr_package    TEXT NOT NULL DEFAULT 'Billable'
                    CHECK (apqr_package IN ('Billable', 'Not Billable')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  created_by      TEXT,
  updated_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_apqr_clients_code ON apqr_clients(code);
CREATE INDEX IF NOT EXISTS idx_apqr_clients_name ON apqr_clients(client_name);
CREATE INDEX IF NOT EXISTS idx_apqr_clients_status ON apqr_clients(status);

CREATE TABLE IF NOT EXISTS apqr_scheduler_entries (
  id                                TEXT PRIMARY KEY,
  apqr_id                           TEXT NOT NULL UNIQUE,
  client_id                         TEXT NOT NULL REFERENCES apqr_clients(id),
  stability_pull_out_date           TEXT,
  product_name                      TEXT NOT NULL,
  product_code                      TEXT NOT NULL,
  review_coverage_start             TEXT NOT NULL,
  review_coverage_end               TEXT NOT NULL,
  review_coverage_adjustment_reason TEXT,
  commitment_schedule               TEXT NOT NULL,
  commitment_schedule_status        TEXT NOT NULL DEFAULT 'Planned'
                                      CHECK (commitment_schedule_status IN ('Planned', 'For Client Approval', 'Client Approved')),
  schedule_status_date              TEXT,
  stability_pull_out_adjustment_reason TEXT,
  is_active                         INTEGER NOT NULL DEFAULT 1,
  archived_at                       TEXT,
  archive_reason                    TEXT,
  created_at                        TEXT NOT NULL,
  updated_at                        TEXT NOT NULL,
  created_by                        TEXT,
  updated_by                        TEXT,
  UNIQUE (client_id, product_code, review_coverage_start, review_coverage_end)
);

CREATE INDEX IF NOT EXISTS idx_apqr_scheduler_client ON apqr_scheduler_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_apqr_scheduler_apqr_id ON apqr_scheduler_entries(apqr_id);
CREATE INDEX IF NOT EXISTS idx_apqr_scheduler_active ON apqr_scheduler_entries(is_active);
CREATE INDEX IF NOT EXISTS idx_apqr_scheduler_commitment ON apqr_scheduler_entries(commitment_schedule);

CREATE TABLE IF NOT EXISTS apqr_records (
  id                                  TEXT PRIMARY KEY,
  scheduler_entry_id                  TEXT NOT NULL UNIQUE REFERENCES apqr_scheduler_entries(id) ON DELETE CASCADE,
  department                          TEXT,
  stability_tabulation_status         TEXT
                                        CHECK (stability_tabulation_status IS NULL OR stability_tabulation_status IN (
                                          'No Ongoing Stability', 'Not Sent', 'Sent'
                                        )),
  stability_tabulation_status_date    TEXT,
  no_ongoing_stability_justification TEXT,
  billing_reference_number            TEXT,
  apqr_report_status                  TEXT
                                        CHECK (apqr_report_status IS NULL OR apqr_report_status IN (
                                          'Draft Sent', 'For Client Approval', 'Client Approved'
                                        )),
  sent_by                             TEXT,
  date_sent                           TEXT,
  apr_reference_number                TEXT UNIQUE,
  number_of_batches                   INTEGER,
  zero_batch_explanation              TEXT,
  date_client_signed                  TEXT,
  final_apqr_delivery_date            TEXT,
  delivery_classification             TEXT
                                        CHECK (delivery_classification IS NULL OR delivery_classification IN (
                                          'Delivered On Time', 'Delivered Overdue', 'Currently Overdue and Undelivered'
                                        )),
  days_early_or_overdue               INTEGER,
  delay_category                      TEXT,
  delay_reason                        TEXT,
  delay_reason_change_note            TEXT,
  expected_final_delivery_date        TEXT,
  remarks                             TEXT,
  next_follow_up_due_date             TEXT,
  record_status                       TEXT NOT NULL DEFAULT 'active' CHECK (record_status IN ('active', 'archived')),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL,
  updated_by                          TEXT
);

CREATE INDEX IF NOT EXISTS idx_apqr_records_scheduler ON apqr_records(scheduler_entry_id);
CREATE INDEX IF NOT EXISTS idx_apqr_records_apr_ref ON apqr_records(apr_reference_number);

CREATE TABLE IF NOT EXISTS apqr_follow_ups (
  id                TEXT PRIMARY KEY,
  record_id         TEXT NOT NULL REFERENCES apqr_records(id) ON DELETE CASCADE,
  follow_up_date    TEXT NOT NULL,
  follow_up_remarks TEXT NOT NULL,
  recorded_by       TEXT NOT NULL,
  recorded_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_apqr_follow_ups_record ON apqr_follow_ups(record_id);

CREATE TABLE IF NOT EXISTS apqr_audit_events (
  id                 TEXT PRIMARY KEY,
  entity_type        TEXT NOT NULL,
  entity_id          TEXT NOT NULL,
  entity_label       TEXT,
  field_name         TEXT,
  old_value          TEXT,
  new_value          TEXT,
  action_type        TEXT NOT NULL,
  description        TEXT NOT NULL,
  reason             TEXT,
  performed_by       TEXT,
  performed_by_name  TEXT NOT NULL,
  performed_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_apqr_audit_entity ON apqr_audit_events(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS apqr_id_sequences (
  year        INTEGER NOT NULL PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
