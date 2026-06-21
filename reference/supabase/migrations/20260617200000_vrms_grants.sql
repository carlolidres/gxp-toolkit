-- VRMS — grant table access to authenticated role (fixes "permission denied for table profiles")

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE ON profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE ON routing_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON registry_values TO authenticated;
GRANT SELECT, INSERT ON audit_events TO authenticated;
