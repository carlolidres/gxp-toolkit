-- Job position / title for Account Settings profile.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title TEXT;

NOTIFY pgrst, 'reload schema';
