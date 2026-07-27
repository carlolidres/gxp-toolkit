# Current Handoff

Last Updated: `2026-07-27`
Version: `v40`
Branch: `main` (deploy via `master`)
Commit: pending
Deployment: pending push to `master`

## Current Status

v40: eDoc Send → inbox/workspace with live PDF; unified signatory field palette; create-route SQL fixes (`route_id`, `extensions.digest`).

## Key implementation notes

- Unified `fieldTypesForAction` palette for sign/review/approve/acknowledge.
- Send uploads PDF to `edoc-originals`, returns `active_assignment_id`, navigates creator to workspace.
- Workspace loads PDF via `edoc-file-access` + pdf.js.
- Migrations applied remote: `20260727100000`, `20260727110000`, `20260727120000`.

## Verification

| Check | Status | Result |
|---|---|---|
| Supabase migrations (send/inbox/pdf + route_id + digest) | `PASSED` | applied via MCP |
| `npm run type-check` | `PASSED` | `tsc -b` |
| Deploy | `PENDING` | push to `master` |

## Next Action

1. Smoke Create → Send → workspace PDF → My Inbox on production Pages after deploy.

## Prior stable release

- Previous: `v39` — Account Settings + eDoc profile-backed fields — GitHub Pages run [30157940938](https://github.com/carlolidres/gxp-toolkit/actions/runs/30157940938).
