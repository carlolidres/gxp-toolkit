-- Track how many signed-content pages precede the appended Final Audit Report.
ALTER TABLE public.edoc_completion_certificates
  ADD COLUMN IF NOT EXISTS content_page_count INTEGER;

COMMENT ON COLUMN public.edoc_completion_certificates.content_page_count IS
  'Page count of the signed PDF before completion-history pages were appended.';

-- Backfill known staging certificate (1 content page + 2 history pages).
UPDATE public.edoc_completion_certificates
SET content_page_count = 1
WHERE id = '9d441d68-57b2-48cc-bff0-38be0ce55e84'
  AND content_page_count IS NULL;
