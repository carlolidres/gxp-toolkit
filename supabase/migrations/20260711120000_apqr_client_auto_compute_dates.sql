-- Client-level Auto-Compute Dates vs Manual Dates preference for APQR scheduling.

ALTER TABLE public.apqr_clients
  ADD COLUMN IF NOT EXISTS auto_compute_dates BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.apqr_clients.auto_compute_dates IS
  'When true, schedule dates use automatic −60d/+30d/+90d rules. When false, Manual Dates: pullout = coverage end − 2 months; generation = commitment − 2 months.';
