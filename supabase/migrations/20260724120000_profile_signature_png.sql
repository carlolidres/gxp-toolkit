-- Profile PNG signature (transparent backgrounds allowed) for Account Settings.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_data_url TEXT;

NOTIFY pgrst, 'reload schema';
