# Current Handoff

Last Updated: `2026-07-23`
Version: `v38`
Branch: `main` / `master`
Commit: `011ff00`
Deployment: `DEPLOYED` — GitHub Pages run [30007528364](https://github.com/carlolidres/gxp-toolkit/actions/runs/30007528364)

## Current Status

**v38** — eDoc Create Document: signatory-level routing (Sequential / Parallel / Mixed), interactive PDF field placement, inbox active-only visibility, and pdf.js legacy build for reliable PDF rendering. App version history drawer updated. Supabase migrations applied on linked project `ydndeoacgfnxjqwwnswh`.

## Key implementation notes

- Signatory builder: `EdocSignatoryRoutingBuilder`, `signatoryLevels.ts` → compiles to `routing.mode` + `routing.steps`.
- Keep uploaded PDF bytes in Create wizard state for rendering (`pdfBytes`).
- Placement UI: `EdocFieldPlacementEditor`, `EdocPdfPageCanvas`, `usePdfDocument` (legacy pdf.js), `fieldPlacementGeometry`.
- Inbox: `edoc_assignment_inbox` / `listInboxTasks` — `assignment_status = 'active'` only.
- Migrations: `20260722100000_edoc_empty_signatory_route.sql`, `20260723120000_edoc_field_rotation_and_assignee_map.sql`, `20260723130000_edoc_inbox_active_only.sql`.

## Verification

| Check | Status | Result |
|---|---|---|
| `npm run type-check` | `PASSED` | 2026-07-23 |
| Geometry / fieldRules / signatoryLevels tests | `PASSED` | prior session |
| Supabase `db push --linked` | `PASSED` | three eDoc migrations applied 2026-07-23 |
| GitHub Pages deploy | `PASSED` | run 30007528364 on `master` @ `011ff00` |

## Next Action

Smoke `/edoc/create` → upload PDF → place fields → Send → My Inbox per routing mode on the live Pages site.

## Prior stable release

- Previous: `v37` commit `a8f37ab` — GitHub Pages run [29910046901](https://github.com/carlolidres/gxp-toolkit/actions/runs/29910046901).
