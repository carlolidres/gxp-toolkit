# Supabase Migration Prep

This folder contains version-controlled prep artifacts only. Do not apply them to production until the project owner approves the baseline and migration plan.

## Files

- `migrations/20260616000000_initial_gxp_toolkit_schema.sql` through `20260618400000_fix_profiles_rls_row_security.sql` are copied from `reference/supabase/migrations` and create the tables, auth profile linkage, grants, user permissions, and RLS recursion fixes expected by the current app services.
- `seed.vrms.generated.sql` is generated locally and ignored by Git because it contains imported VRMS records.

## Local Preparation

```text
npm run verify:vrms-csv
npm run supabase:seed:vrms
```

Review `supabase/seed.vrms.generated.sql` before applying it to any Supabase project.

## Apply Order

1. Back up the target Supabase project.
2. Apply the migration SQL.
3. Link real Supabase Auth users to `public.profiles.auth_user_id`.
4. Apply the generated seed SQL only to the approved environment.
5. Set GitHub repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Build with `VITE_BASE_PATH=/gxp-toolkit/`.

## Approval Gate

The current baseline and task plan are not approved. Treat this folder as preparation, not authorization to migrate regulated data.
