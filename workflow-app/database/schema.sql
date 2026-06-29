PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workflow_records (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL CHECK (
    record_type IN (
      'baseline',
      'planning',
      'execution',
      'review',
      'deployment',
      'maintenance'
    )
  ),
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'Draft',
      'For Review',
      'Approved',
      'In Progress',
      'Needs Revision',
      'Rejected',
      'Completed',
      'Deployed',
      'Under Maintenance',
      'Superseded'
    )
  ),
  current_version_id INTEGER,
  submitter TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (current_version_id) REFERENCES workflow_versions(id)
);

CREATE TABLE IF NOT EXISTS workflow_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'Draft',
      'For Review',
      'Approved',
      'In Progress',
      'Needs Revision',
      'Rejected',
      'Completed',
      'Deployed',
      'Under Maintenance',
      'Superseded'
    )
  ),
  payload_json TEXT NOT NULL,
  submitter TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (record_id) REFERENCES workflow_records(id) ON DELETE CASCADE,
  UNIQUE (record_id, version_number)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  version_id INTEGER,
  author TEXT NOT NULL,
  comment_type TEXT NOT NULL CHECK (
    comment_type IN ('Comment', 'Revision Request', 'Decision Note', 'Bug', 'Maintenance')
  ),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (record_id) REFERENCES workflow_records(id) ON DELETE CASCADE,
  FOREIGN KEY (version_id) REFERENCES workflow_versions(id)
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  version_id INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK (
    decision IN ('Approved', 'Needs Revision', 'Rejected', 'Completed', 'Deployed', 'Superseded')
  ),
  approver TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (record_id) REFERENCES workflow_records(id) ON DELETE CASCADE,
  FOREIGN KEY (version_id) REFERENCES workflow_versions(id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  record_id TEXT,
  version_id INTEGER,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (record_id) REFERENCES workflow_records(id) ON DELETE SET NULL,
  FOREIGN KEY (version_id) REFERENCES workflow_versions(id)
);

CREATE TABLE IF NOT EXISTS baseline_snapshots (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  version_id INTEGER NOT NULL,
  snapshot_number INTEGER NOT NULL,
  generated_markdown_path TEXT NOT NULL,
  backup_path TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  change_summary TEXT NOT NULL DEFAULT '',
  restored_from_snapshot_id TEXT,
  created_at TEXT NOT NULL,
  restored_at TEXT,
  restored_by TEXT,
  FOREIGN KEY (record_id) REFERENCES workflow_records(id) ON DELETE CASCADE,
  FOREIGN KEY (version_id) REFERENCES workflow_versions(id),
  FOREIGN KEY (restored_from_snapshot_id) REFERENCES baseline_snapshots(id),
  UNIQUE (snapshot_number)
);

CREATE TABLE IF NOT EXISTS handoff_entries (
  id TEXT PRIMARY KEY,
  reference_id TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL CHECK (phase IN ('feedback', 'bug')),
  title TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  original_text TEXT NOT NULL DEFAULT '',
  ai_instruction TEXT NOT NULL DEFAULT '',
  compact_instruction TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium',
  source_page TEXT NOT NULL DEFAULT '',
  baseline_snapshot_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'accepted',
      'in_progress',
      'completed',
      'rejected',
      'needs_clarification'
    )
  ),
  content_hash TEXT NOT NULL DEFAULT '',
  submitter TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (baseline_snapshot_id) REFERENCES baseline_snapshots(id)
);

CREATE TABLE IF NOT EXISTS selected_elements (
  id TEXT PRIMARY KEY,
  handoff_entry_id TEXT NOT NULL,
  route TEXT NOT NULL DEFAULT '',
  element_type TEXT NOT NULL DEFAULT '',
  visible_text TEXT NOT NULL DEFAULT '',
  selector TEXT NOT NULL DEFAULT '',
  attributes_json TEXT NOT NULL DEFAULT '{}',
  component_name TEXT NOT NULL DEFAULT '',
  parent_context TEXT NOT NULL DEFAULT '',
  dimensions TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (handoff_entry_id) REFERENCES handoff_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  handoff_entry_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  annotation TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (handoff_entry_id) REFERENCES handoff_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_handoff_entries_phase_status
ON handoff_entries(phase, status);

CREATE INDEX IF NOT EXISTS idx_handoff_entries_hash
ON handoff_entries(content_hash);

CREATE INDEX IF NOT EXISTS idx_selected_elements_entry
ON selected_elements(handoff_entry_id);

CREATE INDEX IF NOT EXISTS idx_attachments_entry
ON attachments(handoff_entry_id);

CREATE INDEX IF NOT EXISTS idx_workflow_records_type_status
ON workflow_records(record_type, status);

CREATE INDEX IF NOT EXISTS idx_workflow_versions_record
ON workflow_versions(record_id, version_number);

CREATE INDEX IF NOT EXISTS idx_comments_record
ON comments(record_id, created_at);

CREATE INDEX IF NOT EXISTS idx_approvals_record
ON approvals(record_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_record
ON audit_events(record_id, created_at);

CREATE TRIGGER IF NOT EXISTS prevent_workflow_versions_update
BEFORE UPDATE ON workflow_versions
BEGIN
  SELECT RAISE(ABORT, 'workflow_versions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS prevent_workflow_versions_delete
BEFORE DELETE ON workflow_versions
BEGIN
  SELECT RAISE(ABORT, 'workflow_versions cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS prevent_audit_events_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS prevent_audit_events_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events cannot be deleted');
END;

CREATE TABLE IF NOT EXISTS project_briefs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Project Brief',
  description TEXT NOT NULL DEFAULT '',
  workflow_notes TEXT NOT NULL DEFAULT '',
  features_notes TEXT NOT NULL DEFAULT '',
  additional_instructions TEXT NOT NULL DEFAULT '',
  ai_structured_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'converted')),
  baseline_record_id TEXT,
  content_hash TEXT NOT NULL DEFAULT '',
  submitter TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (baseline_record_id) REFERENCES workflow_records(id)
);

CREATE TABLE IF NOT EXISTS reference_attachments (
  id TEXT PRIMARY KEY,
  parent_type TEXT NOT NULL CHECK (parent_type IN ('brief', 'handoff')),
  parent_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  filename TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  annotation TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_briefs_updated
ON project_briefs(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_reference_attachments_parent
ON reference_attachments(parent_type, parent_id);

CREATE INDEX IF NOT EXISTS idx_reference_attachments_hash
ON reference_attachments(content_hash);
