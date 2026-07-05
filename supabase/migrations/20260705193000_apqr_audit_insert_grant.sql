-- APQR audit trail: authenticated users could SELECT but not INSERT (RLS policy alone is insufficient).
GRANT INSERT ON public.apqr_audit_events TO authenticated;
