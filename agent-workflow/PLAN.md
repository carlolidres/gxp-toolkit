# Active Plan

Last Updated: `2026-06-21`
Plan Owner: `Codex`
Status: `COMPLETE`

## Objective

Align Supabase migration prep with `reference/supabase/migrations`, keep CSV/app data verification and GitHub Pages deployment scaffolding ready, and avoid applying external migration/deployment without approval.

## Approval and GxP Gate

- GxP impact: `YES`
- Approved task plan: `NOT_AVAILABLE`
- Approval status: `HANDOFF_REQUEST`
- Approver and date: `N/A`

Implementation note: no live Supabase migration, deployment, push, or production data import was performed. Work was limited to local verification, data-bundle repair, and prep artifacts.

## Ponytail Simplicity Gate

- [x] Requirement is necessary now; migration/deployment prep was requested.
- [x] Existing app data bundle and service expectations were reused.
- [x] No new runtime dependency was added.
- [x] Migration prep was kept as SQL/scripts instead of applying changes to external systems.
- [x] Verification scripts were added for repeatable CSV/data checks.

Chosen rung and rationale:

`REUSE + MINIMUM PREP — Verify the existing bundle, repair the audit mapping from source CSV, and add migration/deploy artifacts without touching live services.`

## Scope

Included:

- Verify the ten listed VRMS CSV files against `src/data/vrmsProductionData.json`.
- Repair audit event semantic field alignment from `VRMS - AuditTrail.csv`.
- Add Supabase schema/RLS migration prep matching the current app service layer.
- Add a local seed SQL generator for the app data bundle.
- Add GitHub Pages workflow for `carlolidres/gxp-toolkit`.
- Update data map, handoff, and versioned handoff.

Excluded:

- Applying Supabase migrations or seed SQL.
- Deploying to GitHub Pages.
- Committing/pushing to GitHub.
- Rewriting the unapproved baseline.
- SQLite schema implementation; existing SQLite files remain placeholders.

## Acceptance Criteria

- [x] All listed CSV row counts match the app bundle.
- [x] Audit event `routingTracker`, `docTracer`, and `details` fields are semantically aligned.
- [x] Supabase migration prep exists under `supabase/migrations/` and matches the reference migration sequence.
- [x] Local seed generator produces `supabase/seed.vrms.generated.sql`.
- [x] GitHub Pages workflow exists under `.github/workflows/`.
- [x] App tests and build pass after data repair.

## Implementation Steps

- [x] 1. Read required startup files plus `DATA_MAP.md`, baseline, active plan, and approved-plan slot.
- [x] 2. Inspect CSV inventory, SQLite placeholders, app data bundle, and Supabase services.
- [x] 3. Add CSV verification, audit repair, Supabase seed-generation scripts.
- [x] 4. Replace the consolidated migration prep with the reference Supabase migration sequence and keep GitHub Pages workflow.
- [x] 5. Run verification and app checks.
- [x] 6. Update `DATA_MAP.md`, `PLAN.md`, `HANDOFF.md`, and versioned handoff.

## Expected Files

| Path | Expected change |
|---|---|
| `src/data/vrmsProductionData.json` | Audit fields repaired from source CSV |
| `scripts/verify-vrms-csv-bundle.mjs` | CSV/app bundle verification |
| `scripts/repair-vrms-audit-bundle.mjs` | Deterministic audit repair from CSV |
| `scripts/generate-vrms-supabase-seed.mjs` | Local Supabase seed SQL generator |
| `supabase/migrations/20260616000000_initial_gxp_toolkit_schema.sql` through `20260618400000_fix_profiles_rls_row_security.sql` | Reference Supabase migration sequence |
| `supabase/README.md` | Migration prep instructions and approval gate |
| `.github/workflows/deploy-pages.yml` | GitHub Pages build/deploy workflow |
| `package.json` | Added verification/seed scripts |
| `.gitignore` | Ignore generated Supabase seed SQL |
| `agent-workflow/DATA_MAP.md` | Real data/migration map |
| `agent-workflow/HANDOFF.md` | Completion and verification record |
| `agent-history/version-3-handoff.md` | Versioned implementation checkpoint |

## SQLite Impact

- Impact: `REVIEW_ONLY`
- Editable SQL: `NONE`
- Generated map target: `NONE`
- Map command: `NOT_APPLICABLE`
- Rollback: `N/A`

SQLite remains placeholder-only; Supabase is the prepared migration target for this task.

## Security and Compliance Impact

```text
AUTHENTICATION | AUTHORIZATION | AUDIT | DATA_INTEGRITY | DEPLOYMENT
```

Details:

`Supabase RLS prep was added but not applied. GitHub Actions uses repository secrets for Vite Supabase config. Generated seed SQL is ignored because it contains imported VRMS records. The baseline remains unapproved/template-like, so migration and deployment require owner approval before execution.`

## Verification Plan

- [x] CSV/app data verification: `npm run verify:vrms-csv`
- [x] Seed generation: `npm run supabase:seed:vrms`
- [x] Lint: `NOT_CONFIGURED`
- [x] Type-check: covered by `npm run build`
- [x] Unit/self-check: `npm run test`
- [x] Production build: `npm run build`
- [x] SQLite schema-map sync: `NOT_APPLICABLE`
- [x] Deployment: `NOT_RUN`

## Risks, Dependencies, and Blockers

- Risk: `Reference Supabase migration sequence has not been applied or integration-tested against a live project in this workspace.`
- Risk: `GitHub Pages workflow has not been run because no commit/push/deployment was requested and Git is not recognized locally.`
- Risk: `Baseline and approved task plan remain template-like; production-regulated use requires owner approval.`
- Risk: `Build still reports Vite chunk-size warning; build passes.`
- Blocker: `Git commands still fail: this folder is not recognized as a Git repository.`

## Completion Notes

All ten CSV exports are represented in the app bundle by row count. Audit data alignment was repaired and guarded by `npm run verify:vrms-csv`. Supabase migration prep now follows `reference/supabase/migrations`; no external migration, deployment, commit, or push occurred.
