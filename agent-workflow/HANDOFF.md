# Current Handoff

Last Updated: `2026-06-26`
Version: `v15.1`
Branch: `main` / `master`
Commit: `(pending)`
Deployment: `(pending push to master)`

## Current Status

Forgot Password now resets to the shared temporary default password (same as admin reset) instead of sending Supabase email links. Login page displays the temporary password, pre-fills the password field, and sign-in routes to mandatory `/reset-password` until changed.

## Recently Completed

- `forgot-password` Edge Function: service-role reset, global sign-out, `must_change_password = true`, returns `temporaryPassword`
- `authService.requestPasswordReset` invokes edge function (mock mode returns `MOCK_DEFAULT_RESET_PASSWORD`)
- Login UI: temporary password panel, updated copy, post-login redirect when change required
- `supabase/config.toml`: `verify_jwt = false` for `forgot-password`

## Active Work

- Objective: `Self-service temporary password reset (no email link)`
- Progress: `COMMITTING, PUSHING, DEPLOYING`

## Next Action

1. Deploy edge function: `supabase functions deploy forgot-password` (uses existing `DEFAULT_RESET_PASSWORD` secret).
2. Browser test: Forgot password → temp password shown → sign in → forced new password → app access → old temp password rejected.
3. Prior backlog: feedback migration, messaging/N/A browser tests.

## Verification

| Check | Status | Result |
|---|---|---|
| Tests | `PASSED` | `npm run test` — 39 tests |
| Build | `PASSED` | `npm run build` |
| Edge function deploy | `PASSED` | `forgot-password` v1 on `ydndeoacgfnxjqwwnswh` |
| Browser retest | `NOT_RUN` | Pending |

## Files Changed (summary)

| Area | Paths |
|---|---|
| Edge Function | `supabase/functions/forgot-password/index.ts`, `supabase/config.toml` |
| Auth | `src/services/authService.ts`, `src/hooks/useAuth.tsx`, `src/config/authPasswordPolicy.ts` |
| Login / reset UI | `src/pages/LoginPage.tsx`, `src/pages/ResetPasswordPage.tsx`, `src/styles/globals.css` |
| Tests | `src/services/authService.passwordReset.test.ts` |
