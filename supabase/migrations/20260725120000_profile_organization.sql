-- Profile organization + shared autocomplete option catalog for Account Settings.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization TEXT;

CREATE TABLE IF NOT EXISTS public.profile_organization_options (
  id text PRIMARY KEY,
  value text NOT NULL,
  created_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_organization_options_value_ci
  ON public.profile_organization_options (lower(btrim(value)));

ALTER TABLE public.profile_organization_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read organization options" ON public.profile_organization_options;
CREATE POLICY "Authenticated read organization options"
  ON public.profile_organization_options
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated insert organization options" ON public.profile_organization_options;
CREATE POLICY "Authenticated insert organization options"
  ON public.profile_organization_options
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins delete organization options" ON public.profile_organization_options;
CREATE POLICY "Admins delete organization options"
  ON public.profile_organization_options
  FOR DELETE
  TO authenticated
  USING (public.is_vrms_admin());

GRANT SELECT, INSERT, DELETE ON public.profile_organization_options TO authenticated;

NOTIFY pgrst, 'reload schema';
