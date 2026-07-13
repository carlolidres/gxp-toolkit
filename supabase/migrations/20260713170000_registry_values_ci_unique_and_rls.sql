-- Harden registry_values: case/whitespace-insensitive uniqueness + menu-aware mutate policies.
-- Does not rewrite historical routing_documents values.
-- Fails safely if preexisting case/whitespace collisions exist.

DO $$
DECLARE
  conflict_count integer;
BEGIN
  SELECT count(*) INTO conflict_count
  FROM (
    SELECT registry_type, lower(btrim(value)) AS normalized
    FROM public.registry_values
    GROUP BY registry_type, lower(btrim(value))
    HAVING count(*) > 1
  ) collisions;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      'registry_values has % case/whitespace collision group(s). Resolve duplicates before applying idx_registry_values_type_value_ci.',
      conflict_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_registry_values_type_value_ci
  ON public.registry_values (registry_type, lower(btrim(value)));

CREATE OR REPLACE FUNCTION public.has_registry_menu_action(required_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    public.is_vrms_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_menu_permissions ump
      WHERE ump.user_id = public.current_profile_id()
        AND ump.menu_id = 'registry'
        AND coalesce((ump.permissions ->> required_action)::boolean, false)
    );
$$;

REVOKE ALL ON FUNCTION public.has_registry_menu_action(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_registry_menu_action(text) TO authenticated;

DROP POLICY IF EXISTS "Authenticated manage registry_values" ON public.registry_values;

DROP POLICY IF EXISTS "Authenticated insert registry_values" ON public.registry_values;
CREATE POLICY "Authenticated insert registry_values"
  ON public.registry_values
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_registry_menu_action('create'));

DROP POLICY IF EXISTS "Authenticated update registry_values" ON public.registry_values;
CREATE POLICY "Authenticated update registry_values"
  ON public.registry_values
  FOR UPDATE
  TO authenticated
  USING (public.has_registry_menu_action('edit'))
  WITH CHECK (public.has_registry_menu_action('edit'));

DROP POLICY IF EXISTS "Authenticated delete registry_values" ON public.registry_values;
CREATE POLICY "Authenticated delete registry_values"
  ON public.registry_values
  FOR DELETE
  TO authenticated
  USING (public.has_registry_menu_action('delete'));

NOTIFY pgrst, 'reload schema';
