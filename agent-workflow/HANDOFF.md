# Current Handoff

Last Updated: `2026-06-25`
Version: `v14.5`
Branch: `main` / `master`
Commit: `390dfcc` (feature) / `0737329` (handoff record)
Deployment: `SUCCESS — https://carlolidres.github.io/gxp-toolkit/ (HTTP 200)`

## Current Status

Session security implemented for the Project Tracker / GxP Toolkit auth layer. Automated checks pass; owner browser retest pending.

## Recently Completed

- 15-minute inactivity auto-logout via `useInactivityLogout` + `SESSION_INACTIVITY_MS`
- Auth cache and Supabase tokens stored in `sessionStorage` (tab-scoped; cleared when browser/tab closes)
- `clearAuthSessionStorage()` wipes user cache, activity timestamp, OAuth status, legacy localStorage user key, and `sb-*-auth-token` keys
- Logout (manual or inactivity) calls `signOut({ scope: 'local' })` then local cleanup; redirects to `/login`
- Login page resets email/password when unauthenticated; form uses `autoComplete="off"`
- Inactivity checks on focus, visibility change, and 60-second interval

## Active Work

- Objective: `Session security — inactivity logout and session cleanup`
- Progress: `FIX APPLIED + AUTOMATED CHECKS PASSED — owner browser retest pending`
- Remaining: Browser retest idle timeout, logout field reset, tab close, and cross-browser isolation

## Next Action

1. Sign in, wait 15+ minutes without activity → confirm auto-logout and flash message on login page.
2. Manual logout → confirm email/password fields are blank.
3. Close all tabs/windows, reopen app → confirm fresh sign-in required.
4. Confirm another browser or computer does not inherit the signed-in session.

## Verification

| Check | Status | Result |
|---|---|---|
| Tests | `PASSED` | 33 tests |
| Type-check / build | `PASSED` | chunk-size warning only |
| Browser retest | `NOT_RUN` | Owner verification |

## Files Changed

| Path | Change |
|---|---|
| `src/config/sessionPolicy.ts` | New — inactivity limit and session key constants |
| `src/lib/authSessionStore.ts` | New — sessionStorage helpers and cleanup |
| `src/lib/authSessionStore.test.ts` | New — inactivity and cleanup tests |
| `src/hooks/useInactivityLogout.ts` | New — idle timeout hook |
| `src/lib/supabase.ts` | Supabase auth uses `sessionStorage` |
| `src/services/authService.ts` | Inactivity on restore; resilient logout cleanup |
| `src/hooks/useAuth.tsx` | Inactivity hook; logout redirect |
| `src/pages/LoginPage.tsx` | Blank fields after logout |
