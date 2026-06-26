-- Re-apply authenticated table grants (idempotent).
-- Fixes PostgREST "permission denied for table" when role grants were missing on a remote.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.routing_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registry_values TO authenticated;
GRANT SELECT, INSERT ON public.audit_events TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_menu_permissions TO authenticated;

GRANT SELECT, INSERT ON public.app_feedback_messages TO authenticated;
GRANT UPDATE (status, status_updated_by_profile_id, status_updated_by_name, status_updated_at)
  ON public.app_feedback_messages TO authenticated;

NOTIFY pgrst, 'reload schema';
