# Current Handoff

Last Updated: `2026-07-11`
Version: `v34`
Branch: `main` / `master`
Commit: `5d67b2e` — ui: APQR Database filters, grid cards, and compact status icons
Deployment: `DEPLOYED` — GitHub Pages run [29133348277](https://github.com/carlolidres/gxp-toolkit/actions/runs/29133348277) (2026-07-11)

## Current Status

**APQR Dashboard panels layout** — Chart section restyled to match reference (`screenshot/ChatGPT Image Jul 11, 2026, 11_08_17 AM.png`): left main grid (Triage + Trend on top, Performance spanning below) with full-height Upcoming Actions on the right. Top-row Triage/Trend cards stretch to equal height; panel bodies flex-fill. Panel headers with icons; Performance metric tiles beside the bar chart; circular action icons. Responsive: stacks at ≤1200px / ≤900px / ≤720px with fluid gap/padding.

**Client Registry select text centering** — APQR Package / Date Calculation switched from Ant Design 6 `Select` to native `<select>` (Ant 6 content layout clipped/misaligned value text). Styled with `appearance: none`, matched 39px control height, and optical padding so labels sit mid-field on Windows.

**Client Auto-Compute / Manual Dates** — Registry **Date Calculation** beside APQR Package (`auto_compute_dates`). Auto: −60d/+30d/+90d. Manual: Pullout = coverage end − 2 months; Generation = Commitment − 2 months; Commitment change updates Generation; Generation does not change Commitment. Scheduler follows client setting; Database filters use the same Auto/Manual linking. Column applied on linked Supabase via MCP (`apqr_client_auto_compute_dates`); local migration file `20260711120000_apqr_client_auto_compute_dates.sql` (CLI `db push` still blocked by remote history drift).

**APQR coverage remarks** — Form Product & Schedule shows “Why not 12 months” under Review Coverage when the range is not a standard year (or a reason is stored). Scheduler Review coverage section has a textarea to view/edit/add `review_coverage_adjustment_reason`; view dialog shows it too.

**APQR Database Client filter** — Filter panel Client select (replaces Department) lists unique clients from loaded rows by `client_code`; matches on code.

**APQR Database month-year date filters** — **Auto-Compute Dates** (default on): Pullout/Generation sync from coverage end (−60d / +30d); **Commitment is always Generation + 2 months**. Table matches the last-changed linked field using computed coverage-end dates (commitment driver uses generation month + 2). When off: clears three dates; independent stored-date filters.

**APQR Database grid cards** — Card layout aligned to `screenshot/sample UI.png`: APQR ID + delivery status header, bold client / muted product, 2×2 meta panel with department icons and green commitment date, send + edit action buttons.

**APQR compact status icons** — Delivery, priority, and report status badges render as borderless one-line icons with hover tooltips (full name + description). Filter/sort option text and accessible labels keep complete status names.

**APQR Database date filters** — Filter panel adds Pullout Date, APQR Generation Date, and Commitment Date. APQR Cycle Year filters by commitment date calendar year (aligned with Scheduler). `apqr_generation_date` included on database rows.

**VRMS Database UI polish** — Toolbar stays on one responsive row; table uses fixed layout with ellipsis headers; table wrap capped to viewport height with internal scroll and sticky headers.

**Document Routing Form UI polish** — Light/dark restyle of Document Routing Form + Signatories Tracker to match `screenshot/Routing Forms.png`: panel headers with theme-aligned icons, 2-column field grid, label icon spacing, required asterisks, remarks char counter display, Submit/Clear icons, signatories empty state, Signed/Remove on one row, status pills, footnote. Field handlers/disabled rules/validation unchanged.

**v34 release** — Ant Design 6 UI migration; APQR Scheduler cycle-year filter, search, manual dates, full-cycle table; editable Tabulation Status Date; blank coverage defaults; atmospheric light/dark backgrounds. App version history set to `v34`.

**APQR Scheduler table loads all cycle rows** — Removed per-page pagination; table shows every entry for the selected APQR Cycle Year (scrollable). Footer shows entry count only.

**APQR Form Tabulation Status Date** — Field is editable via date picker; value persists on save. Changing Stability Tabulation Status auto-fills today only when the date is empty.

**APQR Scheduler cycle year filter** — Interactive APQR Cycle Year select in schedule table heading. Filters rows by Commitment Date calendar year (e.g. commitment in 2027 → cycle 2027). Defaults to current calendar year on load / client change.

**APQR Scheduler manual date entry** — Checkbox on Calculated dates (upper right). Unchecked (default): dates blank until coverage end, then auto-calculate and read-only. Checked: editable; Submit requires all three dates. Existing override rows load with checkbox on.

**APQR Scheduler table search** — Global filter search bar in schedule table heading; filters product/code/status/coverage/dates/APQR ID. Export uses filtered rows; Save All still saves all. Empty-state when no matches.

**APQR Scheduler coverage defaults** — Review Coverage From/To start blank on new/cleared forms; both required before Submit. Calculated dates stay blank until coverage end is set. Guards added for empty coverage in `computedScheduleDates` / `reviewCoverageNeedsReason`.

**Atmospheric theme backgrounds** — Light and dark modes use a subtle animated body-level atmosphere: morning daylight + soft cloud washes in light; clean night + gentle moonlight in dark. Pure CSS (`body::before` / `body::after`); shell/main/login-panel transparent so atmosphere shows; cards/sidebar stay opaque. Respects `prefers-reduced-motion`. Ant Design `appBg` tokens aligned.

**v33 release** — Admin-approved password reset (forgot → admin Messages notify → Reset Password → emailed temp password), 24h purge of acknowledged Messages, auth UI refresh (Remember me removed), User Management / VMP / Messages modernization. App version history set to `v33`.

**Admin-approved password reset (v33.6)** — Self-service temporary-password issuance removed. Forgot password only records `profiles.password_reset_requested_at` and notifies admins via `app_feedback_messages`. User Management shows **Reset Password** only when a request is pending. Admin approval generates a random 16-char temp password, emails it via **Gmail SMTP** (`nodemailer` + App Password), sets `must_change_password`, clears the pending flag. User must change password after temp login. Migration applied + edge functions redeployed on linked project `ydndeoacgfnxjqwwnswh`.

**Auth pages UI refresh (v33.5)** — Login, Sign-up, Forgot password, and Reset password aligned to `screenshot/Login Page.png`: icon field labels, remember-me + session hint row, full-width primary CTA, OR divider, side-by-side ghost secondary actions. New route `/forgot-password` (`ForgotPasswordPage.tsx`); reset flow moved off the login card. Shared helpers in `auth-form-shared.tsx` + `login-page.css`. Remember-me is UI-only (sessions remain tab-scoped / 15-min inactivity per existing policy).

**UI modernization batch (v33.4)** — Tailwind CSS + Lucide refresh across User Management, login/sign-up auth cards, VMP Masterlist Form, and Messages modal; removed sidebar environment indicator. VMP form adds editable combobox suggestions for group/subcategory and responsible owner.

**User Management UI modernization** — `/admin/users` refreshed with Tailwind CSS + Lucide icons: scrollable user list with role badges and count pill, selected-user summary card, unsaved-changes indicator, improved form controls and info callouts, permission matrix with group/menu/action icons, sticky menu column, focus-visible states, responsive single-column layout on small screens. All save/reset/password/permission logic unchanged.

**Supabase security — `schema_migrations` RLS** — enabled RLS on `public.schema_migrations`, revoked `anon`/`authenticated` grants. Tooling-only table; no client API access. Linter ERROR `rls_disabled_in_public` cleared (INFO `rls_enabled_no_policy` is intentional deny-by-default).

**Topbar version history drawer** — info icon left of bell opens right-side release notes drawer with curated version timeline and developer attribution (Carlo M. Lidres). Topbar actions modernized: clustered icon/account groups, divider, focus-visible states, improved profile typography.

**APQR fixture data cleared** — clients, scheduler entries, records, follow-ups, audit events, and ID sequences removed from seed files, mock JSON, and linked Supabase. Menu permissions unchanged.

**APQR Client Registry + Database UI refreshed — stacked forms, summary cards, table hierarchy, filter/count pills.**

Primary menu submenus: Dashboard, Client Registry, APQR Scheduler, APQR Database, APQR Form, **Audit Trail**.

## APQR Module

| Area | Status | Notes |
|------|--------|-------|
| Dashboard chart layout | `PASSED` | Reference grid: Triage+Trend top, Performance full-width below, Upcoming Actions full-height right; fluid gaps |
| Dashboard KPI cards | `PASSED` | Container-query responsive grid, vertical card layout, trend pills |
| Dashboard Upcoming Actions | `PASSED` | Fixed height, scrollable list, tone-accent cards |
| Dashboard Triage Table | `PASSED` | Single-line toolbar, pagination, sticky header, drag-resize columns (`localStorage`) |
| APQR Form sample UI | `PASSED` | Lookup + record status, client/product cards, 5-col report grid, searchable Sent By combobox with saved suggestions, delay/overdue alerts, remarks counter, follow-up CRUD |
| APQR Database sample UI | `PASSED` | Summary card hierarchy, record count pill, filter/columns icons, link tiers, compact status pills, empty states, sticky freeze-pane header, ~10-row scroll viewport |
| Audit Trail submenu | `PASSED` | `/apqr/audit` — searchable activity log, value diff styling, count pill, empty states |
| Audit writes | `PASSED` | Client, scheduler, record, follow-up, archive actions |
| Monthly delivery charts | `PASSED` | Line trend + on-time/overdue stacked bar chart on Dashboard |
| Dashboard sample UI | `PASSED` | KPI board, chart stack, upcoming actions scroll, triage table pagination/toolbar |
| Client Registry sample UI | `PASSED` | Stacked form grid, searchable Account Manager combobox, structured QA/Technical/Regulatory contact cards (Name, Title, Email, +/-), mode badge, count/filter pills |
| APQR Scheduler sample UI | `PASSED` | Searchable client picker, summary card, info banner, inline add/edit rows, status badges, pagination, export |
| Follow-up reminders | `PASSED` | 7-day cycle; due list on Dashboard; Add Follow-Up on Form |
| Archive with reason | `PASSED` | Saved scheduler rows require reason; soft-archive + audit |
| Delay category prompts | `PASSED` | Required when Final Delivery after Commitment |
| Supabase migrations | `PASSED` | `20260704120000`, `20260704130000` pushed |
| Supabase seed | `CLEARED` | 0 clients, 0 scheduler, 0 records — regenerate with `npm run apqr:seed` then `npm run apqr:seed-supabase` |
| Menu permissions | `PASSED` | `npm run apqr:seed-permissions` |

## Verification

| Check | Status | Result |
|---|---|---|
| `npm run type-check` | `PASSED` | 2026-07-11 — APQR dashboard panels layout |
| `npm run test` (dateUtils) | `PASSED` | 2026-07-11 — month-year helpers (6/6) |
| `npm run type-check` | `PASSED` | 2026-07-11 — month picker filters |
| `npm run test` (apqrDashboard) | `PASSED` | 2026-07-10 — commitment-based cycle year helpers (8/8) |
| `npm run type-check` | `PASSED` | 2026-07-10 — manual date entry checkbox + scheduler search + blank coverage |
| `npm run build` | `PASSED` | 2026-07-10 — atmospheric backgrounds |
| Browser light/dark atmosphere | `PASSED` | Login + VRMS dashboard; morning washes + moonlight layers confirmed |
| `npm run test` (narrow) | `PASSED` | mockFeedbackService.purge + passwordReset (2/2) — prior session |
| Supabase migration `feedback_ack_purge_24h` | `PASSED` | Applied via MCP on `ydndeoacgfnxjqwwnswh` |
| `supabase db push` | `BLOCKED` | Remote versions `20260708123542`, `20260709103218` missing locally — repair/pull needed |
| `npm run db:map` | `PASSED` | 30 tables (prior session) |
| `npm run verify:schema` | `FAILED` | Pre-existing mock/seed ID mismatch (users/documents); unrelated |
| Edge functions `forgot-password`, `admin-reset-password` | `DEPLOYED` | Linked project; admin-reset uses Gmail SMTP |
| `npm run test` full | `NOT_RUN` | Not required for CSS atmosphere change |

## Next Action

1. Owner visual check: Registry Date Calculation; Scheduler Manual Dates; Database Auto/Manual filters.
2. Owner visual check: APQR Form coverage remarks; Database Client filter; grid cards.
3. Repair local/remote migration history (`20260708123542`, `20260709103218`, `20260709112155`) when doing Supabase CLI work.


## eDoc Rollout Progress

| Phase | Status | Notes |
|-------|--------|-------|
| 1 — SQLite reference | `PASSED` | `edoc_schema.sql`, `edoc_seed.sql`, `db:map` → 24 tables |
| 2 — Staging Supabase | `PASSED` | Migrations through `20260704100000` applied to linked project |
| 2b — Edge Functions | `PASSED` | `edoc-file-access`, `edoc-sign-document`, `edoc-create-certificate` deployed |
| 2c — RLS static validation | `PASSED` | `verify_edoc_rls.sql` |
| 3 — Manual RLS scenarios | `PASSED` | `verify_edoc_rls_manual.sql` — 3.1, 3.2, 3.3, 3.5 (3.4 storage manual) |
| 4 — Browser smoke | `PASSED` | Disposable test accounts provisioned; `e2e:edoc-staging` 4/4 (2026-07-04) |
| 5 — Menu permissions (test accounts) | `PASSED` | `seed_edoc_staging_test_accounts.sql` |
| 6 — Org membership seed | `PASSED` | `staging-edoc-org` + test `@example.test` members |

## Recently Completed (this session)

- User Management page modernized: Tailwind layout, Lucide icons, role badges, permission matrix icons/sticky menu column — `UserManagementPage.tsx`, `PermissionMatrix.tsx`, `user-management.css`
- APQR Client Registry contact roles grid: independent column heights (`align-items: start`), per-column scroll, responsive `auto-fit` columns — deployed v33.2
- APQR seed cleared: `database/sqlite/apqr_seed.sql`, `supabase/scripts/seed_apqr_data.sql`, `src/data/apqrSeedData.json`; linked Supabase wiped via `npm run apqr:seed-supabase`
- `database/sqlite/edoc_schema.sql` — 19 eDoc tables mirroring Supabase migration
- `database/sqlite/edoc_seed.sql` — pilot org/document/route fixtures
- `scripts/verify-edoc-sqlite.mjs` + `npm run verify:edoc-sqlite`
- `supabase/scripts/verify_edoc_rls.sql` — static RLS/schema validation
- `docs/edoc/STAGING_CHECKLIST.md` — step-by-step staging guide
- Restored `npm run db:map`, `db:init`, `db:update`, `verify:schema` in `package.json`
- Idempotent fix: `20260626100000_profiles_role_self_update_fix.sql` (DROP POLICY before CREATE)
- Staging apply: 5 pending migrations including eDoc module
- `baseline-.md` §11 eDoc Module Rollout
- `supabase/scripts/seed_edoc_pilot.sql` — org, RLS fixture, pilot permissions
- `supabase/scripts/verify_edoc_rls_manual.sql` — Phase 3 JWT simulation tests
- `docs/edoc/PILOT_PERMISSIONS.md` — pilot user matrix
- `docs/edoc/STAGING_TEST_ACCOUNTS.md` — disposable account policy + setup
- `scripts/provision-edoc-staging-test-users.mjs` — create `@example.test` auth users
- `supabase/scripts/seed_edoc_staging_test_accounts.sql` — fixtures + permissions
- `supabase/scripts/revert_edoc_real_user_pilot.sql` — detach real users from pilot seed
- `tests/e2e/edoc-staging-smoke.spec.ts` — Playwright smoke (no real emails)
- `playwright.edoc-staging.config.ts`

## Verification

| Check | Status | Result |
|---|---|---|
| `npm run db:map` | `PASSED` | 24 tables, 71 FKs, 15 indexes (2026-07-04) |
| `npm run verify:edoc-sqlite` | `PASSED` | 19/19 tables; live apply skipped (no sqlite3 CLI) |
| `supabase db push` | `PASSED` | Through `20260704100000_edoc_supabase_module.sql` |
| `verify_edoc_rls.sql` (linked) | `PASSED` | Static checks on remote (2026-07-04) |
| `verify_edoc_rls_manual.sql` | `PASSED` | 3.1–3.3, 3.5 on staging (2026-07-04) |
| `edoc:revert-real-user-pilot` | `PASSED` | Real users detached (2026-07-04) |
| `edoc:provision-test-users` | `PASSED` | 3 `@example.test` users created |
| `edoc:seed-staging-test` | `PASSED` | Fixtures + permissions |
| `verify_edoc_phase4_browser.sql` | `PASSED` | Reviewer inbox + creator permission |
| `verify_edoc_rls_manual.sql` | `PASSED` | Test account auth IDs (2026-07-04) |
| `npm run e2e:edoc-staging` | `PASSED` | 4/4 after test assertion fixes |
| Browser smoke (Phase 4) | `PASSED` | Disposable accounts only |
| Storage RLS test 3.4 | `NOT_RUN` | Manual via `edoc-file-access` Edge Function |

## Files Changed (this session)

| Area | Paths |
|---|---|
| SQLite eDoc reference | `database/sqlite/edoc_schema.sql`, `edoc_seed.sql`, `schema.sql` (header) |
| Scripts | `scripts/generate-sqlite-map.mjs`, `db-init.mjs`, `verify-edoc-sqlite.mjs` |
| npm scripts | `package.json` |
| Supabase | `supabase/scripts/verify_edoc_rls.sql`, migration idempotency fixes |
| Docs | `docs/edoc/STAGING_CHECKLIST.md`, `baseline-.md`, `agent-workflow/HANDOFF.md`, `DATA_MAP.md` |

## Next Action

1. **Storage RLS test 3.4** — manual via `edoc-file-access` Edge Function
2. Deploy frontend to GitHub Pages when ready
3. Test account password is in **`.env.local`** only (`STAGING_EDOC_TEST_PASSWORD` / `E2E_EDOC_TEST_PASSWORD`) — do not commit

## Risks / Limitations

- ~~Supabase security advisor: `edoc_*` RPCs callable by `anon`~~ **Fixed** in `20260704110000_edoc_security_hardening.sql`
- ~~`edoc_assignment_inbox` view flagged as SECURITY DEFINER~~ **Fixed** — `security_invoker=true`
- eDoc service falls back to mock data when Supabase env vars are unset
- PDF signing production features deferred per `docs/edoc/IMPLEMENTATION_PLAN.md`
- Test 3.4 (storage signed URL) still manual

## UI Migration: Ant Design 6

- Migrated remaining VRMS, VMP, eDoc, and APQR page chrome to Ant Design 6 while retaining route links, permission checks, service calls, exports, and validations.
- Replaced straightforward buttons, inputs, selects, feedback, cards, and audit/field-options tables; custom keyboard-driven pickers and resizable tables remain native where their existing event behavior is required.
- Verification: `npm run type-check` passed after each module group (2026-07-10).
- Commits: `ab1c611` (VRMS), `a7e48df` (VMP), `94fbbe0` (eDoc), `d049823` (APQR).
