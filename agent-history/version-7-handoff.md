# Current Handoff

Last Updated: `2026-06-22 19:16 Asia/Taipei`
Version: `v7`
Branch: `master`
Commit: `NOT_COMMITTED; last deployed commit e304552`
Deployment: `SUCCESS; https://carlolidres.github.io/gxp-toolkit/ returned HTTP 200`

## Current Status

GitHub Pages deployment is live. The project now includes the new local approval workflow app under `workflow-app/`, copied from `reference/workflow-app`, with npm scripts for local launch, schema validation, and smoke testing. Supabase Auth redeploy/retest remains the next app-runtime action from the previous handoff.

## Recently Completed

- Initialized the local Git repository on `main` and added `origin` at `https://github.com/carlolidres/gxp-toolkit.git`
- Committed and pushed the prepared GxP Toolkit app to `origin/main`
- Confirmed GitHub Actions build on `main` passed install, test, build, and artifact upload
- Identified the Pages environment branch policy: only `master` may deploy to `github-pages`
- Updated `.github/workflows/deploy-pages.yml` to run on `master`, matching the Pages environment branch policy
- Fetched and merged existing `origin/master` history using `--allow-unrelated-histories`
- Removed accidentally staged broad `reference/` material from the unpushed merge commit; tracked reference material is limited to VRMS CSV inputs and reference Supabase migrations
- Pushed final deployment state to `origin/master`
- Confirmed both triggered Pages runs completed successfully, then removed the older duplicate workflow so future pushes use one deploy workflow
- Verified `https://carlolidres.github.io/gxp-toolkit/` returned `HTTP 200` with title `GxP Toolkit`
- Sanitized reviewer feedback in this handoff to remove a pasted password and long console stack traces
- Added a focused auth-message guard/test for Supabase Auth `401 Unauthorized` deployment-secret failures
- Updated GitHub Actions Supabase secret names from `.env.local` after explicit approval; values were not printed
- Added `workflow-app/` as the local approval workflow utility with Python/SQLite server, static UI, schema, validation check, and smoke check
- Added npm scripts: `workflow:dev`, `workflow:validate`, and `workflow:smoke`
- Gitignored local workflow runtime state: `workflow-app/config.json`, `workflow-app/data/`, `project-files/`, and `agent-history/baseline-backups/`
- Updated agent maps so future agents know the workflow app is local utility state, not production VRMS data

## Active Work

- Objective: `Apply the new local workflow app from reference/workflow-app`
- Progress: `IMPLEMENTED_LOCALLY`
- Remaining: `Use npm run workflow:dev to open the local workflow UI when needed; redeploy/retest Supabase Auth remains separate prior work`

## Minimal Read Set for the Next Agent

List no more than five task-specific files; omit standard startup files.

| Path | Reason |
|---|---|
| `.github/workflows/deploy-pages.yml` | GitHub Pages workflow, enabled for the Pages-allowed `master` branch |
| `agent-history/version-6-handoff.md` | Auth feedback and deployment-secret checkpoint |
| `workflow-app/` | Local approval workflow utility copied from reference |
| `agent-workflow/PLAN.md` | Migration/deployment prep scope, verification, and GxP gate note |
| `agent-workflow/DATA_MAP.md` | Current CSV, Supabase, and migration map |

## Known Issues

| Severity | Issue | Impact | Next action |
|---|---|---|---|
| MEDIUM | Baseline and approved task plan remain template-like/incomplete | Production GxP release lacks formal owner-approved requirements evidence | Project owner should approve/fill baseline and task plan before regulated production use |
| MEDIUM | Live Supabase migration/seed was performed by project owner, not by this agent | Agent cannot independently confirm live database state without authorized Supabase access | Verify live Supabase tables, RLS, and seed counts in the target project |
| MEDIUM | Supabase Auth on the deployed site returns 401 for password, signup, and OAuth token exchange | Existing deployment was built before GitHub Supabase secrets were refreshed | Redeploy from `master`, then retest live auth |
| LOW | `npm run build` reports a Vite chunk-size warning for the main bundle | Build passes, but first-load bundle may be large | Consider route-level code splitting/manual chunks after functional acceptance |
| LOW | Repository default branch and Pages deployment policy are `master`, while local prep began on `main` | Pushes to `main` build but cannot deploy to Pages | Continue deploying from `master` or change the Pages environment policy/default branch in GitHub |

## Decisions and Simplifications

- Decision: `Preserve existing remote master history instead of force-pushing over it.`
- Decision: `Deploy through the existing github-pages environment branch policy by keeping the workflow on master.`
- Decision: `Keep generated VRMS seed SQL gitignored; regenerate locally with npm run supabase:seed:vrms.`
- Decision: `Do not read or expose .env.local contents.`
- `ponytail:` `Use the existing Pages workflow path and one branch-policy fix instead of introducing another deploy mechanism.`

## Verification

| Check | Status | Result |
|---|---|---|
| Install | `PASSED` | `npm install` completed earlier, 0 vulnerabilities |
| Lint | `N/A` | `No lint script configured` |
| Type-check | `PASSED` | Covered by `npm run build` via `tsc -b` |
| Tests/self-check | `PASSED` | `npm run test` — 5 files, 17 tests passed |
| Build | `PASSED` | `npm run build`; Vite chunk-size warning only |
| Workflow schema | `PASSED` | `npm run workflow:validate`; SQLite schema, FKs, and immutability/audit triggers validated |
| Workflow smoke | `PASSED` | `npm run workflow:smoke`; create/review/approve/comment/restore path completed with temporary runtime data |
| CSV/app data check | `PASSED` | `npm run verify:vrms-csv`; all 10 CSV row counts match and audit fields aligned |
| Supabase seed generation | `PASSED` | `npm run supabase:seed:vrms` completed earlier; generated ignored local `supabase/seed.vrms.generated.sql` |
| Migration reference alignment | `PASSED` | Active `supabase/migrations` contains the eight SQL files from `reference/supabase/migrations` |
| Deployment | `PASSED` | `master` Pages workflow deployed successfully; live URL returned HTTP 200 |

## SQLite Sync

- Editable SQL changed: `workflow-app/database/schema.sql`
- Migration: `NONE`
- Generated map: `NOT_REQUIRED`
- Map command/result: `N/A`
- Applied to: `Local workflow app only`
- Rollback: `N/A`

## Next Action

`Use npm run workflow:dev for local approval workflow records.`

V6 auth follow-up: `Redeploy from master and retest live Supabase Auth.`

Historical evidence: `agent-history/version-7-handoff.md`

Keep this file concise. Do not copy full logs, diffs, generated maps, or historical narratives here.

## Feedback

Sanitized reviewer feedback: deployed Supabase Auth returns `401 Unauthorized` for Google OAuth token exchange, email/password sign-in, email signup, and OAuth signup. A browser-extension log line (`writer.min.js`, Ginger Widget) is unrelated to the app.

Initial diagnosis: because multiple Supabase Auth endpoints fail with 401, the likely root cause was a missing, invalid, or mismatched public anon key in GitHub Actions secrets for the deployed build. After explicit approval, this agent updated the GitHub Actions secret names from `.env.local` without printing values.
