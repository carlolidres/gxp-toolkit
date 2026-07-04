-- Re-apply authenticated table grants (idempotent).
-- Fixes PostgREST "permission denied for table" when role grants were missing on a remote.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.routing_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registry_values TO authenticated;
GRANT SELECT, INSERT ON public.audit_events TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_menu_permissions TO authenticated;

-- app_feedback_messages grants are applied in 20260627100000_app_feedback_messages.sql

NOTIFY pgrst, 'reload schema';
