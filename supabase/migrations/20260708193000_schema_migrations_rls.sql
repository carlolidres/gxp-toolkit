-- Harden public.schema_migrations: tooling-only metadata, not a client-facing API table.
-- RLS with no policies denies anon/authenticated via PostgREST; migrations use postgres/service_role.

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.schema_migrations FROM anon;
REVOKE ALL ON TABLE public.schema_migrations FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.schema_migrations TO postgres;

NOTIFY pgrst, 'reload schema';
