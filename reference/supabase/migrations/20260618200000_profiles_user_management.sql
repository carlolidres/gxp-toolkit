-- GxP Toolkit — profiles support for user management (roles, active flag, admin policies)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'editor', 'viewer', 'user'));

DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;
CREATE POLICY "Admins read all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.auth_user_id = auth.uid() AND admin_profile.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins update profiles" ON profiles;
CREATE POLICY "Admins update profiles" ON profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.auth_user_id = auth.uid() AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.auth_user_id = auth.uid() AND admin_profile.role = 'admin'
    )
  );

-- Ensure admin can read all permission rows (not only rows they manage via FOR ALL)
DROP POLICY IF EXISTS "Admins read all user permissions" ON user_menu_permissions;
CREATE POLICY "Admins read all user permissions" ON user_menu_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.auth_user_id = auth.uid() AND admin_profile.role = 'admin'
    )
  );
