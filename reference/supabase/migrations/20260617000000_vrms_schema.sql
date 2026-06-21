-- VRMS — migrate from GxP Toolkit template schema to VRMS domain tables
-- Safe on fresh remotes: DROP TABLE IF EXISTS removes legacy template tables when present.

DROP TABLE IF EXISTS signature_requests CASCADE;
DROP TABLE IF EXISTS workflow_steps CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE IF NOT EXISTS profiles (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routing_documents (
  routing_tracker        TEXT PRIMARY KEY,
  doc_tracer             TEXT NOT NULL UNIQUE,
  equipment_product      TEXT NOT NULL,
  category               TEXT NOT NULL,
  il_tag                 TEXT,
  status                 TEXT NOT NULL,
  sent_routing_to        TEXT,
  email                  TEXT,
  date_sent              TEXT,
  report_protocol        TEXT NOT NULL,
  batch_no               TEXT NOT NULL,
  client_name            TEXT NOT NULL,
  department             TEXT NOT NULL,
  prepared_by            TEXT NOT NULL,
  date_prepared          TEXT NOT NULL,
  checked_by             TEXT NOT NULL,
  date_checked           TEXT NOT NULL,
  target_completion_date TEXT,
  remarks                TEXT,
  signatories            JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_routing_duration TEXT,
  routing_completed_at   TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by             TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS registry_values (
  id            TEXT PRIMARY KEY,
  registry_type TEXT NOT NULL,
  value         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (registry_type, value)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id              TEXT PRIMARY KEY,
  event_timestamp TIMESTAMPTZ NOT NULL,
  user_email      TEXT NOT NULL,
  action          TEXT NOT NULL,
  routing_tracker TEXT,
  doc_tracer      TEXT,
  details         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routing_documents_status ON routing_documents(status);
CREATE INDEX IF NOT EXISTS idx_routing_documents_doc_tracer ON routing_documents(doc_tracer);
CREATE INDEX IF NOT EXISTS idx_routing_documents_updated_at ON routing_documents(updated_at);
CREATE INDEX IF NOT EXISTS idx_registry_values_type ON registry_values(registry_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(event_timestamp);

INSERT INTO schema_migrations (version, description)
VALUES (2, 'VRMS routing documents, registry, and audit schema')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read profiles" ON profiles;
CREATE POLICY "Authenticated read profiles" ON profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read routing_documents" ON routing_documents;
CREATE POLICY "Authenticated read routing_documents" ON routing_documents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert routing_documents" ON routing_documents;
CREATE POLICY "Authenticated insert routing_documents" ON routing_documents
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update routing_documents" ON routing_documents;
CREATE POLICY "Authenticated update routing_documents" ON routing_documents
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read registry_values" ON registry_values;
CREATE POLICY "Authenticated read registry_values" ON registry_values
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated manage registry_values" ON registry_values;
CREATE POLICY "Authenticated manage registry_values" ON registry_values
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read audit_events" ON audit_events;
CREATE POLICY "Authenticated read audit_events" ON audit_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert audit_events" ON audit_events;
CREATE POLICY "Authenticated insert audit_events" ON audit_events
  FOR INSERT TO authenticated WITH CHECK (true);
