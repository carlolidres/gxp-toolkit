-- One-time migration: legacy APQR-YYYY-NNNN -> 4-char mixed-case alphanumeric (e.g. aB12)
-- Idempotent: skips rows that are not legacy format.

CREATE OR REPLACE FUNCTION public.apqr_random_short_id()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_upper CONSTANT TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  v_lower CONSTANT TEXT := 'abcdefghijklmnopqrstuvwxyz';
  v_all CONSTANT TEXT := v_upper || v_lower || '0123456789';
  v_chars TEXT[] := ARRAY[]::TEXT[];
  v_i INTEGER;
  v_j INTEGER;
  v_tmp TEXT;
BEGIN
  v_chars := ARRAY[
    substr(v_upper, 1 + floor(random() * 26)::INT, 1),
    substr(v_lower, 1 + floor(random() * 26)::INT, 1),
    substr(v_all, 1 + floor(random() * length(v_all))::INT, 1),
    substr(v_all, 1 + floor(random() * length(v_all))::INT, 1)
  ];

  FOR v_i IN REVERSE 4..2 LOOP
    v_j := 1 + floor(random() * v_i)::INT;
    v_tmp := v_chars[v_i];
    v_chars[v_i] := v_chars[v_j];
    v_chars[v_j] := v_tmp;
  END LOOP;

  RETURN v_chars[1] || v_chars[2] || v_chars[3] || v_chars[4];
END;
$$;

CREATE OR REPLACE FUNCTION public.apqr_next_id(p_year INTEGER DEFAULT EXTRACT(YEAR FROM now())::INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id TEXT;
  v_try INTEGER := 0;
BEGIN
  PERFORM p_year;

  LOOP
    v_try := v_try + 1;
    IF v_try > 100 THEN
      RAISE EXCEPTION 'Failed to generate unique APQR ID';
    END IF;

    v_id := public.apqr_random_short_id();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.apqr_scheduler_entries WHERE apqr_id = v_id);
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apqr_random_short_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apqr_next_id(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apqr_next_id(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.apqr_migrate_legacy_ids()
RETURNS TABLE (
  migrated_scheduler_entry_id TEXT,
  legacy_apqr_id TEXT,
  short_apqr_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_new_id TEXT;
  v_try INTEGER;
  v_migrated INTEGER := 0;
BEGIN
  DROP TABLE IF EXISTS apqr_id_migration_map;
  CREATE TEMP TABLE apqr_id_migration_map (
    entry_id TEXT PRIMARY KEY,
    legacy_apqr_id TEXT NOT NULL,
    short_apqr_id TEXT NOT NULL UNIQUE
  ) ON COMMIT DROP;

  FOR r IN
    SELECT s.id, s.apqr_id AS old_id
    FROM public.apqr_scheduler_entries AS s
    WHERE s.apqr_id ~ '^APQR-[0-9]{4}-[0-9]+$'
    ORDER BY s.apqr_id
  LOOP
    v_try := 0;
    LOOP
      v_try := v_try + 1;
      IF v_try > 100 THEN
        RAISE EXCEPTION 'Failed to generate replacement ID for %', r.old_id;
      END IF;

      v_new_id := public.apqr_random_short_id();
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.apqr_scheduler_entries AS se
        WHERE se.apqr_id = v_new_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM apqr_id_migration_map AS mm
        WHERE mm.short_apqr_id = v_new_id
      );
    END LOOP;

    INSERT INTO apqr_id_migration_map (entry_id, legacy_apqr_id, short_apqr_id)
    VALUES (r.id, r.old_id, v_new_id);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM apqr_id_migration_map) THEN
    RETURN;
  END IF;

  UPDATE public.apqr_scheduler_entries AS s
  SET
    apqr_id = m.short_apqr_id,
    updated_at = now()
  FROM apqr_id_migration_map AS m
  WHERE s.id = m.entry_id;

  GET DIAGNOSTICS v_migrated = ROW_COUNT;

  UPDATE public.apqr_reminder_log AS rl
  SET apqr_id = m.short_apqr_id
  FROM apqr_id_migration_map AS m
  WHERE rl.apqr_id = m.legacy_apqr_id;

  FOR r IN SELECT * FROM apqr_id_migration_map LOOP
    UPDATE public.apqr_audit_events AS ae
    SET entity_label = r.short_apqr_id
    WHERE ae.entity_label = r.legacy_apqr_id;

    UPDATE public.apqr_audit_events AS ae
    SET description = replace(ae.description, r.legacy_apqr_id, r.short_apqr_id)
    WHERE position(r.legacy_apqr_id in ae.description) > 0;

    UPDATE public.apqr_audit_events AS ae
    SET old_value = r.short_apqr_id
    WHERE ae.old_value = r.legacy_apqr_id;

    UPDATE public.apqr_audit_events AS ae
    SET new_value = r.short_apqr_id
    WHERE ae.new_value = r.legacy_apqr_id;
  END LOOP;

  INSERT INTO public.apqr_audit_events (
    id,
    entity_type,
    entity_id,
    entity_label,
    field_name,
    old_value,
    new_value,
    action_type,
    description,
    reason,
    performed_by,
    performed_by_name,
    performed_at
  )
  VALUES (
    gen_random_uuid()::text,
    'system',
    'apqr-id-migration',
    'APQR ID migration',
    'apqr_id',
    'APQR-YYYY-NNNN',
    '4-char alphanumeric',
    'migrated',
    format(
      'Migrated %s legacy APQR ID(s) to 4-character mixed-case alphanumeric format.',
      v_migrated
    ),
    'One-time schema/data migration 20260705223000',
    NULL,
    'System migration',
    now()
  );

  RETURN QUERY
  SELECT m.entry_id, m.legacy_apqr_id, m.short_apqr_id
  FROM apqr_id_migration_map AS m
  ORDER BY m.legacy_apqr_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apqr_migrate_legacy_ids() FROM PUBLIC;

SELECT migrated_scheduler_entry_id, legacy_apqr_id, short_apqr_id
FROM public.apqr_migrate_legacy_ids();
