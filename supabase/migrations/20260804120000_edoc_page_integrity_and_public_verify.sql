-- eDoc page integrity codes + public verification lookup (Phase 1).

CREATE TABLE IF NOT EXISTS public.edoc_page_integrity_codes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  document_id TEXT NOT NULL REFERENCES public.edoc_documents(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES public.edoc_document_versions(id) ON DELETE CASCADE,
  route_id TEXT NOT NULL REFERENCES public.edoc_document_routes(id) ON DELETE CASCADE,
  certificate_id TEXT NOT NULL REFERENCES public.edoc_completion_certificates(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  algorithm TEXT NOT NULL DEFAULT 'edoc-page-integrity-v1',
  page_content_sha256 TEXT NOT NULL,
  page_integrity_code TEXT NOT NULL,
  page_integrity_code_display TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (certificate_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_edoc_page_integrity_document
  ON public.edoc_page_integrity_codes (document_id, version_id);

ALTER TABLE public.edoc_page_integrity_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eDoc document accessor read page integrity" ON public.edoc_page_integrity_codes;
CREATE POLICY "eDoc document accessor read page integrity"
  ON public.edoc_page_integrity_codes
  FOR SELECT
  TO authenticated
  USING (public.edoc_can_access_document(document_id));

GRANT SELECT ON public.edoc_page_integrity_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edoc_page_integrity_codes TO service_role;

CREATE TABLE IF NOT EXISTS public.edoc_verification_lookups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  verification_code TEXT NOT NULL,
  certificate_id TEXT REFERENCES public.edoc_completion_certificates(id),
  result_status TEXT NOT NULL,
  uploaded_sha256 TEXT,
  matched BOOLEAN,
  source_ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edoc_verification_lookups_created
  ON public.edoc_verification_lookups (created_at DESC);

ALTER TABLE public.edoc_verification_lookups ENABLE ROW LEVEL SECURITY;

-- No direct client read/write; service_role + SECURITY DEFINER RPC only.
REVOKE ALL ON public.edoc_verification_lookups FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.edoc_verification_lookups TO service_role;

CREATE OR REPLACE FUNCTION public.edoc_public_verify_certificate(
  p_verification_code TEXT,
  p_uploaded_sha256 TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_code TEXT := nullif(btrim(p_verification_code), '');
  v_cert public.edoc_completion_certificates%ROWTYPE;
  v_doc public.edoc_documents%ROWTYPE;
  v_version public.edoc_document_versions%ROWTYPE;
  v_status TEXT;
  v_tone TEXT;
  v_hash_match BOOLEAN := NULL;
  v_sig_count INTEGER := 0;
  v_signers JSONB := '[]'::jsonb;
  v_upload TEXT := nullif(lower(btrim(COALESCE(p_uploaded_sha256, ''))), '');
BEGIN
  IF v_code IS NULL OR char_length(v_code) < 16 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 'Verification Failed',
      'tone', 'danger',
      'message', 'Verification identifier is missing or invalid.'
    );
  END IF;

  -- Simple abuse throttle: more than 60 lookups / 10 minutes for same code → soft fail.
  IF (
    SELECT count(*) FROM public.edoc_verification_lookups
    WHERE verification_code = v_code
      AND created_at > now() - interval '10 minutes'
  ) >= 60 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 'Verification Failed',
      'tone', 'danger',
      'message', 'Too many verification attempts. Try again later.'
    );
  END IF;

  SELECT * INTO v_cert
  FROM public.edoc_completion_certificates
  WHERE verification_code = v_code
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.edoc_verification_lookups (verification_code, result_status, uploaded_sha256, matched)
    VALUES (v_code, 'unknown', v_upload, false);

    RETURN jsonb_build_object(
      'ok', false,
      'status', 'Verification Failed',
      'tone', 'danger',
      'message', 'No finalized record matches this verification identifier.'
    );
  END IF;

  SELECT * INTO v_doc FROM public.edoc_documents WHERE id = v_cert.document_id;
  SELECT * INTO v_version FROM public.edoc_document_versions WHERE id = v_cert.version_id;

  SELECT count(*) INTO v_sig_count
  FROM public.edoc_signature_events
  WHERE route_id = v_cert.route_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'signerName', s.signer_display_name,
    'meaning', s.signature_meaning,
    'signedAt', s.signing_timestamp,
    'role', NULL
  ) ORDER BY s.signing_timestamp), '[]'::jsonb)
  INTO v_signers
  FROM public.edoc_signature_events s
  WHERE s.route_id = v_cert.route_id;

  IF v_upload IS NOT NULL AND v_cert.final_pdf_sha256 IS NOT NULL THEN
    v_hash_match := (v_upload = lower(v_cert.final_pdf_sha256));
  END IF;

  IF lower(COALESCE(v_cert.status, 'generated')) IN ('revoked') THEN
    v_status := 'Revoked';
    v_tone := 'warning';
  ELSIF lower(COALESCE(v_cert.status, 'generated')) IN ('superseded', 'expired') THEN
    v_status := initcap(lower(v_cert.status));
    v_tone := 'warning';
  ELSIF v_upload IS NOT NULL AND v_hash_match IS FALSE THEN
    v_status := 'Verification Failed';
    v_tone := 'danger';
  ELSE
    v_status := 'Authentic';
    v_tone := 'success';
  END IF;

  INSERT INTO public.edoc_verification_lookups (
    verification_code, certificate_id, result_status, uploaded_sha256, matched
  ) VALUES (
    v_code, v_cert.id, lower(replace(v_status, ' ', '_')), v_upload, v_hash_match
  );

  INSERT INTO public.edoc_audit_events (
    organization_id, event_type, entity_type, entity_id, document_id, version_id,
    actor_name, reason, new_value
  ) VALUES (
    v_cert.organization_id,
    'public_verification_lookup',
    'completion_certificate',
    v_cert.id,
    v_cert.document_id,
    v_cert.version_id,
    'Public verifier',
    'Public verification page lookup',
    jsonb_build_object(
      'status', v_status,
      'uploaded_sha256_present', v_upload IS NOT NULL,
      'hash_match', v_hash_match
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_status,
    'tone', v_tone,
    'documentTitle', COALESCE(v_doc.title, v_doc.document_number, 'Document'),
    'documentNumber', v_doc.document_number,
    'documentId', v_doc.id,
    'revision', v_version.version_number,
    'completedAt', v_cert.issued_at,
    'pageCount', v_cert.page_count,
    'contentPageCount', v_cert.content_page_count,
    'signatureCount', v_sig_count,
    'signers', v_signers,
    'certificateStatus', v_cert.status,
    'finalSha256Prefix', CASE
      WHEN v_cert.final_pdf_sha256 IS NULL THEN NULL
      ELSE left(v_cert.final_pdf_sha256, 12) || '…' || right(v_cert.final_pdf_sha256, 8)
    END,
    'finalSha256', v_cert.final_pdf_sha256,
    'uploadedHashMatch', v_hash_match,
    'message', CASE
      WHEN v_upload IS NULL THEN 'Record located. Upload the downloaded PDF to confirm the final file digest.'
      WHEN v_hash_match THEN 'Downloaded file matches the finalized system record (final SHA-256).'
      WHEN v_hash_match IS FALSE THEN 'Integrity verification failed: uploaded file digest does not match the stored final SHA-256.'
      ELSE 'Record located.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.edoc_public_verify_certificate(TEXT, TEXT) TO anon, authenticated;

COMMENT ON TABLE public.edoc_page_integrity_codes IS
  'Per-content-page integrity codes (edoc-page-integrity-v1). Distinct from final_pdf_sha256.';

COMMENT ON FUNCTION public.edoc_public_verify_certificate(TEXT, TEXT) IS
  'Public read-only certificate verification by opaque verification_code. Does not return document contents or full audit trail.';

NOTIFY pgrst, 'reload schema';
