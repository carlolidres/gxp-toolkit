# Version 0 Baseline Builder

## Purpose

Use this file only when creating or revising a project's Version 0 baseline.

Do not require coding agents to read this file during routine implementation work.

The completed output must be saved as:

```text
agent-history/version-0-baseline.md
```

---

# Section 1 — Project Creator Questionnaire

## Project Identity

1. Project name:
   - GxP Toolkit
2. Project folder:
   - `C:\Users\Carlo Mauring Lidres\OneDrive\Desktop\Projects\00 Working Projects\gxp-toolkit`
3. Repository:
   - Target repository for v2 is `[TBD — PROJECT OWNER TO CONFIRM]`; reference repository is `carlolidres/gxp-toolkit`.
4. Project owner:
   - `carlolidres`
5. Reviewers or approvers:
   - `@carlo-mauring`; additional reviewers `[TBD — PROJECT OWNER TO CONFIRM]`
6. Project type:
   - MODERNIZATION
7. Baseline date:
   - 2026-06-20

## Objective and Scope

8. What business problem will the system solve?
   - Consolidate existing GxP systems, tools, modules, data registries, routing workflows, audit records, dashboards, reports, and permission controls into one centralized application instead of maintaining separate Google Apps Script, Google Sheets, sample toolkit, and standalone reference projects.
9. What is the approved project objective?
   - Build **GxP Toolkit** as the centralized application for existing GxP projects and workflows, using the current `gxp-toolkit` reference project as the primary source of truth for Version 0. The confirmed implemented module is VRMS — Validation Routing Monitoring System.
10. What is in scope?
    - Central GxP Toolkit application shell; VRMS module with Dashboard, Document Routing, Database, Audit Trail, Registry, and User Management; Supabase-backed authentication, profiles, menu permissions, routing documents, registry values, audit events, production VRMS CSV import, GitHub Pages deployment, agent workflow documentation, baseline and handoff workflow.
11. What is out of scope?
    - Google Sheets sync or dual-write; EDMS integration beyond status labels; email notification delivery; mobile-native application; unconfirmed consolidation of non-VRMS reference projects into production modules; production use of service-role keys in the frontend.
12. What are the main business goals?
    - Preserve VRMS routing behavior while modernizing it from Google Apps Script/Sheets to React + Supabase; centralize GxP workflows under one app name and shell; support auditable document routing and registry management; enforce authenticated access and menu-level permissions; provide dashboards and exportable operational views; maintain repeatable AI-agent handoff, verification, and deployment workflow.
13. What measurable success criteria apply?
    - VRMS production snapshot imports 112 documents, 791 audit events, and 148 registry values; required scripts pass when available: `npm run lint`, `npm run test`, `npm run build`, `npm run verify:workflow`, `npm run verify:schema`, `npm run verify:env`, `npm run verify:supabase`, `npm run db:map`, `npm run graphify:check`; duplicate Doc Tracer # is rejected; routing tracker remains immutable; only permitted menus/actions are available; no real secrets are committed.

## Users and Permissions

14. Who will use the system?
    - Authenticated GxP/validation users, signatories, reviewers/approvers, registry maintainers, administrators, and viewers/auditors. Additional user groups for non-VRMS modules are `[TBD — PROJECT OWNER TO CONFIRM]`.
15. What roles are required?
    - Implemented profile roles: `admin`, `manager`, `editor`, `viewer`, `user`. UI role mapping also includes Admin, Manager, Editor, and Viewer.
16. What modules may each role access?
    - Module access is controlled per user through `user_menu_permissions` for Dashboard, Document Routing, Database, Audit Trail, Registry, and User Management. Admin can manage user permissions; specific default grants per role beyond the implemented permission normalization are `[TBD — PROJECT OWNER TO CONFIRM]`.
17. What actions may each role perform?
    - Supported menu actions are View, Create, Edit, Delete, Approve, and Export. Dashboard supports View/Export; Document Routing supports View/Create/Edit/Delete/Approve/Export; Database supports View/Export; Audit Trail supports View/Export; Registry supports View/Create/Edit/Delete; User Management supports View/Create/Edit/Delete.
18. What data-scope rules apply?
    - Current VRMS RLS grants authenticated users broad read/write access to routing documents, registry values, and audit inserts for parity with the legacy open-team model. User profiles and menu permissions have own-profile and admin policies. Department-level or record-participant-only scoping is `[TBD — PROJECT OWNER TO CONFIRM]`.
19. Who can administer users and permissions?
    - Users whose `profiles.role` is `admin`, through the Administration / User Management page and admin RLS helper functions.

## Current and Target Technology

20. Current frontend:
    - Reference implementation: Vite 8 + React 19 + TypeScript + custom CSS + Recharts, using HashRouter. Legacy VRMS source: Google Apps Script HTML/CSS/JavaScript.
21. Current backend:
    - Reference implementation: Supabase client adapters with mock fallback services. Legacy VRMS source: Google Apps Script server functions.
22. Current database:
    - Reference implementation: Supabase PostgreSQL with SQLite schema reference and production seed files. Legacy VRMS source: Google Sheets.
23. Current authentication:
    - Reference implementation: Supabase Auth email/password and OAuth providers `google` and `azure`, with mock localStorage fallback when Supabase env vars are placeholders. Legacy VRMS source: Google Workspace active user email.
24. Current hosting:
    - GitHub Pages static SPA for the reference app; local Vite dev/preview for development.
25. Target frontend:
    - Vite + React + TypeScript + custom CSS + Recharts.
26. Target backend:
    - Supabase Auth, PostgreSQL, RLS, and TypeScript service adapters.
27. Target database:
    - Supabase PostgreSQL, with version-controlled migrations under `supabase/migrations/` and SQLite reference schema under `database/sqlite/schema.sql`.
28. Target authentication:
    - Supabase Auth with email/password and OAuth providers as configured; frontend uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
29. Target hosting:
    - GitHub Pages via `.github/workflows/deploy-github-pages.yml`; deployment target for v2 is `[TBD — PROJECT OWNER TO CONFIRM]`.
30. UI framework or design reference:
    - Custom CSS design system, AppShell layout, VRMS sidebar/navigation patterns, Recharts dashboards, and current reference app screens. Ant Design links are study references only, not runtime dependencies.

## Architecture and Workflow

31. What architectural decisions are already approved?
    - Static React SPA on GitHub Pages; HashRouter; Supabase client integration with mock fallback; migrations for database changes; `src/services/*` adapters for backend access; menu registry as permission source of truth; no service-role key in frontend; `.env.example` committed and `.env.local` gitignored; agent workflow uses AGENTS, CONTEXT/HANDOFF/PLAN, baseline, maps, and versioned handoffs.
32. What is the end-to-end workflow?
    - User signs in; permissions load; user opens a permitted module; VRMS data loads from Supabase or mock store; a document is created or edited; Routing status activates ordered signatories; current active signatory signs; workflow advances to the next signer; completion updates status and duration; changes and signing actions append audit events; dashboards/database/audit views reflect updated data; exports are available where permitted.
33. What statuses are allowed?
    - Document statuses: Routing, Completed, Fully Signed, For Scanning, Sent, In EDMS, Returned to, Cancelled, Blank, and empty string for blank legacy values. Signatory statuses: Pending, Active, Signed.
34. What rules control stage transitions?
    - Routing requires at least one signatory; first signatory must match Sent/Routing To; signatory names must exist in the Sent/Routing registry; only one active signer is current; signing marks Active as Signed and forwards to the next Pending signer; all-signed routing sets completion status using registry preference Completed, then Fully Signed, then For Scanning; Cancelled clears signatories and Sent/Routing To.
35. What approval, rejection, cancellation, reopening, and closure rules apply?
    - Approval/signing is performed by the active signatory in order. Cancellation clears signatories and routing recipient. Closure occurs when all signatories are signed and status changes from Routing to a completion status. Rejection, return/reopen behavior beyond the `Returned to` status is `[TBD — PROJECT OWNER TO CONFIRM]`.
36. What dates drive priority or escalation?
    - Target Completion Date drives overdue status when the date has passed and status is not Sent, In EDMS, or Cancelled. Dashboard aging uses routing/signing timestamps. Additional escalation dates are `[TBD — PROJECT OWNER TO CONFIRM]`.

## Data Model

37. What are the primary entities?
    - Profiles, user menu permissions, routing documents, document signatories stored as JSON, registry values, audit events, schema migrations.
38. What are their identifiers?
    - `profiles.id`, `profiles.auth_user_id`, `profiles.email`; `user_menu_permissions` composite key `user_id + menu_id`; `routing_documents.routing_tracker`; `routing_documents.doc_tracer`; `registry_values.id` plus unique `registry_type + value`; `audit_events.id`; `schema_migrations.version`.
39. What relationships exist?
    - User menu permissions reference profiles; Supabase profiles can link to `auth.users` through `auth_user_id`; routing documents contain signatory JSON; audit events may reference routing tracker and doc tracer; registry values supply controlled values for document fields and signatories.
40. What fields and validation rules are critical?
    - Required document fields: Doc Tracer #, Equipment/Product, Category, Status, Sent/Routing To, Report/Protocol, Batch No., Client Name, Department, Prepared By, Date Prepared, Checked By, Date Checked. IL-Tag and Remarks default to `n/a` when blank. Doc Tracer # must be unique. Routing tracker auto-generates as four alphanumeric characters and cannot change after creation. Registry values must be nonblank, max 120 characters, and match the implemented readable-text pattern.
41. What reference or registry data is required?
    - Registry types: Status, Sent / Routing, Report / Protocol, Client, Category, Department, Prepared by, Checked by. Production defaults are imported from `reference/VRMSdatabase/`.
42. What duplicate-prevention rules apply?
    - Unique Doc Tracer #; unique Routing Tracker #; unique registry type/value pairs; unique profile email; unique user/menu permission rows; OAuth/profile trigger updates existing profile by email instead of creating duplicate profile rows.
43. What archive, retention, and deletion rules apply?
    - Audit events are append-only through application behavior and are readable by authenticated users; registry values can be deleted by permitted users. Formal archive, retention period, audit immutability enforcement, and document deletion policy are `[TBD — PROJECT OWNER TO CONFIRM]`.

## Notifications, Dashboard, and Reporting

44. What events generate notifications?
    - Implemented UI/auth status messages for OAuth loading, success, cancellation, and failure. No email notification delivery is implemented. Business notification triggers for routing, overdue, return, cancellation, and completion are `[TBD — PROJECT OWNER TO CONFIRM]`.
45. Who receives them?
    - Implemented OAuth status messages are shown to the current user. Business notification recipients are `[TBD — PROJECT OWNER TO CONFIRM]`.
46. What escalation rules apply?
    - Overdue records are identifiable from Target Completion Date and status. Automated escalation rules are `[TBD — PROJECT OWNER TO CONFIRM]`.
47. What dashboards and KPIs are required?
    - VRMS Dashboard: total documents, Routing, For Scanning, Sent, In EDMS, Cancelled, overdue, average aging, documents by status donut, individual signatory KPI table, recent records, and active routing lists. Dashboard elements deep-link to filtered database records where implemented.
48. What reports and export formats are required?
    - CSV export for database/document rows and permitted dashboard/database/audit exports. Additional report formats are `[TBD — PROJECT OWNER TO CONFIRM]`.

## Audit, Compliance, and Security

49. What actions must be audited?
    - Document creation, document updates with field differences, routing signatory signing/forwarding/completion, registry value additions, and registry value deletions. User/profile/permission changes are required by the workflow but application-level audit records for those changes are `[TBD — PROJECT OWNER TO CONFIRM]`.
50. What must each audit record contain?
    - Audit event id, event timestamp, user email, action, routing tracker, doc tracer, details, and created timestamp; details include field changes or signatory/registry action context.
51. What compliance, quality, privacy, or retention requirements apply?
    - GxP-oriented auditability, controlled registry data, no exposed secrets, version-controlled migrations, verification before handoff, and preservation of approved behavior. Formal Part 11/e-signature, privacy classification, retention duration, and backup policy are `[TBD — PROJECT OWNER TO CONFIRM]`.
52. What authentication and session controls apply?
    - Supabase Auth persists sessions, auto-refreshes tokens, detects session in URL, uses PKCE flow, restores sessions before protected-route rendering, blocks inactive users, supports logout, and uses mock fallback only when Supabase config is placeholder.
53. What row-level, record-level, or department-level controls apply?
    - Supabase RLS is enabled. Profiles and user permissions use own-user and admin policies. Routing documents, registry values, and audit events currently use broad authenticated policies matching legacy open-team behavior. Department/record-level controls are `[TBD — PROJECT OWNER TO CONFIRM]`.
54. Where will frontend-safe configuration be stored?
    - `.env.example`, `.env.local` for local development, and GitHub Actions secrets for `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV`, `VITE_BASE_PATH`, and `VITE_GITHUB_PAGES`.
55. Where will privileged secrets be stored?
    - Supabase dashboard and GitHub Actions repository/environment secrets as applicable. Privileged service-role keys must not be stored in the repository or exposed to browser code.
56. Does any credential require rotation?
    - `[TBD — PROJECT OWNER TO CONFIRM]`

## Migration and Deployment

57. What data or application is being migrated?
    - VRMS Google Apps Script + Google Sheets behavior and production data are confirmed; the project objective also calls for consolidation of all existing GxP projects/systems/tools/modules/workflows, but non-VRMS source-to-target scope is `[TBD — PROJECT OWNER TO CONFIRM]`.
58. What approved behavior must be preserved?
    - VRMS document CRUD, duplicate Doc Tracer rejection, immutable tracker, ordered signatories, active signer rule, status lifecycle, registry management, audit trail, dashboard metrics, database filters, CSV export, and 15-second refresh or equivalent Realtime parity.
59. What source-to-target mapping applies?
    - Legacy `Code.gs` functions map to TypeScript services; Google Sheets `Documents` maps to `routing_documents`; `AuditTrail` maps to `audit_events`; `Registry_*` sheets map to `registry_values`; Google active user email maps to Supabase profile/auth email; `google.script.run` maps to Supabase client service calls.
60. What reconciliation and rollback methods apply?
    - Reconcile imports using row counts and status distribution from production CSVs; regenerate seed via `npm run import:vrms`; rollback bad code with Git revert/restore; rollback bad GitHub Pages deploy by rerunning a prior successful workflow or reverting the deploy commit; Supabase downgrade scripts are `[TBD — PROJECT OWNER TO CONFIRM]`.
61. What repository and deployment configuration applies?
    - Reference repo `carlolidres/gxp-toolkit`; GitHub Pages workflow `.github/workflows/deploy-github-pages.yml`; push to `master` or manual workflow dispatch; Node 20; `npm ci`; `npm run build`; artifact path `dist`; Vite base path `/gxp-toolkit/` for reference. v2 repository/deploy path is `[TBD — PROJECT OWNER TO CONFIRM]`.
62. What install, lint, test, build, verify, and deploy commands apply?
    - Install: `npm install` or CI `npm ci`; Develop: `npm run dev`; Lint: `npm run lint`; Type-check/build: `npm run build`; Test: `npm run test`; Preview: `npm run preview`; Verify: `npm run verify:workflow`, `npm run verify:schema`, `npm run verify:env`, `npm run verify:supabase`, `npm run db:map`, `npm run graphify:check`; Import: `npm run import:vrms`; Supabase deploy: `npm run deploy:supabase`; GitHub Pages deploy: push to `master` or workflow dispatch.

## Non-Functional and Verification Requirements

63. Performance targets:
    - Dashboard and database should remain responsive for the confirmed production snapshot of 112 documents, 791 audit events, and 148 registry values. Numeric page-load and dashboard-response targets are `[TBD — PROJECT OWNER TO CONFIRM]`.
64. User-capacity target:
    - `[TBD — PROJECT OWNER TO CONFIRM]`
65. Availability target:
    - `[TBD — PROJECT OWNER TO CONFIRM]`
66. Browser, device, accessibility, and localization requirements:
    - Browser-based responsive SPA with desktop and smaller-screen layout fallbacks; accessibility and localization targets are `[TBD — PROJECT OWNER TO CONFIRM]`.
67. Backup and recovery requirements:
    - Git provides source rollback; GitHub Pages workflow can rerun prior deployments; Supabase backup/recovery requirements are `[TBD — PROJECT OWNER TO CONFIRM]`.
68. Required automated and manual verification:
    - Automated: lint, tests, build, workflow verification, schema verification, env verification, Supabase structure smoke, DB map, Graphify check, VRMS logic tests. Manual: VRMS parity against legacy behavior; authentication/OAuth provider setup and callback test; dashboard/filter/export smoke test; permission matrix and direct-route access test.
69. Definition-of-done additions:
    - Preserve baseline/handoff workflow; update only relevant docs/code; run applicable verification or report why not run; no secrets in docs/source; unresolved decisions marked `[TBD — PROJECT OWNER TO CONFIRM]`; migration behavior reconciled against reference data; known issues and conflicts reported.

---

# Section 2 — Prompt to Generate the Baseline

Copy the prompt below and provide it together with:

- The completed questionnaire
- `agent-history/version-0-baseline.md`
- Approved reference materials

```text
Prepare the Version 0 baseline for this software project.

Use the completed project-creator questionnaire to populate
`agent-history/version-0-baseline.md`.

Mandatory rules:

1. Preserve the baseline and handoff workflow.
2. Keep Version 0 as the permanent source of truth after approval.
3. Do not invent requirements, fields, statuses, roles, dates, URLs, commands, or technologies.
4. Use `[TBD — PROJECT OWNER TO CONFIRM]` for missing decisions.
5. Use `[TBD — CONFLICT REQUIRES PROJECT OWNER DECISION]` for unresolved contradictions.
6. Never insert passwords, private keys, tokens, service-role keys, or production secrets.
7. Preserve the file's Markdown hierarchy and required sections.
8. Make every approved requirement concise, testable, and internally consistent.
9. Ensure roles align with permissions.
10. Ensure workflows align with statuses, dates, notifications, and data relationships.
11. Ensure security requirements align with the selected architecture.
12. Ensure deployment requirements align with the selected hosting platform.
13. Keep the Definition of Done, Version Handover Workflow, Reviewers Feedback,
    and Baseline Approval sections.
14. Output the completed Markdown only.
```

---

# Section 3 — Baseline Completion Check

Before approving Version 0, confirm:

- [x] Project objective is approved.
- [x] Scope is explicit.
- [x] Business goals are measurable where possible.
- [x] Success criteria are testable.
- [x] Roles and permissions are aligned.
- [x] Workflow stages and statuses are consistent.
- [x] Data entities and relationships support the workflow.
- [ ] Notification and escalation rules are defined.
- [ ] Audit and retention requirements are defined.
- [x] Security and secret-handling rules are defined.
- [ ] Migration and rollback controls are defined, when applicable.
- [x] Verification and release criteria are defined.
- [x] No real secrets are present.
- [ ] Baseline approval is recorded.
