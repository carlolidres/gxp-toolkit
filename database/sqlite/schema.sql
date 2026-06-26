-- SQLite schema — GxP Toolkit (navigation source; production uses Supabase migrations)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  auth_user_id  TEXT,
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer',
  active        INTEGER NOT NULL DEFAULT 1
);

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
