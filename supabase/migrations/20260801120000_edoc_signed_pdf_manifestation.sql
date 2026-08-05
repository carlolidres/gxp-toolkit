-- Signed PDF manifestation + completion history support.

ALTER TABLE public.edoc_document_routes
  ADD COLUMN IF NOT EXISTS transaction_id TEXT;

UPDATE public.edoc_document_routes
SET transaction_id = id
WHERE transaction_id IS NULL OR btrim(transaction_id) = '';

ALTER TABLE public.edoc_document_routes
  ALTER COLUMN transaction_id SET DEFAULT gen_random_uuid()::text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'edoc_document_routes_transaction_id_key'
  ) THEN
    ALTER TABLE public.edoc_document_routes
      ADD CONSTRAINT edoc_document_routes_transaction_id_key UNIQUE (transaction_id);
  END IF;
END $$;

ALTER TABLE public.edoc_signature_events
  ADD COLUMN IF NOT EXISTS signer_email TEXT,
  ADD COLUMN IF NOT EXISTS signer_organization TEXT,
  ADD COLUMN IF NOT EXISTS signature_appearance_type TEXT,
  ADD COLUMN IF NOT EXISTS display_timezone TEXT,
  ADD COLUMN IF NOT EXISTS field_ids TEXT[];

ALTER TABLE public.edoc_completion_certificates
  ADD COLUMN IF NOT EXISTS final_pdf_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'generated';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'edoc_completion_certificates_route_id_key'
  ) THEN
    ALTER TABLE public.edoc_completion_certificates
      ADD CONSTRAINT edoc_completion_certificates_route_id_key UNIQUE (route_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
