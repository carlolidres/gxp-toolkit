-- GxP Toolkit — per-user menu permissions (JSON grants keyed by menu id)

CREATE TABLE IF NOT EXISTS user_menu_permissions (
  user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  menu_id     TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, menu_id)
);

CREATE INDEX IF NOT EXISTS idx_user_menu_permissions_user ON user_menu_permissions(user_id);

ALTER TABLE user_menu_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage user permissions" ON user_menu_permissions;
CREATE POLICY "Admins manage user permissions" ON user_menu_permissions
  FOR ALL
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

DROP POLICY IF EXISTS "Users read own menu permissions" ON user_menu_permissions;
CREATE POLICY "Users read own menu permissions" ON user_menu_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = user_menu_permissions.user_id AND p.auth_user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON user_menu_permissions TO authenticated;
