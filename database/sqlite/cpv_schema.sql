-- CPV SQLite reference schema — Continuous Process Verification
-- SQLite-first (C16). No Supabase CPV migration until this schema is validated.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cpv_products (
  id                              TEXT PRIMARY KEY,
  product_code                    TEXT NOT NULL UNIQUE,
  product_name                    TEXT NOT NULL,
  generic_name                    TEXT,
  dosage_form                     TEXT NOT NULL,
  strength                        TEXT,
  batch_size                      TEXT,
  batch_size_unit                 TEXT,
  alternate_batch_sizes           TEXT,
  report_entries                  TEXT,
  hold_entries                    TEXT,
  cpp_monitoring                  TEXT,
  client_owner                    TEXT,
  manufacturing_site              TEXT,
  packaging_site                  TEXT,
  markets                         TEXT,
  registration_number             TEXT,
  review_frequency                TEXT NOT NULL DEFAULT 'Annual'
                                    CHECK (review_frequency IN ('Monthly', 'Quarterly', 'Semiannual', 'Annual')),
  pv_protocol_ref                 TEXT,
  pv_report_ref                   TEXT,
  effective_date                  TEXT,
  status                          TEXT NOT NULL DEFAULT 'Draft'
                                    CHECK (status IN ('Draft', 'Active', 'Retired')),
  retire_reason                   TEXT,
  proposed_posture                TEXT NOT NULL DEFAULT 'Not Assessed'
                                    CHECK (proposed_posture IN ('Not Assessed', 'Insufficient Data', 'Not Valid', 'At Risk', 'Valid')),
  official_posture                TEXT NOT NULL DEFAULT 'Not Assessed'
                                    CHECK (official_posture IN ('Not Assessed', 'Insufficient Data', 'Not Valid', 'At Risk', 'Valid')),
  official_posture_rationale      TEXT,
  official_posture_approved_by    TEXT,
  official_posture_approved_at    TEXT,
  review_period_start             TEXT,
  review_period_end               TEXT,
  next_review_due                 TEXT,
  last_assessment_at              TEXT,
  row_version                     INTEGER NOT NULL DEFAULT 1,
  created_at                      TEXT NOT NULL,
  updated_at                      TEXT NOT NULL,
  created_by                      TEXT,
  updated_by                      TEXT
);

CREATE INDEX IF NOT EXISTS idx_cpv_products_code ON cpv_products(product_code);
CREATE INDEX IF NOT EXISTS idx_cpv_products_status ON cpv_products(status);
CREATE INDEX IF NOT EXISTS idx_cpv_products_name ON cpv_products(product_name);

CREATE TABLE IF NOT EXISTS cpv_product_batches (
  id                      TEXT PRIMARY KEY,
  product_id              TEXT NOT NULL REFERENCES cpv_products(id),
  batch_number            TEXT NOT NULL,
  mo_control_number       TEXT,
  manufacturing_start_at  TEXT,
  manufacturing_end_at    TEXT,
  packaging_start_at      TEXT,
  packaging_end_at        TEXT,
  fg_release_date         TEXT,
  status                  TEXT NOT NULL DEFAULT 'Planned'
                            CHECK (status IN ('Planned', 'In Process', 'Packaged', 'Released', 'Rejected', 'Cancelled')),
  comments                TEXT,
  date_exception_reason   TEXT,
  voided                  INTEGER NOT NULL DEFAULT 0,
  void_reason             TEXT,
  row_version             INTEGER NOT NULL DEFAULT 1,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  created_by              TEXT,
  updated_by              TEXT,
  UNIQUE (product_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_cpv_batches_product ON cpv_product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_cpv_batches_fg ON cpv_product_batches(fg_release_date);
CREATE INDEX IF NOT EXISTS idx_cpv_batches_status ON cpv_product_batches(status);

CREATE TABLE IF NOT EXISTS cpv_packaging_orders (
  id                 TEXT PRIMARY KEY,
  batch_id           TEXT NOT NULL REFERENCES cpv_product_batches(id),
  po_control_number  TEXT NOT NULL,
  comments           TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (batch_id, po_control_number)
);

CREATE INDEX IF NOT EXISTS idx_cpv_po_batch ON cpv_packaging_orders(batch_id);

CREATE TABLE IF NOT EXISTS cpv_protocols (
  id                      TEXT PRIMARY KEY,
  protocol_number         TEXT NOT NULL,
  version                 INTEGER NOT NULL DEFAULT 1,
  product_id              TEXT NOT NULL REFERENCES cpv_products(id),
  title                   TEXT NOT NULL,
  review_period_start     TEXT,
  review_period_end       TEXT,
  scope                   TEXT,
  batch_selection_rule    TEXT,
  status                  TEXT NOT NULL DEFAULT 'Draft'
                            CHECK (status IN ('Draft', 'In Review', 'Pending Approval', 'Approved/Effective', 'Rejected', 'Superseded', 'Retired')),
  author_id               TEXT,
  author_name             TEXT,
  reviewer_name           TEXT,
  approver_name           TEXT,
  signoff_printed_name    TEXT,
  signoff_meaning         TEXT,
  effective_date          TEXT,
  superseded_protocol_id  TEXT REFERENCES cpv_protocols(id),
  linked_report_id        TEXT,
  objective               TEXT,
  reject_comment          TEXT,
  row_version             INTEGER NOT NULL DEFAULT 1,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  UNIQUE (protocol_number, version)
);

CREATE INDEX IF NOT EXISTS idx_cpv_protocols_product ON cpv_protocols(product_id);
CREATE INDEX IF NOT EXISTS idx_cpv_protocols_status ON cpv_protocols(status);
CREATE INDEX IF NOT EXISTS idx_cpv_protocols_number ON cpv_protocols(protocol_number);

CREATE TABLE IF NOT EXISTS cpv_reports (
  id                      TEXT PRIMARY KEY,
  report_number           TEXT NOT NULL,
  version                 INTEGER NOT NULL DEFAULT 1,
  product_id              TEXT NOT NULL REFERENCES cpv_products(id),
  protocol_id             TEXT REFERENCES cpv_protocols(id),
  review_period_start     TEXT,
  review_period_end       TEXT,
  included_batch_count    INTEGER NOT NULL DEFAULT 0,
  excluded_batch_count    INTEGER NOT NULL DEFAULT 0,
  proposed_posture        TEXT NOT NULL DEFAULT 'Not Assessed'
                            CHECK (proposed_posture IN ('Not Assessed', 'Insufficient Data', 'Not Valid', 'At Risk', 'Valid')),
  approved_posture        TEXT
                            CHECK (approved_posture IS NULL OR approved_posture IN ('Not Assessed', 'Insufficient Data', 'Not Valid', 'At Risk', 'Valid')),
  status                  TEXT NOT NULL DEFAULT 'Draft'
                            CHECK (status IN ('Draft', 'In Review', 'Pending Approval', 'Approved/Effective', 'Rejected', 'Superseded')),
  snapshot_json           TEXT,
  author_id               TEXT,
  author_name             TEXT,
  reviewer_name           TEXT,
  approver_name           TEXT,
  signoff_printed_name    TEXT,
  signoff_meaning         TEXT,
  effective_date          TEXT,
  reject_comment          TEXT,
  row_version             INTEGER NOT NULL DEFAULT 1,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  UNIQUE (report_number, version)
);

CREATE INDEX IF NOT EXISTS idx_cpv_reports_product ON cpv_reports(product_id);
CREATE INDEX IF NOT EXISTS idx_cpv_reports_protocol ON cpv_reports(protocol_id);
CREATE INDEX IF NOT EXISTS idx_cpv_reports_status ON cpv_reports(status);

CREATE TABLE IF NOT EXISTS cpv_audit_events (
  id               TEXT PRIMARY KEY,
  occurred_at      TEXT NOT NULL,
  actor_id         TEXT,
  actor_name       TEXT NOT NULL,
  actor_role       TEXT,
  action_type      TEXT NOT NULL,
  product_id       TEXT,
  batch_id         TEXT,
  module           TEXT,
  record_type      TEXT NOT NULL,
  record_id        TEXT NOT NULL,
  record_label     TEXT,
  field_name       TEXT,
  old_value        TEXT,
  new_value        TEXT,
  reason           TEXT,
  source_record_id TEXT,
  correlation_id   TEXT
);

CREATE INDEX IF NOT EXISTS idx_cpv_audit_occurred ON cpv_audit_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_cpv_audit_product ON cpv_audit_events(product_id);
CREATE INDEX IF NOT EXISTS idx_cpv_audit_record ON cpv_audit_events(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_cpv_audit_actor ON cpv_audit_events(actor_name);

-- Phase 3: batch-linked core data (C3 — usages/results reference cpv_product_batches.id)
CREATE TABLE IF NOT EXISTS cpv_material_definitions (
  id                        TEXT PRIMARY KEY,
  product_id                TEXT NOT NULL REFERENCES cpv_products(id),
  kind                      TEXT NOT NULL CHECK (kind IN ('rm', 'pm')),
  description               TEXT NOT NULL,
  item_number               TEXT NOT NULL,
  spec_number               TEXT,
  amount                    TEXT,
  unit                      TEXT,
  function_in_formulation   TEXT,
  packaging_level           TEXT CHECK (packaging_level IS NULL OR packaging_level IN ('Primary', 'Secondary', 'Tertiary')),
  approved_suppliers        TEXT,
  critical                  INTEGER NOT NULL DEFAULT 0,
  effective_from            TEXT,
  effective_to              TEXT,
  status                    TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Retired')),
  retire_reason             TEXT,
  row_version               INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_cpv_mat_def_product ON cpv_material_definitions(product_id, kind);

CREATE TABLE IF NOT EXISTS cpv_material_usages (
  id            TEXT PRIMARY KEY,
  material_id   TEXT NOT NULL REFERENCES cpv_material_definitions(id),
  batch_id      TEXT NOT NULL REFERENCES cpv_product_batches(id),
  po_id         TEXT REFERENCES cpv_packaging_orders(id),
  lot_number    TEXT NOT NULL,
  supplier      TEXT,
  quantity      TEXT,
  comments      TEXT
);
CREATE INDEX IF NOT EXISTS idx_cpv_mat_use_batch ON cpv_material_usages(batch_id);
CREATE INDEX IF NOT EXISTS idx_cpv_mat_use_material ON cpv_material_usages(material_id);

CREATE TABLE IF NOT EXISTS cpv_assets (
  id                    TEXT PRIMARY KEY,
  product_id            TEXT NOT NULL REFERENCES cpv_products(id),
  asset_type            TEXT NOT NULL CHECK (asset_type IN ('Equipment', 'Room', 'Line')),
  name                  TEXT NOT NULL,
  tag                   TEXT,
  room                  TEXT,
  line                  TEXT,
  stage                 TEXT NOT NULL CHECK (stage IN ('Manufacturing', 'Packaging')),
  parameter_name        TEXT,
  lsl                   TEXT,
  usl                   TEXT,
  unit                  TEXT,
  trend_enabled         INTEGER NOT NULL DEFAULT 0,
  qual_report           TEXT,
  qual_status           TEXT,
  requal_due            TEXT,
  cleaning_sop          TEXT,
  cleaning_val_ref      TEXT,
  cleaning_review_due   TEXT,
  facility_qual_ref     TEXT,
  facility_requal_due   TEXT,
  effective_from        TEXT,
  effective_to          TEXT,
  status                TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Retired')),
  retire_reason         TEXT
);
CREATE INDEX IF NOT EXISTS idx_cpv_assets_product ON cpv_assets(product_id, stage);

CREATE TABLE IF NOT EXISTS cpv_asset_uses (
  id                 TEXT PRIMARY KEY,
  asset_id           TEXT NOT NULL REFERENCES cpv_assets(id),
  batch_id           TEXT NOT NULL REFERENCES cpv_product_batches(id),
  used_at            TEXT NOT NULL,
  parameter_result   TEXT,
  comments           TEXT,
  window_status      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cpv_asset_use_batch ON cpv_asset_uses(batch_id);

CREATE TABLE IF NOT EXISTS cpv_test_definitions (
  id                TEXT PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES cpv_products(id),
  kind              TEXT NOT NULL CHECK (kind IN ('ipc', 'analytical')),
  name              TEXT NOT NULL,
  classification    TEXT NOT NULL CHECK (classification IN ('Bulk', 'Finished Product')),
  data_type         TEXT NOT NULL CHECK (data_type IN ('Numeric', 'Text', 'Categorical', 'Pass-Fail')),
  lsl               TEXT,
  usl               TEXT,
  target            TEXT,
  warning_low       TEXT,
  warning_high      TEXT,
  unit              TEXT,
  method_ref        TEXT,
  method_version    TEXT,
  criticality       TEXT,
  instrument_type   TEXT,
  effective_from    TEXT,
  effective_to      TEXT,
  status            TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Retired')),
  retire_reason     TEXT
);
CREATE INDEX IF NOT EXISTS idx_cpv_test_def_product ON cpv_test_definitions(product_id, kind);

CREATE TABLE IF NOT EXISTS cpv_test_results (
  id                    TEXT PRIMARY KEY,
  definition_id         TEXT NOT NULL REFERENCES cpv_test_definitions(id),
  batch_id              TEXT NOT NULL REFERENCES cpv_product_batches(id),
  result                TEXT,
  test_at               TEXT,
  sample_id             TEXT,
  report_ref            TEXT,
  instrument            TEXT,
  csv_ref               TEXT,
  investigation_link    TEXT,
  official_event        TEXT CHECK (official_event IS NULL OR official_event IN ('OOS', 'OOT')),
  not_applicable        INTEGER NOT NULL DEFAULT 0,
  na_justification      TEXT,
  comments              TEXT,
  evaluation            TEXT NOT NULL,
  spec_version_applied  TEXT
);
CREATE INDEX IF NOT EXISTS idx_cpv_test_res_batch ON cpv_test_results(batch_id);

-- Phase 4: independently created lifecycle/event modules (C20)
CREATE TABLE IF NOT EXISTS cpv_stability_studies (
  id                  TEXT PRIMARY KEY,
  product_id          TEXT NOT NULL REFERENCES cpv_products(id),
  protocol_ref        TEXT NOT NULL,
  stability_batch     TEXT NOT NULL,
  product_batch_id    TEXT REFERENCES cpv_product_batches(id),
  packaging           TEXT,
  market              TEXT,
  start_date          TEXT,
  status              TEXT NOT NULL DEFAULT 'Open'
);
CREATE INDEX IF NOT EXISTS idx_cpv_stab_product ON cpv_stability_studies(product_id);

CREATE TABLE IF NOT EXISTS cpv_stability_time_points (
  id                TEXT PRIMARY KEY,
  study_id          TEXT NOT NULL REFERENCES cpv_stability_studies(id),
  condition_label   TEXT NOT NULL,
  months            INTEGER NOT NULL,
  due_date          TEXT,
  status            TEXT NOT NULL CHECK (status IN ('Scheduled', 'Due', 'Completed', 'Missed', 'Cancelled')),
  parameter         TEXT,
  lsl               TEXT,
  usl               TEXT,
  unit              TEXT,
  result            TEXT,
  pull_date         TEXT,
  test_date         TEXT,
  method_version    TEXT
);
CREATE INDEX IF NOT EXISTS idx_cpv_stab_tp_study ON cpv_stability_time_points(study_id);

CREATE TABLE IF NOT EXISTS cpv_hold_time_requirements (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES cpv_products(id),
  transition      TEXT NOT NULL,
  min_duration    TEXT,
  max_duration    TEXT NOT NULL,
  unit            TEXT NOT NULL CHECK (unit IN ('minutes', 'hours', 'days')),
  study_ref       TEXT NOT NULL,
  effective_from  TEXT,
  status          TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Retired'))
);
CREATE INDEX IF NOT EXISTS idx_cpv_hold_req_product ON cpv_hold_time_requirements(product_id);

CREATE TABLE IF NOT EXISTS cpv_hold_time_records (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES cpv_products(id),
  requirement_id  TEXT NOT NULL REFERENCES cpv_hold_time_requirements(id),
  batch_id        TEXT REFERENCES cpv_product_batches(id),
  study_batch     TEXT,
  start_at        TEXT NOT NULL,
  end_at          TEXT NOT NULL,
  duration_hours  REAL,
  evaluation      TEXT NOT NULL CHECK (evaluation IN ('Complies', 'Excursion', 'Not Evaluated'))
);
CREATE INDEX IF NOT EXISTS idx_cpv_hold_rec_product ON cpv_hold_time_records(product_id);

CREATE TABLE IF NOT EXISTS cpv_linked_events (
  id                    TEXT PRIMARY KEY,
  product_id            TEXT NOT NULL REFERENCES cpv_products(id),
  kind                  TEXT NOT NULL CHECK (kind IN ('cnf', 'complaint', 'deviation')),
  number                TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL,
  category              TEXT,
  risk                  TEXT,
  status                TEXT NOT NULL,
  initiated_at          TEXT,
  target_at             TEXT,
  closed_at             TEXT,
  conclusion            TEXT,
  cancel_or_nfa_reason  TEXT,
  capa_ref              TEXT,
  owner                 TEXT,
  UNIQUE (product_id, kind, number)
);
CREATE INDEX IF NOT EXISTS idx_cpv_events_product ON cpv_linked_events(product_id, kind);

CREATE TABLE IF NOT EXISTS cpv_event_batch_links (
  event_id  TEXT NOT NULL REFERENCES cpv_linked_events(id),
  batch_id  TEXT NOT NULL REFERENCES cpv_product_batches(id),
  PRIMARY KEY (event_id, batch_id)
);

CREATE TABLE IF NOT EXISTS cpv_improvements (
  id            TEXT PRIMARY KEY,
  product_id    TEXT NOT NULL REFERENCES cpv_products(id),
  number        TEXT NOT NULL,
  source_ref    TEXT,
  endorsed_at   TEXT,
  summary       TEXT NOT NULL,
  owner         TEXT,
  status        TEXT NOT NULL DEFAULT 'Open',
  UNIQUE (product_id, number)
);

CREATE TABLE IF NOT EXISTS cpv_recommendations (
  id                TEXT PRIMARY KEY,
  improvement_id    TEXT NOT NULL REFERENCES cpv_improvements(id),
  sequence          INTEGER NOT NULL,
  text              TEXT NOT NULL,
  category          TEXT,
  priority          TEXT,
  owner             TEXT,
  target_at         TEXT,
  status            TEXT NOT NULL DEFAULT 'Open'
);
CREATE INDEX IF NOT EXISTS idx_cpv_reco_improvement ON cpv_recommendations(improvement_id);
