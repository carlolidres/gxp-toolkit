# Version 8 Handoff

Last Updated: `2026-06-23 21:46 Asia/Taipei`
Version: `v8`
Branch: `main` / `master`
Commit: `b084c47`
Commit message: `v14: admin password reset, auth/profile fixes, dashboard KPI sync`
Deployment: `IN_PROGRESS`

## Request

Commit, push, and deploy auth/password-reset work, Supabase migrations, Edge Function, and VRMS dashboard fixes.

## Implemented

- Admin default-password reset (`iLoveJesus`) via Edge Function and `must_change_password` flag
- Login temporary-password hint and forced `/reset-password` gate
- Auth/profile RPC migrations through `20260623200000_admin_default_password_reset.sql` (includes 42P13 DROP FUNCTION fix)
- VRMS dashboard greeting, KPI average duration, document preview cards, and KPI panel height sync to Distribution panel
- Local workflow app under `workflow-app/`

## Verification

| Check | Status | Result |
|---|---|---|
| `npm run test` | PASSED | 29 tests |
| `npm run build` | PASSED | chunk-size warning only |
| Git commit | PASSED | `b084c47` |
| Git push | PENDING | |
| GitHub Pages | PENDING | push to `master` |
| Supabase migration | PENDING | `supabase db push` |
| Edge Function | PENDING | `admin-reset-password` |

## Next Action

1. Confirm GitHub Pages workflow succeeded.
2. Browser retest: admin reset → login hint → forced password change → app access.
3. Verify VRMS dashboard panel heights on desktop.

## Rollback

- Git: `git revert e53174a` or reset to prior `ee749f3`
- Supabase: restore from project backup before migration apply
