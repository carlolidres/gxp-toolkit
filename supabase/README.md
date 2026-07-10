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

## Admin-approved password reset

Flow:

1. User submits Forgot password → Edge Function `forgot-password` sets `profiles.password_reset_requested_at` and inserts an admin notification in `app_feedback_messages` (no password change; no temp password returned to the browser).
2. Admin opens User Management → **Reset Password** appears only when a request is pending.
3. Admin approves → Edge Function `admin-reset-password` generates a random 16-character temporary password, emails it via Gmail SMTP, updates Auth, sets `must_change_password`, clears the pending request.
4. User signs in with the emailed temporary password → `/reset-password` is required before app access.

Secrets (Supabase function secrets, never `VITE_*`):

```powershell
supabase functions deploy forgot-password
supabase functions deploy admin-reset-password

# Gmail SMTP (App Password required — Google Account → Security → 2-Step Verification → App passwords)
supabase secrets set GMAIL_USER=carlolidres@gmail.com
supabase secrets set GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
# Optional display-name override (defaults to "GxP Toolkit <GMAIL_USER>")
supabase secrets set PASSWORD_RESET_FROM_EMAIL="GxP Toolkit <carlolidres@gmail.com>"
```

`DEFAULT_RESET_PASSWORD` and `RESEND_API_KEY` are no longer used by this flow.

Reusable agent prompt for new projects: [`project-templates/gmail-forgot-password-prompt.md`](../project-templates/gmail-forgot-password-prompt.md).

Related migration: `20260709102630_admin_approved_password_reset.sql` (`profiles.password_reset_requested_at`). Earlier migrations still provide `must_change_password`, `check_temporary_password_required(email)`, and `clear_must_change_password()`.

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
