# Current Handoff

Last Updated: `2026-07-21`
Version: `v36`
Branch: `main` → deploy via `master`
Commit: `a81b80f` (feature) · `cf91564` (HANDOFF)
Deployment: `DEPLOYED` — GitHub Pages run [29832776324](https://github.com/carlolidres/gxp-toolkit/actions/runs/29832776324)

## Current Status

**v36** — eDoc Create Document wizard modernized (all steps); APQR Database clear default filters + Product Code column order; app version history updated (`v35` recorded, `v36` current); DATA_MAP documents eDoc create-and-send draft payload flow.

### Confirmed product decisions

- Messages drawer: mask click disabled; Esc + header close remain.
- Doc Tracer / Equipment/Product remain plain inputs.
- Status / Sent/Routing To: searchable select only (no inline create).
- Other registry fields: searchable + inline create when Registry `create` is granted; persist only after successful routing save.
- Suggestion remove requires Registry `delete`; historical routing records are unchanged.
- eDoc Create metadata UI: Document number, Title, Priority, Due date, Description only (other metadata defaults retained in RPC payload).
- APQR Database: default filters clear (cycle year `all`, empty date months).

### Key implementation notes

- Messages: Ant `Drawer` in `MessagesModal.tsx`; compose Clear/Send; clipboard copy helper in `messageFormat.ts`.
- Toast API: `notify(text, kind?)` defaults to `info` for backward compatibility.
- Routing: `VrmsRegistrySelect` with body-portal dropdowns; CSS grid alignment in `vrms.css`.
- eDoc wizard: `WizardField` / `WizardActions` in `EdocCreateDocumentPage.tsx`; Back/Continue right-aligned.
- Migration `20260713170000_registry_values_ci_unique_and_rls.sql`: **applied remotely** (project `ydndeoacgfnxjqwwnswh`).
- SQLite reference: `registry_values` added to `database/sqlite/schema.sql`.

## Verification

| Check | Status | Result |
|---|---|---|
| `npm run type-check` | `PASSED` | 2026-07-21 (eDoc create wizard UI) |
| `npm run test` (focused) | `PASSED` | vrmsLogic + MessagesModal clipboard (13) — prior v35 |
| `npm run lint` | `PASSED` | 0 errors; 16 pre-existing warnings — prior v35 |
| `npm run build` | `PASSED` | GitHub Actions deploy job 29832776324 |
| `npm run verify:vrms-csv` | `PASSED` | all registry/document/audit counts match — prior |
| `npm run db:map` | `PASSED` | 31 tables, 75 FKs, 27 indexes — prior |
| `npm run verify:schema` | `FAILED` | Pre-existing mock/seed ID mismatch (users/documents); unrelated |
| `npm run graphify:check` | `Command unavailable.` | script not configured |

## Next Action

1. Owner visual check: eDoc Create wizard + APQR Database defaults (light/dark, mobile).
2. Continue eDoc Storage RLS test 3.4 when ready.

## Risks / Limitations

- Registry RLS hardening is in the new migration only until applied remotely; UI already gates create/delete.
- Case-insensitive unique index will refuse to apply if preexisting case collisions exist (intentional fail-safe).
- `verify:schema` still fails on template users/documents mock/seed drift.
- Storage RLS test 3.4 still `NOT_RUN`.

## Prior stable release

- Last deployed before this: `v35` commit `2b3b4b9` — GitHub Pages run [29246065807](https://github.com/carlolidres/gxp-toolkit/actions/runs/29246065807) (2026-07-13).

## eDoc Rollout Progress

| Phase | Status | Notes |
|-------|--------|-------|
| 1 — SQLite reference | `PASSED` | `edoc_schema.sql`, `edoc_seed.sql`, `db:map` |
| 2 — Staging Supabase | `PASSED` | Migrations through `20260704100000` applied |
| 2b — Edge Functions | `PASSED` | `edoc-file-access`, `edoc-sign-document`, `edoc-create-certificate` |
| 2c — RLS static validation | `PASSED` | `verify_edoc_rls.sql` |
| 3 — Manual RLS scenarios | `PASSED` | 3.1, 3.2, 3.3, 3.5 (3.4 storage manual) |
| 4 — Browser smoke | `PASSED` | `e2e:edoc-staging` 4/4 |
| 5 — Menu permissions | `PASSED` | staging test accounts |
| 6 — Org membership seed | `PASSED` | `staging-edoc-org` |
| Storage RLS test 3.4 | `NOT_RUN` | Manual via `edoc-file-access` |
