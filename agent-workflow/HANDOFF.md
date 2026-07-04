# Current Handoff

Last Updated: `2026-07-04`
Version: `v25`
Branch: `main` / `master`
Commit: `(uncommitted — eDoc Phase 4 uses disposable staging test accounts)`
Deployment: `PENDING` — eDoc staging backend applied; frontend deploy not run this session

## Current Status

**eDoc rollout — Phase 1–3 complete. Phase 4 uses disposable `@example.test` accounts only (no real users for smoke/Playwright).**

Real-user pilot seed (`seed_edoc_pilot.sql`) is deprecated. Use `docs/edoc/STAGING_TEST_ACCOUNTS.md`.

Prior: VRMS/VMP stable; Computerized Systems VMP dropdown fixes (v22).

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
