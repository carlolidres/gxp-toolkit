# Data Map

Last Updated: `2026-07-21`

## Purpose

Use this file for SQLite, migration, API data flow, reporting, integrity, authorization, and schema-navigation work.

This is a concise human map. It does not replace executable SQL.

## SQLite Sources

| Path | Role | Editing rule |
|---|---|---|
| `database/sqlite/schema.sql` | Core SQLite schema (profiles, VMP, feedback) | Edit when core app models change |
| `database/sqlite/edoc_schema.sql` | eDoc SQLite reference (19 `edoc_*` tables) | Edit before Supabase eDoc migration changes |
| `database/sqlite/edoc_seed.sql` | eDoc pilot fixtures (non-production) | Pilot data only |
| `database/sqlite/seed.sql` | Placeholder SQLite seed template | Do not put regulated/production data here |
| `sqlite-out/` | Generated schema map used for fast navigation | Never edit manually |
| `workflow-app/database/schema.sql` | Local workflow app SQLite schema for approval records, versions, comments, approvals, audit events, and baseline snapshots | Edit only with the workflow app source |
| `workflow-app/data/` | Local generated workflow app database/runtime data | Gitignored; do not commit |

Current status: Core VMP tables and **eDoc reference schema** are in `database/sqlite/`. Regenerate with `npm run db:map`; validate eDoc with `npm run verify:edoc-sqlite`.

Workflow app status: `workflow-app/` uses its own local SQLite store for approval workflow tracking. It is not the VRMS application schema and is not deployed with the Vite app.

## Supabase Sources

| Path | Role | Editing rule |
|---|---|---|
| `supabase/migrations/20260616000000_initial_gxp_toolkit_schema.sql` through `20260627100000_app_feedback_messages.sql` | VRMS schema, auth profiles, grants, menu permissions, RLS fixes, feedback | Review before applying |
| `supabase/migrations/20260704100000_edoc_supabase_module.sql` | eDoc module: `edoc_*` tables, RLS, RPCs, storage buckets, inbox view | Applied staging 2026-07-04 |
| `supabase/migrations/20260713170000_registry_values_ci_unique_and_rls.sql` | Registry CI unique index + `has_registry_menu_action` RLS | Applied remote 2026-07-13 |
| `supabase/scripts/verify_edoc_rls.sql` | Static eDoc RLS/schema validation | Run after eDoc migration |
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
| Profile | `profiles` | Application profile and authorization metadata linked to optional Supabase Auth identity; includes `must_change_password` and `password_reset_requested_at` for admin-approved reset | `id` text | `supabase/migrations/20260617000000_vrms_schema.sql`, `20260623200000_admin_default_password_reset.sql`, `20260709102630_admin_approved_password_reset.sql` |
| User menu permission | `user_menu_permissions` | Menu/action grants by profile | `(user_id, menu_id)` | `supabase/migrations/20260618100000_user_menu_permissions.sql` |
| Routing document | `routing_documents` / `routingDocuments` | VRMS document routing record and signatory tracker | `routing_tracker` | `reference/VRMSdatabase/VRMS - Documents.csv` |
| Registry value | `registry_values` / `registryValues` | Controlled values for status, routing recipients, report/protocol, client, category, department, prepared by, checked by | `id`; unique `(registry_type, value)` | Registry CSV exports |
| Audit event | `audit_events` / `auditEvents` | Append-only VRMS activity/audit history | `id` | `reference/VRMSdatabase/VRMS - AuditTrail.csv` |
| VMP masterlist record | `vmp_masterlist_records` / `VmpMasterlistRecord` | Validation masterlist entries (form + database) | `id` (internal UUID); unique `record_id` | `database/sqlite/schema.sql`; mock store `src/services/mockVmpMasterlistService.ts` |
| eDoc organization | `edoc_organizations` | Tenant boundary for eDoc documents and routing | `id` | `database/sqlite/edoc_schema.sql`; `supabase/migrations/20260704100000_edoc_supabase_module.sql` |
| eDoc document | `edoc_documents` | Controlled PDF document metadata and lifecycle status | `id`; unique `(organization_id, document_number)` | Same |
| eDoc route assignment | `edoc_route_step_assignees` / `edoc_assignment_inbox` view | Inbox tasks for review/approve/sign/acknowledge | `id` | Same |
| eDoc audit event | `edoc_audit_events` | Append-only eDoc workflow audit (trigger-protected on Supabase) | `id` | Same |

## eDoc Create-and-Send Draft Flow

UI: `src/pages/edoc/EdocCreateDocumentPage.tsx` → service `edocService.createAndSendDraft` → RPC `edoc_create_and_start_route` (`p_payload`).

Payload type: `EdocCreateDraftInput` in `src/features/edoc/types.ts`.

| Wizard step | Collected fields | Persistence notes |
|---|---|---|
| Metadata | `documentNumber`, `title`, `priority`, `dueAt`, `description` | Required: number + title. Other metadata keys (`documentType`, `category`, `department`, `businessUnit`, `confidentiality`, `tags`, `retentionClass`) keep client defaults and are still sent in `p_payload`. |
| PDF upload | `file.name`, `sizeBytes`, `mimeType`, `sha256` | Client validates MIME/extension + PDF signature (`fileValidation`) before continue. |
| Routing | `routing.mode`, `steps[]` (action, assignees, completion rule, minimum count, due, delegation) | Every step needs ≥1 assignee before send. |
| Field placement | `fields[]` (assignee draft id, type, page, normalized x/y/w/h, required) | One required field per assignee draft before send. |
| Review / send | Summary only | Calls RPC; mock fallback returns synthetic ids when Supabase is not configured. |

Related tables (via RPC): `edoc_documents`, `edoc_document_versions`, `edoc_document_files`, `edoc_document_routes`, `edoc_route_steps`, `edoc_route_step_assignees`, `edoc_signature_fields`, `edoc_audit_events`.

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

- `(registry_type, value)` is unique (legacy exact match).
- Case/whitespace-insensitive uniqueness is enforced by `idx_registry_values_type_value_ci` after migration `20260713170000_registry_values_ci_unique_and_rls.sql`.
- Insert/update/delete require Registry menu `create` / `edit` / `delete` (or admin) via `has_registry_menu_action`.
- Registry changes create audit events through app behavior.
- Deleting a suggestion does not rewrite historical `routing_documents` text values.
- SQLite reference table is included in `database/sqlite/schema.sql` for agent schema mapping.

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
