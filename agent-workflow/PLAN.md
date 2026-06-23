# Active Plan

Last Updated: `2026-06-23`

Plan Owner: `Cursor`

Status: `IMPLEMENTED_PENDING_SUPABASE_DEPLOY`

## Objective

Replace admin email password reset with default-password reset (`iLoveJesus`), login-page temporary password hint, and mandatory password change on next sign-in.

## Completed

- [x] Migration `20260623200000_admin_default_password_reset.sql`
- [x] Edge Function `admin-reset-password`
- [x] User Management button → **Reset to default password**
- [x] Login page temporary password hint via `check_temporary_password_required`
- [x] Post-login gate via `mustChangePassword` → `/reset-password`
- [x] `npm run test` — 29 passed
- [x] `npm run build` — passed

## Owner verification

- [ ] Apply migration to live Supabase project
- [ ] Deploy Edge Function + set `DEFAULT_RESET_PASSWORD` secret
- [ ] `/admin/users` — reset selected user password
- [ ] `/login` — temporary password hint appears for reset user
- [ ] Sign in with default password → forced new password screen
- [ ] After new password, normal app access
