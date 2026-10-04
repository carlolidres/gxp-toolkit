# Active Plan

Last Updated: `2026-09-12`

Plan Owner: `Cursor`

Status: `IN_PROGRESS` — CPV Phase 3–4 encode screens are in the product workspace. PayMongo remains additive behind `ENABLE_PAYMONGO=false`.

Active visual/requirements plan: `plans/cpv-continuous-process-verification/plan.md`  
Source blueprint: `reference/CPV_CURSOR_IMPLEMENTATION_SPEC.md`  
PayMongo plan (unchanged): `plans/edoc-paymongo-gotyme/plan.md`

## Objective

Make the CPV sidebar menus usable: Product Profile, Protocol, Report, and Audit Trail, with SQLite-first schema and in-memory persistence until Supabase migration is approved.

## This slice

- Product Profile lists unique APQR Database products. Clicking a code opens the workspace in this tab.
- Phase 3: RM, PM, Equipment/Rooms/Lines, IPC, AR encode against `cpv_product_batches.id`.
- Phase 4: Stability, Hold-Time, CNF, Complaints, Deviations, Process Improvements are independently created and may link batches.
- Protocol and report draft → submit → approve with C13/C14 and frozen report snapshots.
- Append-only CPV audit viewer (not APQR localStorage).
- `VITE_ENABLE_CPV`: production default off; local `npm run dev` shows CPV unless set false.

## Next

Phase 5 polish (alerts, capability method if owner later approves). Keep PayMongo flags off until staging secrets exist. No Supabase CPV migration (C16).
