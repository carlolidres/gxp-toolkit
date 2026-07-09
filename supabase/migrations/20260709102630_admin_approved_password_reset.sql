-- Admin-approved password reset: pending request flag on profiles.
-- Forgot-password only records a request; admin-reset-password issues a random temp password.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_reset_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_password_reset_requested_at
  ON public.profiles (password_reset_requested_at)
  WHERE password_reset_requested_at IS NOT NULL;

COMMENT ON COLUMN public.profiles.password_reset_requested_at IS
  'Set when a user submits Forgot password; cleared after admin approves Reset Password.';
