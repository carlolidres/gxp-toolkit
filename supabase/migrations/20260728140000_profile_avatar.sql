-- Profile picture (avatar) data URL for Account Settings and app chrome.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_data_url TEXT;

NOTIFY pgrst, 'reload schema';
