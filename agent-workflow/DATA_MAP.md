# Data Map

Last Updated: `2026-06-21`

## Purpose

Use this file for SQLite, migration, API data flow, reporting, integrity, authorization, and schema-navigation work.

This is a concise human map. It does not replace executable SQL.

## SQLite Sources

| Path | Role | Editing rule |
|---|---|---|
| `database/sqlite/schema.sql` | Placeholder SQLite schema template | Edit only if SQLite becomes an active target |
| `database/sqlite/seed.sql` | Placeholder SQLite seed template | Do not put regulated/production data here |
| `sqlite-out/` | Generated schema map used for fast navigation | Never edit manually |
| `workflow-app/database/schema.sql` | Local workflow app SQLite schema for approval records, versions, comments, approvals, audit events, and baseline snapshots | Edit only with the workflow app source |
| `workflow-app/data/` | Local generated workflow app database/runtime data | Gitignored; do not commit |

Current status: SQLite is not yet modeled for VRMS. `schema.sql`, `seed.sql`, and `sqlite-out/SCHEMA_REPORT.md` are placeholders.

Workflow app status: `workflow-app/` uses its own local SQLite store for approval workflow tracking. It is not the VRMS application schema and is not deployed with the Vite app.

## Supabase Sources

| Path | Role | Editing rule |
|---|---|---|
| `supabase/migrations/20260616000000_initial_gxp_toolkit_schema.sql` through `20260618400000_fix_profiles_rls_row_security.sql` | Reference Supabase migration sequence for template cleanup, VRMS schema, auth profiles, grants, menu permissions, and RLS fixes | Review and approve before applying |
| `supabase/seed.vrms.generated.sql` | Local generated seed from `src/data/vrmsProductionData.json` | Generated and gitignored; review before applying |
| `scripts/generate-vrms-supabase-seed.mjs` | Generates the local Supabase seed SQL | Edit when data shape changes |
| `scripts/verify-vrms-csv-bundle.mjs` | Verifies CSV row counts and audit field alignment | Run before migration/export |
| `scripts/repair-vrms-audit-bundle.mjs` | Repairs audit fields from the source CSV export | Run only when regenerating from the audit CSV |

## CSV Source Coverage

The app data bundle is `src/data/vrmsProductionData.json`, exported by `src/data/vrmsProductionData.ts`.

Verification command:

```text
npm run verify:vrms-csv
```

Latest result: `PASSED` on `2026-06-21`.

| Source CSV | App target | CSV rows | App rows |
|---|---|---:|---:|
| `reference/VRMSdatabase/VRMS - AuditTrail.csv` | `auditEvents` | 791 | 791 |
| `reference/VRMSdatabase/VRMS - Documents.csv` | `routingDocuments` | 112 | 112 |
| `reference/VRMSdatabase/VRMS - Registry_Category.csv` | `registryValues: Category` | 6 | 6 |
| `reference/VRMSdatabase/VRMS - Registry_CheckedBy.csv` | `registryValues: Checked by` | 8 | 8 |
| `reference/VRMSdatabase/VRMS - Registry_Client.csv` | `registryValues: Client` | 38 | 38 |
| `reference/VRMSdatabase/VRMS - Registry_Department.csv` | `registryValues: Department` | 25 | 25 |
| `reference/VRMSdatabase/VRMS - Registry_PreparedBy.csv` | `registryValues: Prepared by` | 10 | 10 |
| `reference/VRMSdatabase/VRMS - Registry_ReportProtocol.csv` | `registryValues: Report / Protocol` | 20 | 20 |
| `reference/VRMSdatabase/VRMS - Registry_SentRouting.csv` | `registryValues: Sent / Routing` | 34 | 34 |
| `reference/VRMSdatabase/VRMS - Registry_Status.csv` | `registryValues: Status` | 7 | 7 |

Audit import note: the source audit CSV has misleading headers for document-related rows. `scripts/repair-vrms-audit-bundle.mjs` maps those rows by field shape so `routingTracker`, `docTracer`, and `details` are aligned before seed generation.

## Primary Entities

| Entity | Table or bundle key | Purpose | Primary Key | Source |
|---|---|---|---|---|
| Profile | `profiles` | Application profile and authorization metadata linked to optional Supabase Auth identity | `id` text | `supabase/migrations/20260617000000_vrms_schema.sql`, `20260617100000_vrms_auth_profiles.sql`, `20260618200000_profiles_user_management.sql` |
| User menu permission | `user_menu_permissions` | Menu/action grants by profile | `(user_id, menu_id)` | `supabase/migrations/20260618100000_user_menu_permissions.sql` |
| Routing document | `routing_documents` / `routingDocuments` | VRMS document routing record and signatory tracker | `routing_tracker` | `reference/VRMSdatabase/VRMS - Documents.csv` |
| Registry value | `registry_values` / `registryValues` | Controlled values for status, routing recipients, report/protocol, client, category, department, prepared by, checked by | `id`; unique `(registry_type, value)` | Registry CSV exports |
| Audit event | `audit_events` / `auditEvents` | Append-only VRMS activity/audit history | `id` | `reference/VRMSdatabase/VRMS - AuditTrail.csv` |
| VMP masterlist record | `vmp_masterlist_records` / `VmpMasterlistRecord` | Validation masterlist entries (form + database) | `id` (internal UUID); unique `record_id` | `database/sqlite/schema.sql`; mock store `src/services/mockVmpMasterlistService.ts` |

## Core Relationships

```text
auth.users.id
  └── profiles.auth_user_id
        ├── user_menu_permissions.user_id
        ├── routing_documents.updated_by (text audit attribution)
        └── audit_events.user_email (text audit attribution)

routing_documents.routing_tracker
  └── audit_events.routing_tracker
```

The migration keeps audit/document date fields as text to preserve the legacy CSV values exactly. Normalize dates only through an approved migration plan.

## Key Tables

### `routing_documents`

Purpose: Stores each VRMS routing document and embedded ordered signatories.

Source SQL: `supabase/migrations/20260617000000_vrms_schema.sql`

| Field | Type | Rule |
|---|---|---|
| `routing_tracker` | text | Primary key; generated by app logic and immutable for an existing document |
| `doc_tracer` | text | Unique document tracer number |
| `status` | text | Must align with registry `Status` values |
| `signatories` | jsonb | Ordered signatory tracker from the app |
| `updated_by` | text | Audit attribution text |

### `registry_values`

Purpose: Stores selectable controlled values used by VRMS forms.

Key rules:

- `(registry_type, value)` is unique.
- Registry changes create audit events through app behavior.

### `profiles`

Purpose: Stores application profile and authorization metadata linked to Supabase Auth by `auth_user_id`.

Key rules:

- Duplicate emails are prohibited.
- Deactivated profiles must not retain active app access.
- Seeded profile IDs are text (`p-1`, `p-2`) to preserve imported app data.

### `user_menu_permissions`

Purpose: Maps profiles to menu/action permissions.

Key rules:

- UI visibility does not replace Supabase RLS.
- Direct-route access must enforce the same permissions in the app.
- Admin updates are constrained by RLS policy.

### `audit_events`

Purpose: Stores protected audit records for critical activities.

Key rules:

- App behavior inserts audit rows.
- RLS allows authenticated active profiles to view and insert audit records.

### `vmp_masterlist_records`

Purpose: Stores validation masterlist records submitted through **Masterlist Form** and managed in **VMP Database**.

Source SQL: `database/sqlite/schema.sql`

| Field | Type | Rule |
|---|---|---|
| `id` | text | Internal primary key (UUID) |
| `record_id` | text | Unique business identifier; system-generated |
| `validation_area` | text | Controlled validation area |
| `site_plant` | text | Site/plant label (registry FK deferred) |
| `department` | text | Department/facility label |
| `group_name` | text | Group/subcategory |
| `item_name` | text | Item/system/area name |
| `asset_tag_no` | text | Optional asset/tag identifier |
| `next_due_date` | text | ISO date; sole source for derived due month/year |
| `is_draft` | integer | Draft flag |
| `is_archived` | integer | Archive flag; no hard delete in UI |
| `version` | integer | Optimistic concurrency |

App status: TypeScript model and mock service wired via `VmpAppContext`. Supabase migration pending after SQLite validation and owner approval.
- No update/delete policy is defined for audit records.

## Migration Rules

- Migration source: `supabase/migrations/` reference sequence copied from `reference/supabase/migrations`
- Seed source: `src/data/vrmsProductionData.json`
- Generated seed: `supabase/seed.vrms.generated.sql` via `npm run supabase:seed:vrms`
- Duplicate key: routing tracker for documents, `(registry_type, value)` for registry values, audit ID for audit events
- Re-import behavior: upsert documents/registry/profile rows; audit rows insert with `on conflict do nothing`
- Invalid-row behavior: stop generation/checks before applying
- Reconciliation method: run `npm run verify:vrms-csv` and compare Supabase row counts after applying seed
- Rollback method: restore Supabase backup or run an approved cleanup migration for the target environment

## Data Integrity Rules

- Use Supabase migrations for schema changes.
- Keep workflow app SQLite data local; commit only `workflow-app/database/schema.sql` and source changes.
- Validate `Doc Tracer #` uniqueness and immutable `Routing Tracker #`.
- Preserve audit event ordering and content from the CSV source.
- Do not expose service-role keys to the browser.
- Do not apply migration/seed to production until the baseline and task plan are approved.

## Update Rule

Update this file when important entities, relationships, workflows, migration rules, or integrity controls change. Routine implementation details belong in source files and handoff notes.
