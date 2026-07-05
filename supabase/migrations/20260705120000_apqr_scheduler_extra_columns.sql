-- Align apqr_scheduler_entries with SQLite reference (product status, generation dates, remarks)

ALTER TABLE public.apqr_scheduler_entries
  ADD COLUMN IF NOT EXISTS product_status TEXT NOT NULL DEFAULT 'Active'
    CHECK (product_status IN ('Active', 'End-of-Life')),
  ADD COLUMN IF NOT EXISTS scheduler_remarks TEXT,
  ADD COLUMN IF NOT EXISTS apqr_generation_date DATE,
  ADD COLUMN IF NOT EXISTS commitment_schedule_adjustment_reason TEXT,
  ADD COLUMN IF NOT EXISTS apqr_generation_adjustment_reason TEXT;
