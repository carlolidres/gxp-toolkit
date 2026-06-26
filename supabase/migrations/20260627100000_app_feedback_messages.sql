-- GxP Toolkit — user feedback / messages to administrator

CREATE TABLE IF NOT EXISTS app_feedback_messages (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sender_profile_id           TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name                 TEXT NOT NULL,
  sender_email                TEXT NOT NULL,
  category                    TEXT NOT NULL CHECK (category IN ('improvement', 'bug')),
  content                     TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  status                      TEXT NOT NULL DEFAULT 'unread'
                                CHECK (status IN ('unread', 'read', 'addressed', 'rejected')),
  submitted_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_updated_by_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  status_updated_by_name      TEXT,
  status_updated_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_feedback_messages_status ON app_feedback_messages(status);
CREATE INDEX IF NOT EXISTS idx_app_feedback_messages_sender ON app_feedback_messages(sender_profile_id);
CREATE INDEX IF NOT EXISTS idx_app_feedback_messages_submitted ON app_feedback_messages(submitted_at DESC);

ALTER TABLE app_feedback_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own feedback" ON app_feedback_messages;
CREATE POLICY "Users insert own feedback" ON app_feedback_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = app_feedback_messages.sender_profile_id
        AND p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own feedback" ON app_feedback_messages;
CREATE POLICY "Users read own feedback" ON app_feedback_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = app_feedback_messages.sender_profile_id
        AND p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins read all feedback" ON app_feedback_messages;
CREATE POLICY "Admins read all feedback" ON app_feedback_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.auth_user_id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins update feedback status" ON app_feedback_messages;
CREATE POLICY "Admins update feedback status" ON app_feedback_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.auth_user_id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.auth_user_id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.purge_expired_feedback_messages()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM app_feedback_messages
  WHERE status IN ('addressed', 'rejected')
    AND status_updated_at IS NOT NULL
    AND status_updated_at < (now() - interval '3 days');
$$;

REVOKE ALL ON FUNCTION public.purge_expired_feedback_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_feedback_messages() TO authenticated;

GRANT SELECT, INSERT ON app_feedback_messages TO authenticated;
GRANT UPDATE (status, status_updated_by_profile_id, status_updated_by_name, status_updated_at)
  ON app_feedback_messages TO authenticated;

NOTIFY pgrst, 'reload schema';
