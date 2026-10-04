# Current Handoff

Last Updated: `2026-10-04`
Version: `v43+paymongo-wip`
Branch: `feature/paymongo-integration`
Commit: uncommitted (restore tag `pre-paymongo-integration`)
Deployment:
- GitHub Pages: not deployed from this branch
- Staging Edge: PayMongo function **not deployed**; flags remain off
- Staging DB: `edoc_paymongo_billing` applied `20260819111656` on `ydndeoacgfnxjqwwnswh`
- App URL: https://carlolidres.github.io/gxp-toolkit/

## Current Status

**CPV product code (2026-10-04):** a product code on the sheet keeps its type and is underlined as a link. It opens a popup to edit that product’s APQR Product Name and Product Code. Save writes both onto every cycle of the product and renames the matching CPV row. A blank name or code is rejected, and a code already used by another product is rejected.

**CPV product name (2026-10-04):** a product name on the sheet opens a new window at `#/cpv/products/{product code}/profile/raw-material` and carries this tab’s sign-in with it. The header shows that product’s name and code. The left menu is Raw Material, Packaging Material, In-process Control, Analytical Report, Stability, Holding-Time, Other Data, Deviation Report, and Product Complaints. Each item keeps its own sheet for that product code. The product-code editor stays an in-page dialog.

**APQR dashboard (2026-10-04):** the dashboard header, metric cards, panels, work queue, and delivery summary use a quieter card layout. Metric cards stay filters. Records, Scheduler, and Clients navigation is unchanged.

**APQR identity across cycles (2026-10-03):** Department saved on one cycle is written onto every cycle of that product code. Opening the form copies that cycle's client (code, name, account manager, package, and contacts) onto the product's other cycles, and fills a blank department from the latest cycle that has one. A new cycle starts with that department. Report status, dates, batches, and delivery stay on the cycle where they were entered.

**CPV Product Profile sheet (2026-10-03):** the product list uses the APQR Records sheet frame. Columns are Product Name, Product Code, Client, Department, Batch Size, Report Tracer No., Issued Date, Remarks, BHT-Report reference no., Hold-Time, CPP, CQA, and CPP/CQA monitoring status. Report and Protocol are hidden from the CPV sidebar. The sheet no longer has Edit, Retire, or a product-code link. A Department cell opens an editor on the sheet. Empty cells show an Add control; saved departments show as a tag. Saving writes that department onto the product’s APQR record and its other cycles. A Batch Size cell opens an editor for the commercial size and unit (Kg or L) and any alternate sizes. An empty cell uses the same dashed Add chip as Department. Those values stay on the CPV product. Report Tracer No., Issued Date, and Remarks open one list. Issued Date on the report list, the VMP report, and each bulk hold-time row uses a calendar and the dd Mmm YYYY format. Product Name stays frozen at the left of the product sheet, at a readable width, and the sheet scrollbars are thin. The row-number corner stays fixed when the sheet scrolls sideways, and column headers stay opaque. The list puts the newest issued date first, and that row is what the sheet shows. BHT-Report reference no. and Hold-Time open one list of bulk hold-time studies. CPP/CQA Monitoring Status opens the VMP report number, an issued date in dd Mmm YYYY, and the CPP steps for BMR and BPR. Remarks, Hold-Time, and that monitoring cell show a green check when something is saved and a red circle when nothing is saved. Both stay clickable.

**VMP equipment masterlist (2026-09-24):** Equipment records on the Masterlist Form and the Equipment Profile table share one field set: Equipment, IL-Tag, Department, Section, capacity, unit operation, verified limits, contact parts, MOC, surface area, ratings, hard-to-reach count, and installation date. Existing name, tag, department, and section values stay on `itemName`, `assetTagNo`, `department`, and `roomLine`.

**APQR dropdown remove (2026-09-24):** Department, Report Status, Sent By, and Client Registry Account Manager menus can drop a custom entry. Built-in departments and report statuses stay. Removing an entry hides it from later menus; values already stored on records are left as they are. Account Settings, VMP masterlist, and VRMS registry selects already had remove.

**APQR search focus (2026-09-24):** search fields keep their resting border. Clicking no longer adds the Ant Design focus border or the extra teal ring. Same treatment on the form lookup, dashboard, database, client registry, audit log, scheduler, and client picker.

**APQR Records (2026-09-24):** the Records page uses the Equipment Profile sheet frame, keeps the record search, and lets an Admin edit Department and APR Ref. in the grid. APQR ID, client, and product links still open their pages. the form search field loads by product code for the selected APR cycle year. The year control defaults to the open record’s commitment year, and the product list follows that year.

**VMP Equipment Profile (2026-09-23):** `/vmp/equipment-profile` is a blank Excel-style workbook (virtualized grid, sheet tabs, localStorage `gxp.vmp.equipment-profile.v1`, debounced 400ms). Unreadable stored JSON opens a blank workbook and shows a banner. Audit events are stored with the workbook for a later VMP audit viewer. No Supabase table yet. Formula references are not shifted when rows/columns are inserted.

**CPV Product Profile (2026-09-12 owner amendment):** the list is unique APQR Database products (`product_code`). Search is a searchable Select. **Create Product is removed.** Clicking a product code navigates in the same tab to the CPV workspace (`ensureCpvProductFromApqr` + in-memory/session cache). Edit remains for CPV-only fields; product code/name/client stay APQR identity.

**Click bug (2026-09-12):** product codes used `window.open` after an async save. The popup was blocked or the new tab had an empty CPV store, so ABES / ACTQ / ACTT showed nothing or “Product not found.” Open now stays in this tab.

**CPV Phase 3–4 (2026-09-12):** workspace modules encode RM, PM, Equipment/Rooms/Lines, IPC, AR against the Product Batch Register; Stability, Hold-Time, CNF, Complaints, Deviations, and Process Improvements are independent. SQLite tables are in `database/sqlite/cpv_schema.sql`. Runtime is still in-memory + session cache. No Supabase CPV migration (C16). Process capability indices are not calculated (C6).

CPV Phase 1–2 remains usable: Product Profile, Protocol, Report, and Audit Trail. GitHub Pages builds set `VITE_ENABLE_CPV=true`. Local `npm run dev` shows CPV unless that flag is false. PayMongo flags stay off.

Additive PayMongo provider is implemented beside Paddle. **`ENABLE_PAYMONGO` / `VITE_ENABLE_PAYMONGO` default false.** Hosted checkout payment methods: **GCash (`gcash`), Visa/Mastercard (`card`), PayMaya (`paymaya`)**. Paddle routes, price IDs, and webhook behavior are unchanged except:

- webhook/checkout refuse to overwrite a live subscription from the other provider;
- reconcile skips non-Paddle rows on the Paddle API path.

GoTyme is **not** integrated into subscription or entitlement logic. It remains PayMongo settlement/treasury only.

Plans:
- CPV: `plans/cpv-continuous-process-verification/plan.md`
- PayMongo: `plans/edoc-paymongo-gotyme/plan.md`
- Paddle (unchanged): `plans/edoc-international-subscription/plan.md`

## Rollback

```text
ENABLE_PAYMONGO=false
PAYMONGO_CHECKOUT_ENABLED=false
VITE_ENABLE_PAYMONGO=false
VITE_PAYMONGO_CHECKOUT_ENABLED=false
```

Paddle continues. PayMongo rows stay. No database rollback.

## Next Action

1. Owner: encode a product (e.g. ACTQ) through Batches → RM/PM/Equipment/IPC/AR, then a Stability study and a CNF. Do not add a second product catalog.
2. Owner: keep public PayMongo flags off.
3. Set Edge secrets (`PAYMONGO_SECRET_KEY_TEST`, `PAYMONGO_WEBHOOK_SECRET_TEST`, `PAYMONGO_ENV=test`) and deploy `edoc-paymongo-webhook` plus `edoc-billing-checkout`.
4. In PayMongo Dashboard, enable **GCash, Cards (Visa/Mastercard), and Maya/PayMaya** for the test account.
5. Register webhook URL: `https://ydndeoacgfnxjqwwnswh.supabase.co/functions/v1/edoc-paymongo-webhook`.
6. Enable test flags only after secrets exist.

## Verification

| Check | Result |
|---|---|
| `npm run type-check` | PASS (2026-09-12) |
| `npx vitest run src/features/cpv/apqrProductCatalog.test.ts src/features/cpv/cpvService.test.ts src/features/cpv/cpvPhaseService.test.ts` | PASS (15) |
| `npm run test` (CPV + permissions) | PASS (14) earlier; full suite NOT_RUN this session |
| `node node_modules/vitest/vitest.mjs run src/features/apqr/apqrFormLookup.test.ts` | PASS (8) on 2026-10-04 |
| Browser CPV product-code popup | NOT_RUN — no browser automation tools; local Vite is on `http://127.0.0.1:5173/gxp-toolkit/` |
| `npm run db:map` | PASS (63 tables) |
| `npm run lint` | NOT_RUN (this session) |
| Full `npm run test` | NOT_RUN (this session) |
| Supabase CPV migration | NOT_STARTED (C16 SQLite-first) |
| Live Paddle keys | NOT_SET (intentional) |
| PayMongo live keys | NOT_SET (intentional) |
| Staging migration `edoc_paymongo_billing` (`20260819111656`) | APPLIED on `ydndeoacgfnxjqwwnswh`; `paymongo_checkout_enabled=false` |
| Edge `edoc-paymongo-webhook` | NOT_DEPLOYED |
