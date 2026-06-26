# Current Handoff

Last Updated: `2026-06-26`
Version: `v15.0`
Branch: `main` / `master`
Commit: `e6ef220`
Deployment: `(pending push to master)`

## Current Status

Login password field shows a single custom eye toggle. Browser-native reveal controls are hidden so Edge/Chrome no longer duplicate the icon.

## Recently Completed

- Hide native `::-ms-reveal` / autofill decoration buttons on `PasswordInput` (login, sign-up, reset-password)
- Prior v14.9: messaging/feedback, N/A optional fields, security remediation

## Active Work

- Objective: `Password field duplicate eye icon fix`
- Progress: `COMMITTING, PUSHING, DEPLOYING`
- Remaining: Browser verify login password toggle on live site

## Next Action

1. Browser test: sign-in password field shows one eye icon; toggle shows/hides password.
2. Apply `supabase/migrations/20260627100000_app_feedback_messages.sql` if not yet applied.
3. Browser test: admin messaging and N/A fields (v14.9 backlog).

## Verification

| Check | Status | Result |
|---|---|---|
| Build | `PASSED` | `npm run build` |
| Tests | `NOT_RUN` | CSS-only change |
| Browser retest | `NOT_RUN` | Owner verification pending |
| Deployment | `PENDING` | Push to `master` triggers GitHub Pages |

## Files Changed (summary)

| Area | Paths |
|---|---|
| Auth UI | `src/styles/globals.css` |
