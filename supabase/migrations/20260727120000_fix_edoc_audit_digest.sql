-- Fix: edoc_create_audit_event uses digest() but search_path is public-only.
-- On Supabase, pgcrypto lives in the extensions schema, so unqualified digest()
-- resolves as digest(text, unknown) and fails.

CREATE OR REPLACE FUNCTION public.edoc_create_audit_event(
  p_organization_id TEXT,
  p_event_type TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_document_id TEXT DEFAULT NULL,
  p_version_id TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_previous_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_profile_id TEXT := public.edoc_current_profile_id();
  v_profile_name TEXT;
  v_event_id TEXT := gen_random_uuid()::text;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT display_name INTO v_profile_name
  FROM public.profiles
  WHERE profiles.id = v_profile_id;

  INSERT INTO public.edoc_audit_events (
    id, organization_id, actor_id, actor_name, event_type, entity_type, entity_id,
    document_id, version_id, reason, previous_value, new_value, integrity_hash
  )
  VALUES (
    v_event_id, p_organization_id, v_profile_id, v_profile_name, p_event_type, p_entity_type, p_entity_id,
    p_document_id, p_version_id, p_reason, p_previous_value, p_new_value,
    encode(
      extensions.digest(
        v_event_id || p_event_type || COALESCE(p_entity_id, '') || now()::text,
        'sha256'::text
      ),
      'hex'
    )
  );

  RETURN v_event_id;
END;
$$;
