# Continuous Process Verification (CPV)

**Status:** Approved 2026-08-22 — C1–C30 accepted; Phase 1 may proceed  
**Date:** 2026-08-22  
**Module:** CPV  
**Canonical plan path:** `plans/cpv-continuous-process-verification/plan.md`  
**Source blueprint:** `reference/CPV_CURSOR_IMPLEMENTATION_SPEC.md`  
**Branch:** `feature/cpv-module` (from `main`; not `feature/paymongo-integration`)

**Not a process-validation certification claim.** Official Valid / Not Valid is a human QA decision on a versioned assessment.

### Locked owner decisions (2026-08-22)

| Decision | Locked value |
|---|---|
| Product/batch source | **Amended 2026-09-12:** Product Profile selects unique APQR Database products by `product_code`. First open creates a `cpv_products` workspace row (`ensureCpvProductFromApqr`). CPV still owns batches. No Create Product button. No CNF Sheets import in Phase 1. |
| Protocol and Report | Generators driven by the Product Profile workspace. |
| Approval | Reauthentication + printed name + meaning + timestamp + append-only audit. Not eDoc document routing. |
| Visibility | `VITE_ENABLE_CPV` default **false** in production builds. Local `npm run dev` shows CPV unless `VITE_ENABLE_CPV=false`. |
| Data | SQLite-first in `database/sqlite/cpv_schema.sql`. No Supabase CPV migration until schema validation. |
| Admin vs QA | System administration does not grant protocol/report/posture approval (C14). |

---

## Risk assessment and controls

Severity: **C** critical · **H** high · **M** medium · **L** low.

Control register C1–C30 is accepted. Do not reopen without an explicit owner amendment.

- **C1** Never hard-delete approved or GMP-relevant records. Void/retire with a mandatory reason.
- **C2** Proposed posture is calculated. Official posture is QA-approved only. Completeness is not Valid.
- **C3** RM, PM, Equipment, IPC, and AR reference `cpv_product_batches.id` only.
- **C4** Packaging orders are children of one batch.
- **C5** Copy-forward defaults to templates. Results, dates, approvals, and snapshots require explicit selection.
- **C6** Missing numeric results stay null. Do not fabricate capability indices.
- **C7** Evaluate against the specification/qualification version effective on the use or test date.
- **C8** Flag asset use outside an approved window as of the use timestamp.
- **C9** Approved protocol/report versions are immutable. Revisions create a new version.
- **C10** Approved reports use a frozen snapshot.
- **C11** `cpv_audit_events` is append-only. Do not use APQR `localStorage` audit mutation.
- **C12** Authorize every mutation in the service layer (RLS/RPC later).
- **C13** The author of a protocol or report cannot approve that version.
- **C14** CPV Administrator / system Admin cannot approve official posture, protocols, or reports by default.
- **C15** `VITE_ENABLE_CPV=false` until the owner enables the flag for production.
- **C16** SQLite-first gate before any Supabase CPV migration.
- **C17** Do not hook CPV into eDoc billing, Paddle, or PayMongo.
- **C18** Official OOS/OOT requires an investigation link.
- **C19** Not Applicable requires justification and audit.
- **C20** Stability, Hold-Time, CNF, Complaints, Deviations, and Process Improvements are independently created.
- **C21** Hold-time requirements require a study/SOP reference. Duration is calculated from timestamps.
- **C22** Optimistic concurrency via `row_version`.
- **C23** Sign-off requires reauthentication fields (typed name + meaning).
- **C24** Store timestamps in UTC.
- **C25** Unique product code; unique product+batch number. Duplicate names warn only.
- **C26** Default review inclusion is FG release date in range.
- **C27** Alerts link to the filtered record; one alert per condition.
- **C28** Attachment metadata is retained on approved records.
- **C29** Posture rules and specifications are versioned.
- **C30** Use specified GMP spelling and labels.

### Residual risk

CPV supports GMP-aligned monitoring. It does not certify the manufacturing process or replace a site VMP.

---

## Implementation sequence

Phase 1 foundation → Phase 2 product/batch → Phase 3 core batch data → Phase 4 independent modules → Phase 5 protocol/report/posture/audit → Phase 6 verification.

### This increment (Phase 1 + Phase 2 usable menus)

- Top-level CPV menus: Product Profile, Report, Protocol, Audit Trail.
- Product Master List, Create/Edit/Retire Product, Product Workspace shell.
- Product Batch Register and Packaging Order children.
- Protocol and Report master lists with draft → review → approval (C9, C10, C13, C14).
- Append-only CPV audit viewer (C11).
- Phase 3–4 workspace modules encode data: RM, PM, Equipment, IPC, AR against shared batches; Stability, Hold-Time, CNF, Complaints, DR, Process Improvements are independent records.
