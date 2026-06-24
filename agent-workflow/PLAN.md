# Active Plan

Last Updated: `2026-06-25`

Plan Owner: `Cursor`

Status: `IMPLEMENTED_PENDING_BROWSER_RETEST`

## Objective

Session security for the Project Tracker / GxP Toolkit app:

- Auto-logout after 15 minutes of inactivity
- Clear all auth/session data on logout or session expiry
- Sign-in fields blank after logout
- No cross-browser/computer session persistence
- Session ends when the browser tab/window closes

## Completed

- [x] `src/config/sessionPolicy.ts` — 15-minute inactivity constant and session keys
- [x] `src/lib/authSessionStore.ts` — sessionStorage-backed user/activity cache, login flash, Supabase token cleanup
- [x] `src/hooks/useInactivityLogout.ts` — activity listeners, focus/visibility checks, 60s expiry poll
- [x] `src/lib/supabase.ts` — Supabase auth storage on `sessionStorage` (tab-scoped, not cross-device)
- [x] `src/services/authService.ts` — inactivity check on restore, resilient local sign-out cleanup
- [x] `src/hooks/useAuth.tsx` — inactivity hook wiring, flash message, redirect to `/login` on logout
- [x] `src/pages/LoginPage.tsx` — reset email/password when unauthenticated; `autoComplete="off"` on form
- [x] `src/lib/authSessionStore.test.ts` — inactivity + cleanup tests
- [x] `npm run test` — 33 passed
- [x] `npm run build` — passed

## Owner verification

- [ ] Sign in, stay idle 15+ minutes → auto-logout with flash message
- [ ] Manual logout → login form fields empty
- [ ] Close browser/tab, reopen → must sign in again
- [ ] Sign in on one browser → other browser/computer does not inherit session
