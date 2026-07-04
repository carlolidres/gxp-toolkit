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
2. Apply the migration SQL (through `20260623200000_admin_default_password_reset.sql`).
3. Deploy the Edge Function:

```powershell
supabase functions deploy admin-reset-password
supabase secrets set DEFAULT_RESET_PASSWORD=iLoveJesus
```

4. Link real Supabase Auth users to `public.profiles.auth_user_id`.
5. Apply the generated seed SQL only to the approved environment.
6. Set GitHub repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Build with `VITE_BASE_PATH=/gxp-toolkit/`.

## Admin default-password reset

- Migration adds `profiles.must_change_password`, `check_temporary_password_required(email)`, and `clear_must_change_password()`.
- Edge Function `admin-reset-password` uses the service role to set Auth password and invalidate sessions. Callable only by admins (`is_vrms_admin()`).
- Set `DEFAULT_RESET_PASSWORD` via Supabase secrets (not in client). After admin reset, user signs in with the password provided through a secure channel; `/reset-password` enforces change when `must_change_password` is set.

## Security migrations (2026-06-26)

Apply after `20260623200000_admin_default_password_reset.sql`:

- `20260626100000_profiles_role_self_update_fix.sql` — prevents role self-elevation
- `20260626100001_signup_and_temporary_password_security.sql` — removes signup admin bootstrap; restricts temp-password RPC to authenticated self

Verify with `supabase/scripts/verify_profiles_rls.sql`.

## eDoc module (2026-07-04)

After `20260627100000_app_feedback_messages.sql`:

1. Apply `20260704100000_edoc_supabase_module.sql` (included in `supabase db push`).
2. Deploy Edge Functions: `edoc-file-access`, `edoc-sign-document`, `edoc-create-certificate`.
3. Validate: `supabase db query --linked -f supabase/scripts/verify_edoc_rls.sql`
4. Follow `docs/edoc/STAGING_CHECKLIST.md` for org membership, permissions, and browser smoke.

SQLite reference: `database/sqlite/edoc_schema.sql` — validate locally with `npm run verify:edoc-sqlite`.

After `20260704100000_edoc_supabase_module.sql`, apply:

- `20260704110000_edoc_security_hardening.sql` — revokes `anon`/`PUBLIC` EXECUTE on eDoc RPCs, sets `security_invoker` on inbox view, pins trigger `search_path`.

## Approval Gate

The current baseline and task plan are not approved. Treat this folder as preparation, not authorization to migrate regulated data.
