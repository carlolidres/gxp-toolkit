-- GxP Toolkit — initial PostgreSQL schema (from database/sqlite/schema.sql)

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL CHECK (role IN ('Admin', 'Manager', 'Editor', 'Viewer')),
  initials   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  category        TEXT NOT NULL,
  owner           TEXT NOT NULL,
  owner_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  version         TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN (
    'Draft', 'For Review', 'Returned for Correction', 'For Approval',
    'Approved', 'Effective', 'Superseded', 'Obsolete', 'Archived',
    'Rejected', 'Signed', 'Partially Signed', 'Pending Signature'
  )),
  effective_date  TEXT NOT NULL,
  review_date     TEXT NOT NULL,
  expiry_date     TEXT,
  controlled_copy BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id          TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  step_order  INTEGER NOT NULL DEFAULT 0,
  role        TEXT NOT NULL CHECK (role IN (
    'Document Owner', 'Reviewer', 'Approver', 'QA', 'Admin', 'Viewer'
  )),
  assignee    TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN (
    'Pending', 'In Progress', 'Approved', 'Rejected', 'Returned'
  )),
  due_date    TEXT NOT NULL,
  comments    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signature_requests (
  id             TEXT PRIMARY KEY,
  document_id    TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_title TEXT NOT NULL,
  recipient      TEXT NOT NULL,
  role           TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN (
    'Not Started', 'Pending Signature', 'Partially Signed', 'Signed',
    'Declined', 'Expired', 'Cancelled'
  )),
  requested_at   TEXT NOT NULL,
  completed_at   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_owner_user_id ON documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_document_id ON workflow_steps(document_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_document_id ON signature_requests(document_id);

INSERT INTO schema_migrations (version, description)
VALUES (1, 'Initial GxP Toolkit template schema')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read users" ON users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read documents" ON documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read workflow_steps" ON workflow_steps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read signature_requests" ON signature_requests
  FOR SELECT TO authenticated USING (true);
