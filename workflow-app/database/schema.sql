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
  restored_from_snapshot_id TEXT,
  created_at TEXT NOT NULL,
  restored_at TEXT,
  restored_by TEXT,
  FOREIGN KEY (record_id) REFERENCES workflow_records(id) ON DELETE CASCADE,
  FOREIGN KEY (version_id) REFERENCES workflow_versions(id),
  FOREIGN KEY (restored_from_snapshot_id) REFERENCES baseline_snapshots(id),
  UNIQUE (snapshot_number)
);

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
