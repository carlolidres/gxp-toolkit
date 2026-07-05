-- APQR IDs: 4-character mixed-case alphanumeric (e.g. aB12)

CREATE OR REPLACE FUNCTION public.apqr_next_id(p_year INTEGER DEFAULT EXTRACT(YEAR FROM now())::INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id TEXT;
  v_try INTEGER := 0;
  v_upper CONSTANT TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  v_lower CONSTANT TEXT := 'abcdefghijklmnopqrstuvwxyz';
  v_all CONSTANT TEXT := v_upper || v_lower || '0123456789';
  v_chars TEXT[] := ARRAY[]::TEXT[];
  v_i INTEGER;
  v_j INTEGER;
  v_tmp TEXT;
BEGIN
  -- p_year retained for RPC compatibility; cycle year is tracked on scheduler rows.
  PERFORM p_year;

  LOOP
    v_try := v_try + 1;
    IF v_try > 100 THEN
      RAISE EXCEPTION 'Failed to generate unique APQR ID';
    END IF;

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

    v_id := v_chars[1] || v_chars[2] || v_chars[3] || v_chars[4];

    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.apqr_scheduler_entries WHERE apqr_id = v_id);
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apqr_next_id(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apqr_next_id(INTEGER) TO authenticated;
