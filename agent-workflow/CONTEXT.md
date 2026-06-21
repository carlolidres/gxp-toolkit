# Project Context

Last Updated: `2026-06-21`

## Identity

- Project: `GxP Toolkit`
- Repository: `carlolidres/gxp-toolkit`
- Owner: `carlolidres`
- Type: `MODERNIZATION`
- Environment: `[LOCAL | DEVELOPMENT | TEST | STAGING | PRODUCTION]`

## Purpose

Consolidate existing GxP systems, tools, modules, data registries, routing workflows, audit records, dashboards, reports, and permission controls into one centralized application (VRMS module implemented in Version 0).

## Users and Workflow

- Users: Authenticated GxP/validation users, signatories, reviewers/approvers, registry maintainers, administrators, and viewers/auditors.
- Workflow: `Sign in → permissions load → open permitted module (VRMS) → create/edit routing document → ordered signatory signing/forwarding → completion updates status/audit → dashboards/database/audit views reflect updated data → permitted exports available`

## Technology

- Frontend: `Vite 8 + React 19 + TypeScript + custom CSS + Recharts (HashRouter)`
- Backend: `Supabase client adapters with mock fallback services`
- Database: `SQLite`
- Authentication: `Supabase Auth (email/password + OAuth: google, azure)`
- Hosting: `GitHub Pages (static SPA)`
- UI: `Custom CSS design system + VRMS layout/navigation patterns`

## Current Priorities

1. Preserve VRMS routing behavior while modernizing it from Google Apps Script/Sheets to React + Supabase.
2. Enforce authenticated access and menu-level permissions (role-based access via user menu permissions).
3. Ensure auditable routing + data integrity (ordered signatories, immutable routing tracker, duplicate-prevention) and verification readiness (lint/test/build + workflow/schema/env/supabase checks).

## Critical Constraints

- No service-role keys or production secrets in frontend/browser code or committed docs/source.
- Preserve immutable behavior: routing tracker is auto-generated and cannot change after creation; Doc Tracer # must remain unique.
- Preserve auditability and correctness: audit events are append-only through application behavior; workflow stages/status transitions must remain internally consistent with the legacy VRMS rules.

## Sources of Truth

| Area | Source |
|---|---|
| Agent routing | `AGENTS.md` |
| Simplicity rule | `agent-workflow/PONYTAIL.md` |
| Current status | `agent-workflow/HANDOFF.md` |
| Active work | `agent-workflow/PLAN.md` |
| Approved requirements | `agent-history/version-0-baseline.md` |
| Editable SQLite schema | `database/sqlite/` |
| Generated schema map | `sqlite-out/` |
| Human data map | `agent-workflow/DATA_MAP.md` |
| Deployment | `[DEPLOYMENT_WORKFLOW_PATH]` |

`database/sqlite/` is authoritative. `sqlite-out/` is generated and read-only.

Keep this file limited to stable identity, stack, priorities, and constraints. Put implementation, schema, task, and history details in their dedicated files.
