# Current Handoff

Last Updated: `2026-07-13`
Version: `v35`
Branch: `main`
Commit: `2b3b4b9`
Deployment: `IN_PROGRESS` (GitHub Pages via push to master)

## Current Status

**UI/UX + Routing Upgrade (v35)** — Login logo integration, Messages right drawer, sharp Ant notifications, readable typography scale, VRMS routing searchable registry selects with permission-aware create/remove, and registry integrity hardening.

### Confirmed product decisions

- Messages drawer: mask click disabled; Esc + header close remain.
- Doc Tracer / Equipment/Product remain plain inputs.
- Status / Sent/Routing To: searchable select only (no inline create).
- Other registry fields: searchable + inline create when Registry `create` is granted; persist only after successful routing save.
- Suggestion remove requires Registry `delete`; historical routing records are unchanged.

### Key implementation notes

- Messages: Ant `Drawer` in `MessagesModal.tsx`; compose Clear/Send; clipboard copy helper in `messageFormat.ts`.
- Toast API: `notify(text, kind?)` defaults to `info` for backward compatibility.
- Routing: `VrmsRegistrySelect` with body-portal dropdowns; CSS grid alignment in `vrms.css`.
- Routing/input vertical text centering: Ant Design 6 Select styles target `.ant-select` / `.ant-select-content` / `.ant-select-input` (not legacy `.ant-select-selector`); native inputs use `padding-block: 0` + fixed height so Chrome/Edge center text.
- Toast placement: upper-center via `translateX(-50%)`; `App message={{ top: 64 }}` below 56px topbar.
- Toast UI: `ToastContent` + Lucide icons + Tailwind-scoped `toast.css`; validation errors parse into a titled two-column field list (`formatToastMessage.ts`).
- Migration (local file only, not applied remotely): `supabase/migrations/20260713170000_registry_values_ci_unique_and_rls.sql`.
- SQLite reference: `registry_values` added to `database/sqlite/schema.sql`.

## Verification

| Check | Status | Result |
|---|---|---|
| `npm run type-check` | `PASSED` | 2026-07-13 |
| `npm run test` (focused) | `PASSED` | vrmsLogic + MessagesModal clipboard (13) |
| `npm run lint` | `PASSED` | 0 errors; 16 pre-existing warnings |
| `npm run build` | `PASSED` | 2026-07-13 |
| `npm run verify:vrms-csv` | `PASSED` | all registry/document/audit counts match |
| `npm run db:map` | `PASSED` | 31 tables, 75 FKs, 27 indexes |
| `npm run verify:schema` | `FAILED` | Pre-existing mock/seed ID mismatch (users/documents); unrelated |
| `npm run graphify:check` | `Command unavailable.` | script not configured |
| Remote migration apply | `NOT_RUN` | Local/remote history drift still blocks safe `db push` |
| Owner browser visual check | `PASSED` | Routing input/select vertical text centering confirmed 2026-07-13 |

## Next Action

1. Owner visual check: login lockup, Messages drawer, routing searchable selects, notifications, typography, light/dark.
2. Repair Supabase migration history, then apply `20260713170000_registry_values_ci_unique_and_rls.sql`.
3. Commit/deploy when owner accepts.

## Risks / Limitations

- Registry RLS hardening is in the new migration only until applied remotely; UI already gates create/delete.
- Case-insensitive unique index will refuse to apply if preexisting case collisions exist (intentional fail-safe).
- `verify:schema` still fails on template users/documents mock/seed drift.
- `supabase db push` remains blocked by remote history drift (`20260708123542`, `20260709103218`, and related).

## Prior stable release

- Last deployed: `v34` commit `2e712f9` — GitHub Pages run [29139119921](https://github.com/carlolidres/gxp-toolkit/actions/runs/29139119921) (2026-07-11).
- Includes APQR dashboard/registry/scheduler/database polish, atmospheric themes, Ant Design 6 migration, admin-approved password reset, and Messages modernization (modal, now upgraded to drawer in v35).

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
