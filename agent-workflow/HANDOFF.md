# Current Handoff

Last Updated: `2026-06-23 21:55 Asia/Taipei`
Version: `v14`
Branch: `main` / `master`
Commit: `476738f`
Deployment: `SUCCESS`

## Current Status

Admin default-password reset implemented: User Management resets accounts to `iLoveJesus` via Edge Function, login page shows the temporary password when required, and users must set a new password before accessing the app. Prior VRMS dashboard and auth/profile fixes remain in place.

## Recently Completed

- Fixed migration `20260623200000_admin_default_password_reset.sql`: `DROP FUNCTION` before profile RPCs (Postgres 42P13)
- Added Edge Function `supabase/functions/admin-reset-password` (service-role password set + session invalidation)
- Replaced **Send reset email** with **Reset to default password** on User Management
- Login page shows temporary password hint when `check_temporary_password_required` is true
- Protected routes redirect to `/reset-password` until the user chooses a new password
- Added auth mapping tests for `mustChangePassword` and default password constant

## Active Work

- Objective: `Admin default-password reset flow`
- Progress: `COMMITTED — Supabase migration + Edge Function deploy in progress`
- Remaining: Owner browser retest with Supabase backend

## Next Action

1. Apply migration `20260623200000_admin_default_password_reset.sql` to the live Supabase project.
2. Deploy Edge Function: `supabase functions deploy admin-reset-password`
3. Set secret: `supabase secrets set DEFAULT_RESET_PASSWORD=iLoveJesus`
4. Retest `/admin/users` reset → `/login` hint → sign-in → forced password change → app access.

## Verification

| Check | Status | Result |
|---|---|---|
| Tests | `PASSED` | 29 tests |
| Type-check / build | `PASSED` | chunk-size warning only |
| Live migration | `PASSED` | Migrations through `20260623200000` applied |
| Edge Function deploy | `PASSED` | `admin-reset-password` + `DEFAULT_RESET_PASSWORD` secret |
| GitHub Pages | `PASSED` | https://carlolidres.github.io/gxp-toolkit/ (v14 + v14.1 pushes) |
| Browser retest | `NOT_RUN` | Owner verification |


## Recently Completed

- Fixed VRMS dashboard greeting: `VrmsDashboardPage` now calls `formatDashboardGreeting` instead of static "Good morning"
- Enhanced `src/lib/greeting.ts` to derive hour from `Intl.DateTimeFormat().resolvedOptions().timeZone` (browser-local IANA zone)
- Added timezone-specific unit test (`Asia/Taipei` vs `UTC`)
- Fixed VRMS dashboard panel balance: distribution and Individual KPI cards now stretch to the same bounded desktop height, with KPI table overflow contained inside the card
- Restored polished KPI name treatment with circular initials avatars and a sticky table header
- Fixed Individual KPI average duration: `buildVrmsDashboard` now parses `Duration pending/signing time` from signed signatory rows, averages samples by person, and formats the display duration
- Added a focused dashboard KPI test covering average-duration calculation and `N/A` fallback when no signed-duration samples exist
- Fixed lower dashboard document preview cards: recently updated and active routing cards now use compact 3-column preview tables, header icons/actions, contained vertical scrolling, footer counts, and view-all actions
- Fixed responsive dashboard proportions: top dashboard panels and lower document cards now use equal 50:50 columns on wide content areas, with overflow-safe table layouts
- Fixed database reference mismatch: visible database table now matches the expected 8-column view, toolbar fields adapt across widths, and the overdue control renders as a switch instead of a raw checkbox

## Root Causes (workflow-app bugs)

| Issue | Root cause |
|---|---|
| Login prefilled email | Hardcoded `defaultValue` in `LoginPage.tsx` |
| `get_own_profile` 400 | STABLE function performing writes + duplicate RETURN QUERY; seed profile missing `auth_user_id` broke admin RLS |
| Account profile save | Update filtered only `auth_user_id`; seed profile had null link |
| Admin menu / user list | `is_vrms_admin()` required `auth_user_id = auth.uid()`; owner seed row was unlinked |
| Dashboard greeting | Static "Good morning" on `VrmsDashboardPage` (`/dashboard` route); sample `DashboardPage` was fixed earlier but not VRMS |
| Dashboard card imbalance | KPI table content expanded the whole card; previous donut-height syncing did not constrain table overflow, so both cards could become visually uneven or oversized |
| Dashboard average duration | `buildVrmsDashboard` initialized duration counters but never added signatory duration samples; `avgDuration` was hardcoded to `N/A` |
| Dashboard document cards | Lower dashboard panels reused the generic wide VRMS data table and lacked preview-card header/footer structure, causing horizontal scroll and clipped content |
| Dashboard/database responsiveness | Wide layouts used uneven column ratios or generic table widths, so sidebar expansion changed proportions and caused avoidable horizontal overflow |
| OAuth | Removed unused Google/Microsoft sign-in paths per owner request |

| Browser retest (prior) | `PARTIAL` | Mock-mode layout verified; Supabase retest pending |

## Feedback Source

Workflow-app record: `Resolve Authentication, Password Reset, User Registration, Profile Editing, and Administration Menu Issues` — comments/bugs dated 2026-06-22–2026-06-23.
