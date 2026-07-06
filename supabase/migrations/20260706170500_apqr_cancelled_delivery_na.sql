-- Allow NA delivery classification for cancelled APQR report statuses.

ALTER TABLE public.apqr_records
  DROP CONSTRAINT IF EXISTS apqr_records_delivery_classification_check;

ALTER TABLE public.apqr_records
  ADD CONSTRAINT apqr_records_delivery_classification_check
  CHECK (
    delivery_classification IS NULL
    OR delivery_classification IN (
      'Delivered On Time',
      'Delivered Overdue',
      'Currently Overdue and Undelivered',
      'NA'
    )
  );
