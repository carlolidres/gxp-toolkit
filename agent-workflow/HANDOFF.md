# Current Handoff

Last Updated: `2026-06-29`
Version: `v22`
Branch: `main` / `master`
Commit: `b190fa4`
Deployment: `PASSED` — [GitHub Actions run 28374686116](https://github.com/carlolidres/gxp-toolkit/actions/runs/28374686116) via `master` → https://carlolidres.github.io/gxp-toolkit/

## Current Status

**Computerized Systems** — Group / Subcategory field hidden; `group` cleared on area switch and not saved.

Prior: BUG-0001/BUG-0002 dropdown fix; area-specific cascading + QC instruments.

## Recently Completed

- BUG-0001/BUG-0002 dropdown visibility + network noise (2026-06-29)
- Area-specific cascading + QC instruments (2026-06-29)

## Active Work

- Objective: `BUG-0001 — dropdown list visibility`
- Progress: `COMPLETED` (await owner mark-complete in workflow app)
- Remaining: Owner browser verification on `/vmp/masterlist`

## Verification

| Check | Status | Result |
|---|---|---|
| Type-check / Build | `PASSED` | `npm run build` (2026-06-29) |
| Tests | `PASSED` | `npm run test` — 64 tests (2026-06-29) |
| SQLite map | `NOT_RUN` | `npm run db:map` unavailable |
| Browser verification | `NOT_RUN` | Owner/manual review pending |

## Files Changed (this session)

| Area | Paths |
|---|---|
| Dropdown | `src/components/vmp/VmpFormFields.tsx` |
| Styles | `src/styles/vrms.css` |
| Debug cleanup | `src/lib/supabaseAuth.ts` |

## Next Action

1. Owner browser review: open Department / Facility and other searchable fields — list fully visible, section size unchanged, no failed fetch to `:7279/ingest`
2. Mark BUG-0001 (and BUG-0002 if satisfied) complete in workflow app
3. Plan Supabase migration + RLS when SQLite sign-off done
