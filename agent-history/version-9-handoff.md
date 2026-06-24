# Version 9 Handoff

Last Updated: `2026-06-25`
Version: `v14.5`
Branch: `main` / `master`
Commit: `390dfcc`
Commit message: `v14.5: session security - inactivity logout and tab-scoped auth storage`
Deployment: `PENDING`

## Request

Commit, push, and deploy session security work: 15-minute inactivity logout, tab-scoped sessionStorage auth, and logout cleanup.

## Implemented

- `src/config/sessionPolicy.ts` — inactivity limit and session key constants
- `src/lib/authSessionStore.ts` — sessionStorage helpers, activity timestamp, Supabase token cleanup
- `src/hooks/useInactivityLogout.ts` — idle timeout with focus/visibility/60s polling
- `src/lib/supabase.ts` — Supabase auth storage on sessionStorage
- `src/services/authService.ts` — inactivity check on restore; resilient local sign-out
- `src/hooks/useAuth.tsx` — inactivity hook; logout redirect and flash message
- `src/pages/LoginPage.tsx` — blank fields after logout; `autoComplete="off"`
- `src/lib/authSessionStore.test.ts` — inactivity and cleanup tests
- Auth bootstrap and permission cache clear on session end
- Supabase migration to roll back accidental feedback purge RPCs

## Verification

| Check | Status | Result |
|---|---|---|
| `npm run test` | PASSED | 33 tests |
| `npm run build` | PASSED | chunk-size warning only |
| Git commit | PENDING | |
| Git push | PENDING | |
| GitHub Pages | PENDING | push to `master` |
| Browser retest | NOT_RUN | Owner verification |

## Next Action

1. Sign in, stay idle 15+ minutes → auto-logout with flash message
2. Manual logout → login form fields empty
3. Close browser/tab, reopen → must sign in again
4. Sign in on one browser → other browser/computer does not inherit session
