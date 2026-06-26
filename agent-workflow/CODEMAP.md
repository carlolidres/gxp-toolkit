# Code Map

Last Updated: `2026-06-21`

## Purpose

Use this map to locate implementation areas without scanning the repository. List only high-value paths that agents regularly need.

Do not duplicate database schema details here. Database work belongs in `DATA_MAP.md`, `database/sqlite/`, and `sqlite-out/`.

## Application Entry Points

| Path | Responsibility |
|---|---|
| `index.html` | Vite HTML entry that mounts `src/main.tsx` |
| `src/main.tsx` | React bootstrap, HashRouter, theme/auth/permission/toast providers, global CSS imports |
| `src/app/App.tsx` | Root component wrapper for route tree |
| `src/app/routes.tsx` | Route definitions, protected routes, VRMS layout nesting, sample pages |

## Pages and Major Modules

| Module | Path | Responsibility |
|---|---|---|
| Auth | `src/pages/LoginPage.tsx`, `src/pages/SignUpPage.tsx` | Email/password and OAuth entry screens |
| VRMS dashboard | `src/pages/vrms/VrmsDashboardPage.tsx` | Routing KPIs, charts, and work queues |
| VRMS routing | `src/pages/vrms/VrmsRoutingPage.tsx` | Routing document create/edit/sign/forward workflow |
| VRMS database | `src/pages/vrms/VrmsDatabasePage.tsx` | Document database table and filtering |
| VRMS audit | `src/pages/vrms/VrmsAuditPage.tsx` | Audit/event visibility |
| VRMS registry | `src/pages/vrms/VrmsRegistryPage.tsx` | Registry-maintenance views |
| Admin users | `src/pages/admin/UserManagementPage.tsx` | User and menu-permission management |
| Samples | `src/pages/ComponentsShowcasePage.tsx`, `src/pages/StatisticsDashboardPage.tsx` | Component/statistics reference routes |

## Shared Components

| Path | Responsibility |
|---|---|
| `src/components/layout/` | App shell, VRMS layout, sidebar navigation |
| `src/components/brand/` | Reusable application logo components |
| `src/components/vrms/` | VRMS page shell, status badges, VRMS data table |
| `src/components/forms/` | Reusable form controls |
| `src/components/data-display/` | Reusable data table |
| `src/components/charts/` | Recharts wrappers and chart theme |
| `src/components/feedback/` | Loading/empty/error states, modal, toast provider |
| `src/components/auth/` | Protected route, permission route, provider buttons |
| `src/components/permissions/` | Permission matrix UI |
| `src/components/document-routing/` | Routing workflow display components |
| `src/components/documents/` | Document management display components |
| `src/components/e-signature/` | Signature display/input components |

## Services and Data Access

| Path | Responsibility |
|---|---|
| `src/lib/supabase.ts` | Lazy Supabase client creation from Vite env; mock mode when placeholders are used |
| `src/services/authService.ts` | Authentication service facade |
| `src/services/vrmsService.ts` | VRMS service facade |
| `src/services/mockVrmsService.ts` | Mock VRMS data/workflow behavior |
| `src/services/supabaseVrmsService.ts` | Supabase-backed VRMS behavior |
| `src/services/vrmsRepository.ts` | VRMS data repository operations |
| `src/services/vrmsStore.ts` | Runtime VRMS store |
| `src/services/userManagementService.ts` | User-management service facade |
| `src/services/mockUserManagementService.ts` | Mock user-management behavior |
| `src/services/supabaseUserManagementService.ts` | Supabase-backed user-management behavior |
| `src/services/documentService.ts` | Document operation facade |
| `src/services/exportService.ts` | Export operations |

## State, Hooks, Utilities, and Types

| Path | Responsibility |
|---|---|
| `src/context/VrmsAppContext.tsx` | VRMS app data/context state |
| `src/hooks/useAuth.tsx` | Auth state and auth actions |
| `src/hooks/usePermissions.tsx` | Permission state and menu access helpers |
| `src/hooks/useTheme.tsx` | Theme state |
| `src/hooks/useFilters.ts`, `src/hooks/usePagination.ts` | Shared table state helpers |
| `src/lib/permissions.ts`, `src/lib/permissionStorage.ts` | Permission rules and storage mapping |
| `src/lib/vrms*.ts` | VRMS defaults, mapping, status, and form config |
| `src/utils/vrmsLogic.ts` | VRMS routing logic checks and helpers |
| `src/utils/statistics.ts` | Statistics calculations |
| `src/types/` | Shared TypeScript interfaces |

## Configuration

| Path | Responsibility |
|---|---|
| `src/config/appNavigation.ts` | App navigation definitions |
| `src/config/sidebarMenus.ts` | Sidebar menu groups/items |
| `src/config/navigationRegistry.ts` | Menu/permission navigation registry |
| `src/assets/branding/` | Application logo SVG/PNG assets |
| `.env.example` | Committed placeholder env template |
| `vite.config.ts` | Vite React config and Vitest scope |
| `tsconfig*.json` | TypeScript project settings |
| `package.json` | npm scripts and dependencies |

## Local Workflow Utility

| Path | Responsibility |
|---|---|
| `workflow-app/server.py` | Python stdlib HTTP server, workflow API, SQLite store, baseline snapshot writer |
| `workflow-app/database/schema.sql` | Workflow app SQLite tables, indexes, immutability/audit triggers |
| `workflow-app/static/` | Static local workflow UI |
| `workflow-app/scripts/validate_schema.py` | In-memory workflow schema validation check |
| `workflow-app/scripts/smoke_test.py` | End-to-end local workflow smoke check using temporary runtime data |

## Tests

| Path | Responsibility |
|---|---|
| `src/lib/permissions.test.ts` | Permission rule tests |
| `src/lib/permissionStorage.test.ts` | Permission storage mapping tests |
| `src/utils/statistics.test.ts` | Statistics utility tests |
| `src/utils/vrmsLogic.test.ts` | VRMS logic and mock service tests |

## Editing Guidance

- Add new pages under: `src/pages/`
- Add reusable UI under: `src/components/`
- Add feature-specific VRMS UI under: `src/components/vrms/` or `src/pages/vrms/`
- Add service/data-access code under: `src/services/`
- Add editable schema or migration SQL under: `database/sqlite/`
- Do not manually edit generated maps under: `sqlite-out/`
- Add shared types under: `src/types/`
- Add focused tests beside the related source file using `*.test.ts` or `*.test.tsx`

## Important Boundaries

- Protected routes must keep using `ProtectedRoute` and `MenuPermissionRoute`.
- Permission checks must not be treated as UI-only for production Supabase paths.
- Supabase service-role keys must never enter Vite/browser code.
- VRMS routing tracker generation and signatory status behavior live in `src/utils/vrmsLogic.ts` and service layers; preserve audit/data-integrity behavior.
- `workflow-app/` is a local approval utility; do not treat `workflow-app/data/` or `project-files/` as production app data.
- Generated `dist/`, dependency folders, screenshots, and reference archives are not source-of-truth implementation paths.
- Update this map only when important implementation paths are added, moved, renamed, or become regular agent entry points.
