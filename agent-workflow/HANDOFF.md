# Current Handoff

Last Updated: `2026-07-08`
Version: `v33.4`
Branch: `main` / `master`
Commit: `6dba34d` — v33.4: modernize admin, auth, VMP form, and messages UI
Deployment: `PENDING` — push to `master` triggers GitHub Pages workflow

## Current Status

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
| Dashboard chart layout | `PASSED` | Delivery Trend stacked above Performance; 6px stack gap; reference-style charts + summary footers |
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
| `npm run build` | `PASSED` | 2026-07-08 — User Management UI refresh |
| `npm run test` | `PASSED` | 119/119 (2026-07-08) |
| `supabase db push` | `PASSED` | Remote up to date (20260705120000–20260705223000) |
| `npm run apqr:seed-supabase` | `PASSED` | Remote APQR data cleared (DELETE-only script) |
| `npm run apqr:seed-permissions` | `PASSED` | Admin + edoc-creator APQR menus |

## Next Action

1. Browser smoke on `/admin/users` (user selection, role change, permission toggles, save/reset, password reset).
2. Browser smoke on `/apqr/database` (summary cards, filters, columns, list/grid, pagination).
2. Browser smoke on `/apqr/registry` (form layout, filters, pagination, edit flow).
2. Re-run `npm run test` if greeting/apqrDelivery timeouts recur.
3. Deploy frontend when ready.

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
