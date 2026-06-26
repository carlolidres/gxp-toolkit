# Codebase Bug Audit

Audit date: `2026-06-26`  
Auditor: Cursor static review (no application code modified)  
Repository: `gxp-toolkit` — Vite 8 + React 19 + TypeScript + Supabase + VRMS module

---

## 1. Executive Summary

**Overall condition:** The application **builds, type-checks, and passes all 32 unit tests**. Core VRMS mock workflows (create, save, sign, dashboard navigation by status) are implemented and covered by limited automated tests. **Supabase production deployment has at least one confirmed server-side privilege-escalation defect** in `profiles` RLS. Several **GxP-impacting client workflow gaps** exist (sign without save, weak required-field validation, stale audit view).

| Severity | Confirmed | Suspected |
|----------|-----------|-----------|
| Critical | 1 | 0 |
| High | 5 | 1 |
| Medium | 10 | 6 |
| Low | 4 | 4 |

**Most urgent risks**

1. **BUG-001** — Any authenticated user can self-update `profiles.role` to `admin` via PostgREST (RLS policy gap).
2. **BUG-002** — Routing signatory actions ignore unsaved form/signatory edits (integrity risk).
3. **BUG-003** — Required routing fields are not enforced despite `VRMS_REQUIRED_FORM_FIELDS` and UI `*` markers.
4. **BUG-010** — First signup on an empty database becomes `admin`.
5. **BUG-014** — Background VRMS auto-refresh can overwrite mutation results (Supabase mode).

**Build and run status**

| Area | Status |
|------|--------|
| TypeScript | Pass |
| Unit tests (32) | Pass |
| Production build | Pass (chunk size warning only) |
| VRMS CSV verifier | Pass |
| Workflow app schema/smoke | Pass |
| Lint | Not configured |
| Browser / E2E | Not run in this audit |
| Live Supabase integration | Not run in this audit |

---

## 2. Validation Results

| Check | Command | Result | Important Output |
|-------|---------|--------|------------------|
| Type check | `npm run type-check` | **Pass** | `tsc -b` completed with exit 0 |
| Lint | `npm run lint` | **Not available** | Script not defined in `package.json` |
| Tests | `npm run test` | **Pass** | 11 files, 32 tests passed |
| Production build | `npm run build` | **Pass** | Vite build succeeded; JS bundle ~949 kB (warning) |
| VRMS CSV verification | `npm run verify:vrms-csv` | **Pass** | All 10 CSV targets match bundled row counts |
| Workflow schema | `npm run workflow:validate` | **Pass** | `PASS: workflow SQLite schema validates.` |
| Workflow smoke | `npm run workflow:smoke` | **Pass** | `PASS: workflow app smoke test completed.` |
| Database verification (`verify:schema`) | `npm run verify:schema` | **Not available** | Script not in root `package.json` |
| Supabase verification (`verify:supabase`) | `npm run verify:supabase` | **Not available** | Script not in root `package.json` |
| Graphify check | `npm run graphify:check` | **Not available** | Script not in root `package.json` |

---

## 3. Confirmed Bugs

### BUG-001: Authenticated users can self-elevate `profiles.role` via RLS

* **Severity:** Critical
* **Status:** Confirmed
* **Affected area:** Supabase auth / user management / admin access
* **Files involved:** `supabase/migrations/20260617100000_vrms_auth_profiles.sql`, `supabase/migrations/20260622200000_reapply_profiles_rls_fix.sql`, `supabase/migrations/20260623100000_fix_profile_rpc_and_admin_access.sql`
* **Relevant functions/components:** RLS policy `"Users update own profile"`; `public.is_vrms_admin()`
* **Observed behavior:** Policy `"Users update own profile"` allows `UPDATE` on the caller's row with no column restriction. Later migrations add `"Admins update profiles"` but do **not** drop the self-update policy. Postgres ORs permissive policies — a user can set `role = 'admin'`.
* **Expected behavior:** Only admins (or SECURITY DEFINER RPCs) may change `profiles.role`.
* **Root cause:** Overly broad `UPDATE` policy without `WITH CHECK` limiting mutable columns; missing `DROP POLICY "Users update own profile"` in later RLS fix migrations.
* **Reproduction steps:**
  1. Sign in as a non-admin Supabase user.
  2. `supabase.from('profiles').update({ role: 'admin' }).eq('auth_user_id', '<uid>')`.
  3. `rpc('is_vrms_admin')` returns `true`; admin UI and policies unlock.
* **Recommended fix:** New migration: `DROP POLICY "Users update own profile"`; replace with policy allowing self-update of `display_name` only (or route profile updates through a restricted RPC). Add `WITH CHECK` ensuring `role` and `active` unchanged for non-admins.
* **Acceptance criteria:**
  * [ ] Non-admin cannot change own `role` or `active` via direct table update.
  * [ ] Admin can still manage users via `supabaseUserManagementService`.
  * [ ] Self-service display name update still works if intended.
* **Regression risks:** Profile signup trigger, `get_own_profile`, user management page saves.
* **Suggested tests:** SQL policy test script; integration test attempting role self-update as `user` role.
* **Dependencies:** None — fix first.

---

### BUG-002: Signatory sign action ignores unsaved routing form state

* **Severity:** High
* **Status:** Confirmed
* **Affected area:** `/routing` — document signing workflow
* **Files involved:** `src/pages/vrms/VrmsRoutingPage.tsx`, `src/services/mockVrmsService.ts`, `src/services/supabaseVrmsService.ts`
* **Relevant functions/components:** `handleSign`, `signDocumentSignatory`, `mockVrmsService.signDocumentSignatory`
* **Observed behavior:** `handleSign` calls `signDocumentSignatory(form.routingTracker, order)` only. Service reloads persisted document by tracker; local `form` / `signatories` state is not submitted first.
* **Expected behavior:** Signing should use the current form state, or UI must block sign until Submit saves (with clear messaging).
* **Root cause:** Sign path bypasses `handleSubmit` / `saveDocument`.
* **Reproduction steps:**
  1. Open `/routing?tracker=<existing>`.
  2. Edit signatories or fields without clicking Submit.
  3. Click **Signed** on a signatory row.
  4. Action applies to last-saved data; local edits lost on refresh.
* **Recommended fix:** Either auto-save before sign, or disable sign buttons when form is dirty and show prompt. Prefer explicit save-then-sign for GxP traceability.
* **Acceptance criteria:**
  * [ ] Cannot sign with unsaved local changes without confirmation or auto-save.
  * [ ] After sign, UI reflects persisted server state.
* **Regression risks:** Routing status transitions, ordered signatory rules in `applySignDocumentSignatory`.
* **Suggested tests:** Unit test for dirty-form guard; extend `vrmsLogic.test.ts` signing flow.
* **Dependencies:** None.

---

### BUG-003: Required routing fields not validated on save

* **Severity:** High
* **Status:** Confirmed
* **Affected area:** `/routing` — document create/edit
* **Files involved:** `src/pages/vrms/VrmsRoutingPage.tsx`, `src/utils/vrmsLogic.ts`, `src/lib/vrmsDefaults.ts`, `src/lib/vrmsFormConfig.ts`
* **Relevant functions/components:** `handleSubmit`, `applySaveDocument`, `VRMS_REQUIRED_FORM_FIELDS` (defined but unused)
* **Observed behavior:** UI shows `*` for required fields. `applySaveDocument` only throws if `docTracer` is empty; other fields fall back to `''` or existing values.
* **Expected behavior:** All fields in `VRMS_REQUIRED_FORM_FIELDS` / `vrmsFormConfig` `required: true` must be validated client-side (and server-side in `applySaveDocument`) before save.
* **Root cause:** `VRMS_REQUIRED_FORM_FIELDS` constant exists in `vrmsDefaults.ts` but is never referenced; no shared validator wired to form or service layer.
* **Reproduction steps:**
  1. Open `/routing`, clear `Equipment/Product`, `Batch No.`, etc.
  2. Submit — save succeeds with empty strings.
* **Recommended fix:** Add `validateRoutingPayload()` using `VRMS_REQUIRED_FORM_FIELDS`; call from `VrmsRoutingPage.handleSubmit` and `applySaveDocument`.
* **Acceptance criteria:**
  * [ ] Save blocked with field-level errors for each missing required field.
  * [ ] Existing valid documents still save on edit.
* **Regression risks:** Mock and Supabase save paths, N/A optional fields (`IL-Tag`, `Remarks`).
* **Suggested tests:** Unit tests in `vrmsLogic.test.ts` for validation failures.
* **Dependencies:** None.

---

### BUG-004: Dashboard KPI name links do not filter database by signatory

* **Severity:** Medium
* **Status:** Confirmed
* **Affected area:** Dashboard → Database drill-down
* **Files involved:** `src/pages/vrms/VrmsDashboardPage.tsx`, `src/pages/vrms/VrmsDatabasePage.tsx`
* **Relevant functions/components:** KPI row `onClick` navigate; `filtered` `useMemo` haystack
* **Observed behavior:** KPI rows navigate to `/database?search=<name>`. Database search uses `Object.values(doc).join(' ')`, which stringifies `signatories` arrays as `[object Object]`.
* **Expected behavior:** Clicking a KPI signatory name filters documents where that person appears in signatories or routing fields.
* **Root cause:** Search haystack does not flatten nested `signatories` or searchable text fields.
* **Reproduction steps:**
  1. Dashboard → KPI table → click a signatory who appears only in `signatories[].Name`.
  2. Database shows "No records found."
* **Recommended fix:** Build searchable string from explicit scalar fields plus `signatories.map(s => s.Name).join(' ')`.
* **Acceptance criteria:**
  * [ ] KPI click returns matching documents.
  * [ ] Status/overdue URL filters still work.
* **Regression risks:** Database text search performance on large sets.
* **Suggested tests:** Unit test for document search helper.
* **Dependencies:** None.

---

### BUG-005: Dashboard document cards show misleading "10 of N" count

* **Severity:** Medium
* **Status:** Confirmed
* **Affected area:** `/` dashboard preview tables
* **Files involved:** `src/pages/vrms/VrmsDashboardPage.tsx`, `src/components/vrms/VrmsDataTable.tsx`, `src/data/mockVrms.ts`
* **Relevant functions/components:** `DashboardDocumentCard`, `visibleCount`
* **Observed behavior:** Footer displays `{Math.min(10, total)} of {total}` but `VrmsDataTable` receives full `rows` array (all documents). Scroll container allows viewing more than 10 rows.
* **Expected behavior:** Either slice to 10 rows in data, or update footer to reflect actual rendered/scrollable count.
* **Root cause:** `visibleCount` is display-only; no `rows.slice(0, 10)`.
* **Reproduction steps:**
  1. Load dashboard with >10 routing documents in "Active" or "Recently updated".
  2. Footer says `10 of 112`; scroll reveals additional rows.
* **Recommended fix:** Pass `rows.slice(0, 10)` to preview table; keep full list link in footer action.
* **Acceptance criteria:**
  * [ ] Preview table renders at most 10 rows.
  * [ ] Footer count matches rendered rows.
* **Regression risks:** Dashboard layout CSS (`max-height: 410px` scroll).
* **Suggested tests:** Component test or snapshot for row count.
* **Dependencies:** None.

---

### BUG-006: Permission load failure grants full role default permissions

* **Severity:** Medium
* **Status:** Confirmed
* **Affected area:** Menu access / authorization UI
* **Files involved:** `src/hooks/usePermissions.tsx`, `src/lib/permissions.ts`
* **Relevant functions/components:** `loadPermissions` catch block; `getRoleDefaultPermissions`
* **Observed behavior:** On timeout (15s) or fetch error, `setPermissions(getRoleDefaultPermissions(user.role))`. Admin defaults grant all menu actions `true`.
* **Expected behavior:** Fail closed — empty permissions or read-only fallback; surface error to user.
* **Root cause:** Catch block treats failure as "use optimistic defaults."
* **Reproduction steps:**
  1. Sign in as Admin (or with tampered cached role).
  2. Block or stall `user_menu_permissions` fetch.
  3. After timeout, all menus become accessible per role defaults.
* **Recommended fix:** On failure, set `permissions` to `{}` or minimal view-only set; show banner. Retry with backoff.
* **Acceptance criteria:**
  * [ ] Failed permission load does not expand access beyond stored grants.
  * [ ] User sees recoverable error state.
* **Regression risks:** Sidebar empty state, `MenuPermissionRoute` redirects.
* **Suggested tests:** Mock `userManagementService.getPermissions` rejection in hook test.
* **Dependencies:** Related to RISK-001 (session tampering amplifies impact).

---

### BUG-007: Auth session restore timeout leaves cached user authenticated

* **Severity:** Medium
* **Status:** Confirmed
* **Affected area:** App bootstrap / session restore
* **Files involved:** `src/hooks/useAuth.tsx`, `src/lib/authSessionStore.ts`, `src/services/authService.ts`
* **Relevant functions/components:** `AuthProvider` restore `useEffect`; `getCachedUser`
* **Observed behavior:** On 15s timeout, only `setReady(true)` runs. `user` state initialized from `getCachedUser()` is not cleared if `restoreSession` is still pending or failed silently.
* **Expected behavior:** Timeout should clear unverified cached session and treat user as signed out until Supabase confirms session.
* **Root cause:** Timeout path does not call `setUserIfChanged(null)` or `clearSessionUser()`.
* **Reproduction steps:**
  1. Populate `sessionStorage['gxp-toolkit-user']` with a user object.
  2. Load app with Supabase configured; stall network to `getSession`.
  3. After 15s, UI shows authenticated state without verified session.
* **Recommended fix:** On timeout, clear cached session user and set `user` to `null` unless `restoreSession` already resolved.
* **Acceptance criteria:**
  * [ ] Timeout never leaves stale cache as authenticated.
  * [ ] Valid sessions still restore when network is slow but completes before timeout.
* **Regression risks:** Flash of login on slow networks — consider longer timeout or loading state.
* **Suggested tests:** Unit test for timeout branch.
* **Dependencies:** None.

---

### BUG-008: Anonymous RPC enables email/account enumeration

* **Severity:** Medium
* **Status:** Confirmed
* **Affected area:** Login page / pre-auth
* **Files involved:** `supabase/migrations/20260623200000_admin_default_password_reset.sql`, `src/services/authService.ts`, `src/pages/LoginPage.tsx`
* **Relevant functions/components:** `check_temporary_password_required`; `checkTemporaryPasswordRequired`
* **Observed behavior:** `GRANT EXECUTE ... TO anon, authenticated`. RPC returns whether an active profile has `must_change_password` for a given email.
* **Expected behavior:** No account-state leakage to unauthenticated callers; or rate-limited generic response only.
* **Root cause:** Pre-login UX requirement implemented with anon-accessible SECURITY DEFINER RPC reading `profiles`.
* **Reproduction steps:**
  1. Call `check_temporary_password_required` as anon with various emails.
  2. Distinguish active admin-reset accounts from non-existent/inactive.
* **Recommended fix:** Remove `anon` grant; require authenticated session, or return constant response for all emails with server-side rate limiting.
* **Acceptance criteria:**
  * [ ] Anon cannot distinguish account states by email.
  * [ ] Legitimate reset UX still works for signed-in or post-reset flows.
* **Regression risks:** Login temporary-password hint debounce on `LoginPage`.
* **Suggested tests:** SQL grant verification script.
* **Dependencies:** Coordinate with BUG-009 UX.

---

### BUG-009: Default admin reset password exposed in client bundle and login UI

* **Severity:** Medium
* **Status:** Confirmed
* **Affected area:** Password reset / compliance
* **Files involved:** `src/config/authPasswordPolicy.ts`, `src/pages/LoginPage.tsx`, `supabase/functions/admin-reset-password/index.ts`
* **Relevant functions/components:** `ADMIN_DEFAULT_RESET_PASSWORD`, `temporaryPasswordRequired` UI block
* **Observed behavior:** Constant `'iLoveJesus'` shipped in frontend; login page displays it when `checkTemporaryPasswordRequired` returns true.
* **Expected behavior:** Temporary passwords must not be published in client code or UI; user receives via secure channel only.
* **Root cause:** Shared hardcoded default for edge function and UI hint.
* **Reproduction steps:**
  1. Admin resets user password.
  2. On login, enter that email → UI shows temporary password in plain text.
* **Recommended fix:** Remove UI disclosure; use email-only reset links; rotate default in edge function; env-configured secret not in `VITE_*`.
* **Acceptance criteria:**
  * [ ] No password string in client bundle or DOM.
  * [ ] Reset flow still completes.
* **Regression risks:** Admin reset edge function, `must_change_password` flow.
* **Suggested tests:** Build scan for `iLoveJesus`; manual reset flow.
* **Dependencies:** BUG-008 if login hint removed.

---

### BUG-010: First signup becomes admin when no admin profile exists

* **Severity:** High
* **Status:** Confirmed
* **Affected area:** Supabase signup / bootstrap
* **Files involved:** `supabase/migrations/20260622500000_remove_edocs_auth_trigger.sql`, `supabase/migrations/20260622200000_reapply_profiles_rls_fix.sql`, `supabase/migrations/20260623200000_admin_default_password_reset.sql`
* **Relevant functions/components:** `handle_vrms_new_user`, `get_own_profile` bootstrap branches
* **Observed behavior:** `IF NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin') THEN role_value := 'admin'`.
* **Expected behavior:** First admin assigned only via controlled seed/migration, not public signup.
* **Root cause:** Bootstrap convenience in signup trigger and lazy profile RPC.
* **Reproduction steps:**
  1. Fresh Supabase project with VRMS migrations, no admin seed.
  2. Public signup at `/signup`.
  3. New user receives `admin` role.
* **Recommended fix:** Remove auto-admin bootstrap; seed designated admin via migration (`20260622300000_assign_designated_admin.sql` pattern); default new users to `user`/`viewer`.
* **Acceptance criteria:**
  * [ ] Public signup never assigns `admin`.
  * [ ] Designated admin seed still works.
* **Regression risks:** Empty-environment first deploy.
* **Suggested tests:** SQL test on fresh DB signup.
* **Dependencies:** BUG-001 should be fixed regardless.

---

### BUG-011: Database `user` role mapped to client `Editor` permissions

* **Severity:** Medium
* **Status:** Confirmed
* **Affected area:** Authorization / role sync
* **Files involved:** `src/lib/authMapping.ts`, `src/services/authService.ts`
* **Relevant functions/components:** `mapVrmsRoleToUserRole`
* **Observed behavior:** `case 'user': default: return 'Editor'` — DB `user` tier receives Editor default permissions when menu permissions missing or as base role.
* **Expected behavior:** DB `user` should map to `Viewer` or explicit least-privilege tier per baseline.
* **Root cause:** Permissive default in role mapping.
* **Reproduction steps:**
  1. Supabase profile with `role = 'user'`.
  2. Sign in → client `user.role` is `Editor` with create/edit/approve defaults.
* **Recommended fix:** Map `'user'` → `'Viewer'` (or new tier); audit `getRoleDefaultPermissions`.
* **Acceptance criteria:**
  * [ ] DB `user` cannot access Editor-only actions without explicit grants.
* **Regression risks:** Existing users expecting Editor access.
* **Suggested tests:** `authMapping.test.ts` case for `user` role.
* **Dependencies:** Product owner approval for role matrix.

---

### BUG-012: Default registry values reappear after deletion

* **Severity:** Medium
* **Status:** Confirmed
* **Affected area:** `/registry` master data
* **Files involved:** `src/services/vrmsStore.ts`, `src/services/mockVrmsService.ts`, `src/services/supabaseVrmsService.ts`, `src/utils/vrmsLogic.ts`
* **Relevant functions/components:** `ensureStoreRegistryDefaults`, `ensureDefaultRegistryValues`, `loadRegistryValues`
* **Observed behavior:** After delete, next load re-injects production defaults from `VRMS_DEFAULT_REGISTRY`.
* **Expected behavior:** Admin deletion of seeded values persists unless explicit "restore defaults" action.
* **Root cause:** `ensureDefaultRegistryValues` runs on every load without tracking user removals.
* **Reproduction steps:**
  1. Registry → delete seeded value (e.g. a Status option).
  2. Refresh or perform another registry mutation → value returns.
* **Recommended fix:** Persist deleted-default keys in store/DB, or only seed on empty registry table.
* **Acceptance criteria:**
  * [ ] Deleted registry values stay deleted across refresh.
  * [ ] Fresh install still gets defaults.
* **Regression risks:** Routing dropdown options, sign workflow terminal statuses.
* **Suggested tests:** Mock service delete + reload test.
* **Dependencies:** None.

---

### BUG-013: Supabase registry delete writes audit even when row not deleted

* **Severity:** Medium
* **Status:** Confirmed
* **Affected area:** Registry / audit trail accuracy
* **Files involved:** `src/services/supabaseVrmsService.ts`, `src/services/mockVrmsService.ts` (for comparison)
* **Relevant functions/components:** `deleteRegistryValue`
* **Observed behavior:** Supabase path calls `appendAudit` after DELETE regardless of rows affected. Mock path checks existence first.
* **Expected behavior:** Audit event only when a row was actually removed.
* **Root cause:** Missing `count` check on delete result.
* **Reproduction steps:**
  1. Delete a registry value twice, or delete non-existent value.
  2. Audit trail shows duplicate "Deleted registry value" events.
* **Recommended fix:** Use `.select()` or check `count`; mirror mock service guard.
* **Acceptance criteria:**
  * [ ] No audit row when DELETE affects 0 rows.
* **Regression risks:** Audit page filtering.
* **Suggested tests:** Service unit test with mocked Supabase client.
* **Dependencies:** None.

---

### BUG-014: VRMS auto-refresh can overwrite post-mutation application state

* **Severity:** Medium
* **Status:** Confirmed (Supabase mode); Low impact in mock mode
* **Affected area:** Global VRMS data context
* **Files involved:** `src/context/VrmsAppContext.tsx`, `src/lib/vrmsDefaults.ts`
* **Relevant functions/components:** `refresh`, 15s `setInterval`, `saveDocument`, `signDocumentSignatory`
* **Observed behavior:** Quiet refresh fetches `getAppData` and `setAppData` without versioning. Concurrent refresh started before save may complete after save and overwrite with older snapshot.
* **Expected behavior:** Latest mutation wins; or cancel in-flight refresh on mutation; or use request sequence tokens.
* **Root cause:** No generation counter / abort / merge strategy on `setAppData`.
* **Reproduction steps:**
  1. Supabase mode: save or sign near 15s auto-refresh tick.
  2. UI briefly correct, then reverts until next action.
* **Recommended fix:** Increment `dataVersion` on mutations; ignore stale refresh responses; pause interval during mutations.
* **Acceptance criteria:**
  * [ ] Save/sign result always remains visible after refresh races.
* **Regression risks:** Multi-tab usage, background tab refresh.
* **Suggested tests:** Async test with delayed `getAppData`.
* **Dependencies:** None.

---

### BUG-015: Audit page does not refresh after routing mutations

* **Severity:** Medium
* **Status:** Confirmed
* **Affected area:** `/audit`
* **Files involved:** `src/pages/vrms/VrmsAuditPage.tsx`, `src/context/VrmsAppContext.tsx`
* **Relevant functions/components:** `useEffect` mount-only `getAuditTrail`
* **Observed behavior:** Audit loads once on mount. Save/sign elsewhere does not update audit list while page remains mounted.
* **Expected behavior:** Audit view reflects new events after mutations (via context subscription or navigation refetch).
* **Root cause:** No dependency on `appData` or shared audit cache in context.
* **Reproduction steps:**
  1. Open Audit in one tab or navigate to Audit.
  2. Save/sign on Routing.
  3. Return to Audit without remount — missing new events.
* **Recommended fix:** Expose audit events from `VrmsAppContext` refreshed on mutations, or refetch on `location`/`appData.updatedAt` change.
* **Acceptance criteria:**
  * [ ] New audit events appear without full page reload.
* **Regression risks:** Audit load performance.
* **Suggested tests:** Integration test with context refresh.
* **Dependencies:** BUG-014 if sharing same fetch timing.

---

### BUG-016: Dashboard card refresh/options buttons are non-functional

* **Severity:** Low
* **Status:** Confirmed
* **Affected area:** Dashboard document preview cards
* **Files involved:** `src/pages/vrms/VrmsDashboardPage.tsx`
* **Relevant functions/components:** `DashboardDocumentCard` header buttons
* **Observed behavior:** Refresh and more-options buttons have no `onClick` handlers.
* **Expected behavior:** Refresh reloads section data; options opens menu or is removed.
* **Root cause:** Incomplete UI wiring.
* **Reproduction steps:** Click refresh icon on dashboard card — no action.
* **Recommended fix:** Wire refresh to `useVrmsApp().refresh()` or remove buttons until implemented.
* **Acceptance criteria:**
  * [ ] Refresh triggers data reload or control removed.
* **Regression risks:** None.
* **Suggested tests:** Manual only.
* **Dependencies:** None.

---

### BUG-017: Mock login accepts any password and client-selected role

* **Severity:** High (if mock mode deployed); Low (local dev only)
* **Status:** Confirmed
* **Affected area:** `/login` mock mode
* **Files involved:** `src/services/authService.ts`, `src/pages/LoginPage.tsx`
* **Relevant functions/components:** `mockLogin`
* **Observed behavior:** Password never validated; role selector picks mock user tier including Admin.
* **Expected behavior:** Mock mode acceptable locally only; production must require Supabase env (`isSupabaseConfigured()`).
* **Root cause:** Intentional dev shortcut without deploy guard.
* **Reproduction steps:**
  1. Run without `VITE_SUPABASE_*` configured.
  2. Login as Admin with any credentials.
* **Recommended fix:** Build-time warning; block mock mode on `import.meta.env.PROD`; remove role picker from production builds.
* **Acceptance criteria:**
  * [ ] Production build refuses mock auth.
* **Regression risks:** Local dev workflow, GitHub Pages demo.
* **Suggested tests:** `authService` test for prod guard.
* **Dependencies:** Deployment config review.

---

### BUG-018: Duplicate identical email field branches on login page

* **Severity:** Low
* **Status:** Confirmed
* **Affected area:** `/login` maintainability
* **Files involved:** `src/pages/LoginPage.tsx`
* **Relevant functions/components:** `LoginPage` render — `usesSupabase` ternary with identical JSX
* **Observed behavior:** Two branches render the same email `FormField` (lines 127–149).
* **Expected behavior:** Single email field; conditional blocks only for mock-only controls.
* **Root cause:** Copy-paste during Supabase/mock split.
* **Reproduction steps:** Code inspection.
* **Recommended fix:** Collapse to one email field; keep role `SelectInput` under `!usesSupabase` only.
* **Acceptance criteria:**
  * [ ] Login behavior unchanged; duplicate branch removed.
* **Regression risks:** None.
* **Suggested tests:** None required.
* **Dependencies:** None.

---

## 4. Suspected Risks

### RISK-001: Client-trusted `sessionStorage` user JSON enables permission UI bypass

* **Severity:** High (mock); Medium (Supabase race window)
* **Status:** Suspected
* **Affected area:** Auth bootstrap
* **Files involved:** `src/lib/authSessionStore.ts`, `src/services/authService.ts`, `src/hooks/useAuth.tsx`
* **Evidence:** Full `AuthUser` including `role` stored in `sessionStorage` without integrity check; `AuthProvider` initializes state from cache before `restoreSession` completes.
* **Verification required:** Tamper `gxp-toolkit-user` in DevTools during slow restore; confirm menu access before server validation. Fix path: do not trust cached role for permissions until `restoreSession` completes.

---

### RISK-002: Concurrent VRMS document edits last-write-wins (Supabase)

* **Severity:** Medium
* **Status:** Suspected
* **Affected area:** Multi-user routing edits
* **Files involved:** `src/services/supabaseVrmsService.ts` (`saveDocument`, `signDocumentSignatory`)
* **Evidence:** Read-modify-write over full document set without `updated_at` optimistic locking.
* **Verification required:** Two sessions edit same tracker simultaneously; confirm data loss.

---

### RISK-003: No pagination — large tables render all rows

* **Severity:** Low (performance)
* **Status:** Suspected
* **Affected area:** Database, dashboard, audit tables
* **Files involved:** `src/components/vrms/VrmsDataTable.tsx`, `src/pages/vrms/VrmsDatabasePage.tsx`
* **Evidence:** All documents passed to table; 112+ rows in production bundle.
* **Verification required:** Profile render time with full dataset on mobile; add pagination if >200ms interaction delay.

---

### RISK-004: Hardcoded VRMS user email fallback

* **Severity:** Medium (GxP attribution)
* **Status:** Suspected
* **Affected area:** Audit attribution in edge cases
* **Files involved:** `src/services/vrmsService.ts` — `resolveVrmsUserEmail()`
* **Evidence:** Falls back to `'carlolidres@gmail.com'` when no auth user.
* **Verification required:** Trigger VRMS action without auth context; inspect audit `userEmail` field.

---

### RISK-005: Missing `gxp-logo-full-light.png` asset

* **Severity:** Low
* **Status:** Suspected
* **Affected area:** Branding assets completeness
* **Files involved:** `src/assets/branding/` — PNG variants exist for default full/mark but not light full wordmark
* **Evidence:** `GxpLogo` uses SVG for runtime; PNG set incomplete per original branding requirement.
* **Verification required:** Confirm whether any consumer expects PNG; export from `gxp-logo-full-light.svg` if required.

---

### RISK-006: Stale documentation references removed sample routes

* **Severity:** Low
* **Status:** Suspected
* **Affected area:** Agent navigation
* **Files involved:** `agent-workflow/CODEMAP.md` (lists `ComponentsShowcasePage`, `StatisticsDashboardPage`); `src/app/routes.tsx` no longer includes them
* **Evidence:** HANDOFF notes demo pages removed; CODEMAP not updated.
* **Verification required:** Grep routes vs CODEMAP; update docs only.

---

### RISK-007: OAuth documented but not wired on login/signup

* **Severity:** Low
* **Status:** Suspected
* **Affected area:** Authentication UX
* **Files involved:** `agent-workflow/CONTEXT.md` (OAuth: google, azure); `src/components/auth/AuthProviderButtons.tsx` exists but unused in pages
* **Evidence:** Grep shows no `AuthProviderButtons` usage in `src/pages`.
* **Verification required:** Product decision — implement OAuth or remove from docs/messages (`authMessages.ts` references Google/Microsoft).

---

### RISK-008: Overdue counts may include `Completed` / `For Scanning` documents

* **Severity:** Low
* **Status:** Suspected
* **Affected area:** Dashboard overdue KPI, database `?overdue=1`
* **Files involved:** `src/pages/vrms/VrmsDatabasePage.tsx` (`isOverdue`), `src/data/mockVrms.ts` (`isVrmsOverdue`)
* **Evidence:** Only excludes Sent, In EDMS, Cancelled — not Completed or For Scanning.
* **Verification required:** Compare overdue counts against business rules in `agent-history/version-0-baseline.md`.

---

### RISK-009: `new Date(string)` parsing for VRMS datetime strings

* **Severity:** Low
* **Status:** Suspected
* **Affected area:** Sorting / overdue calculations
* **Files involved:** `src/data/mockVrms.ts`, `src/pages/vrms/VrmsDatabasePage.tsx`
* **Evidence:** Sorts use `new Date(updatedAt)` on `YYYY-MM-DD HH:mm:ss` format strings.
* **Verification required:** Test sorting in Safari; use explicit parser if inconsistent.

---

### RISK-010: Broad authenticated read RLS on VRMS template tables

* **Severity:** Medium (when Supabase populated)
* **Status:** Suspected
* **Affected area:** Supabase data isolation
* **Files involved:** `supabase/migrations/20260617000000_vrms_schema.sql`
* **Evidence:** Policies like `USING (true)` for authenticated read on documents/registry.
* **Verification required:** Confirm against baseline whether all authenticated users may read all VRMS rows; tighten if row-level isolation required.

---

## 5. Cursor Execution Plan

### Phase 1 — Critical and security defects

**Bug IDs:** BUG-001, BUG-010, BUG-008, BUG-009

**Files likely modified:**
- `supabase/migrations/<new>_profiles_role_update_fix.sql`
- `supabase/migrations/<new>_remove_signup_admin_bootstrap.sql`
- `supabase/migrations/<new>_restrict_check_temporary_password_rpc.sql`
- `supabase/functions/admin-reset-password/index.ts`
- `src/config/authPasswordPolicy.ts`, `src/pages/LoginPage.tsx`

**Database migrations:** Required — new forward-only Supabase migrations only; do not edit applied migrations.

**Environment changes:** Move default reset password to server secret; no `VITE_*` secrets.

**Tests before Phase 2:**
- `npm run type-check`
- `npm run test`
- `npm run build`
- Manual SQL policy test for role self-update denial

---

### Phase 2 — Broken core workflows

**Bug IDs:** BUG-002, BUG-003, BUG-011, BUG-017

**Files likely modified:**
- `src/pages/vrms/VrmsRoutingPage.tsx`
- `src/utils/vrmsLogic.ts`
- `src/lib/authMapping.ts`
- `src/services/authService.ts`
- `src/lib/vrmsDefaults.ts`

**Database migrations:** None unless role mapping aligned with DB.

**Tests before Phase 3:**
- Extend `src/utils/vrmsLogic.test.ts` (validation + dirty sign guard)
- `npm run test`, `npm run build`

---

### Phase 3 — Data, filtering, and state-management defects

**Bug IDs:** BUG-004, BUG-012, BUG-013, BUG-014, BUG-015, BUG-006, BUG-007

**Files likely modified:**
- `src/pages/vrms/VrmsDatabasePage.tsx`
- `src/pages/vrms/VrmsAuditPage.tsx`
- `src/context/VrmsAppContext.tsx`
- `src/hooks/usePermissions.tsx`
- `src/hooks/useAuth.tsx`
- `src/services/supabaseVrmsService.ts`, `src/services/vrmsStore.ts`

**Tests before Phase 4:**
- New search helper test
- Context refresh race test (if feasible)
- `npm run test`, `npm run verify:vrms-csv`

---

### Phase 4 — UI, responsiveness, and edge cases

**Bug IDs:** BUG-005, BUG-016, RISK-005

**Files likely modified:**
- `src/pages/vrms/VrmsDashboardPage.tsx`
- `src/assets/branding/` (PNG export if needed)

**Tests before Phase 5:**
- Manual responsive check on dashboard cards
- `npm run build`

---

### Phase 5 — Cleanup and maintainability

**Bug IDs:** BUG-018, RISK-006, RISK-007

**Files likely modified:**
- `src/pages/LoginPage.tsx`
- `agent-workflow/CODEMAP.md`
- `agent-workflow/CONTEXT.md` (if OAuth out of scope)

**Tests:** `npm run test`, `npm run build`

---

## 6. Cursor Handoff Prompt

Copy and paste the following into Cursor to execute remediation:

```text
Follow AGENTS.md workflow (read CONTEXT.md, HANDOFF.md, CODEMAP.md as needed).

Read and execute fixes from: BUG_AUDIT_HANDOFF.md

Rules:
- Fix findings in phase order (Phase 1 → 5) and by bug dependency notes.
- Make minimal, targeted changes only — no unrelated refactoring.
- Preserve existing working behavior outside each fix scope.
- For Supabase: add NEW migrations only; never edit applied migrations.
- Do not expose secrets, service-role keys, or passwords in client code or VITE_* vars.
- Do not disable RLS, auth, or validation to make tests pass.
- Add or update focused unit tests for each non-trivial fix.
- Run after each phase: npm run type-check, npm run test, npm run build (and verify:vrms-csv if VRMS data touched).

When complete, update BUG_AUDIT_HANDOFF.md with:
- Fixed items (bug ID + commit summary)
- Deferred items (with reason)
- Verification results table
- Remaining risks

If a database schema, credential, migration state, or business rule cannot be verified from the repo, STOP and document the blocker in BUG_AUDIT_HANDOFF.md — do not guess.

Start with Phase 1: BUG-001 (profiles role self-elevation RLS).
```

---

## Audit Limitations (not verified in this pass)

- No browser manual testing or responsive breakpoint matrix
- No live Supabase project RPC/RLS execution (findings from migration SQL + client code static analysis)
- No lint (script not configured)
- No `verify:schema` / `verify:supabase` / Graphify scripts in root `package.json`
- No performance profiling or memory-leak instrumentation
- OAuth flows not tested (UI not wired)
- GitHub Pages deployment not re-checked (HANDOFF records prior HTTP 200)

---

## 7. Remediation Status (2026-06-26)

Executor: Cursor agent session  
Scope: Phases 1–5 implemented in repo; **migrations not applied to live Supabase** (owner action required).

### Fixed

| Bug ID | Summary |
|--------|---------|
| BUG-001 | New migration drops broad self-update policy; `profile_self_update_allowed` restricts non-admin updates to `display_name` only |
| BUG-002 | Routing sign blocked when form has unsaved changes; snapshot tracking after load/save |
| BUG-003 | `validateRoutingPayload()` wired to `applySaveDocument` and routing submit |
| BUG-004 | `buildDocumentSearchHaystack()` flattens signatory names for database search |
| BUG-005 | Dashboard preview tables slice to 10 rows; footer count matches rendered rows |
| BUG-006 | Permission load failure sets empty permissions (fail closed) |
| BUG-007 | Auth restore timeout clears unverified `sessionStorage` cache |
| BUG-008 | `check_temporary_password_required` revoked from `anon`; requires authenticated self match |
| BUG-009 | Removed client password constant/UI; edge function requires `DEFAULT_RESET_PASSWORD` secret |
| BUG-010 | Signup/`get_own_profile` no longer auto-assign admin (designated email seed only) |
| BUG-011 | DB `user` role maps to client `Viewer` |
| BUG-012 | Registry defaults seed only when registry table is empty |
| BUG-013 | Supabase registry delete skips audit when zero rows removed |
| BUG-014 | `mutationEpoch` ignores stale auto-refresh responses after mutations |
| BUG-015 | Audit page refetches on `dataRevision` from VRMS context |
| BUG-016 | Dashboard card refresh wired to `refresh()`; options button removed |
| BUG-017 | Mock auth blocked in `import.meta.env.PROD` builds |
| BUG-018 | Login page duplicate email branches collapsed |

### Deferred

| Item | Reason |
|------|--------|
| RISK-001–RISK-010 | Suspected only; need runtime/product-owner verification |
| RISK-006 (CODEMAP drift) | Low priority doc sync; demo routes already removed from `routes.tsx` |
| RISK-007 (OAuth) | Product decision — UI not wired |
| Live Supabase RLS/RPC verification | Migrations exist locally; owner must `supabase db push` / apply and run `supabase/scripts/verify_profiles_rls.sql` |
| `DEFAULT_RESET_PASSWORD` secret | Owner must set via `supabase secrets set` before admin reset edge function works |

### Verification (post-remediation)

| Check | Result |
|-------|--------|
| `npm run type-check` | **Pass** |
| `npm run test` | **Pass** — 34 tests |
| `npm run build` | **Pass** — chunk-size warning only |
| `npm run verify:vrms-csv` | **Pass** |
| Live Supabase policy test | **NOT_RUN** — requires applied migrations + project access |
| Browser E2E | **NOT_RUN** |

### Remaining risks

- Concurrent document last-write-wins (RISK-002) unchanged
- Broad authenticated VRMS read RLS (RISK-010) unchanged — confirm against baseline
- Permission fail-closed may hide menus until retry; no user-visible banner yet (BUG-006 partial UX)
- Registry defaults re-seed if an environment deletes **all** registry rows (edge case)
