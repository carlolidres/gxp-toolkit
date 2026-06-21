> **Project owners:** define what you are building in **`baseline-.md`** at the repo root. Update that file only when copying the template. Do not put project-specific goals in this file.

# version-0-baseline.md

Template-invariant workflow rules for the **GxP Toolkit** starter (not project-specific definition).

This file is the primary source of truth for project goals, architecture, constraints, reusable-template requirements, approved reference direction, and AI-agent workflow rules.

This file may only be modified with explicit approval from the project owner.

## Baseline Approval

* **Baseline version:** v0
* **Status:** Approved
* **Project owner:** carlolidres
* **Created date:** 2026-06-14

Future versions and session-specific work must be documented in:

```text
agent-workflow/agent-history/version-X-handoff.md
```

## Project Information

* **Project name:** Reusable Vite React Ant Design Starter Template
* **Repository:** ProjectTracker_React
* **Project owner:** carlolidres
* **Created date:** 2026-06-14

## Project Objective

The objective of this project is to provide a reusable Vite + React + TypeScript + Ant Design starter template that can be copied into future web applications as a clean starting point.

The template shall include reusable layouts, dashboard patterns, forms, tables, authentication pages, protected routes, cards, KPI widgets, settings pages, notifications, empty states, loading states, Supabase-ready integration patterns, GitHub Pages deployment setup, and ChatGPT-like collapsible sidebar or side-panel behavior.

The project shall also maintain AI-agent-ready documentation so Codex, Cursor, and future agents can continue work consistently through:

```text
AGENTS.md (root redirect)
agent-workflow/AGENTS.md
agent-workflow/DOX.md
agent-workflow/HANDOFF.md
agent-workflow/PLAN.md
agent-workflow/REFERENCE_LINKS.md
agent-workflow/agent-history/
```

## Business Goals

The template must achieve the following objectives:

1. Provide a ready-to-copy foundation for future Vite + React applications.
2. Reduce repeated setup work for common app components, layouts, forms, dashboards, routing, authentication screens, and reusable UI patterns.
3. Preserve a clean, modular, and scalable folder structure.
4. Use Ant Design as the primary UI framework.
5. Support a ChatGPT-like app shell with collapsible and expandable sidebar or side-panel behavior.
6. Support future Supabase-backed applications through safe frontend integration patterns.
7. Support GitHub Pages static deployment.
8. Maintain clear AI-agent workflow documentation for Codex, Cursor, and future agents.
9. Use `agent-workflow/REFERENCE_LINKS.md` as the central reference index for external GitHub repositories.
10. Preserve reusable-template neutrality and avoid adding business-specific logic unless explicitly approved by the project owner.

## Success Criteria

* [ ] The template can be copied into a new project and understood quickly by a future AI agent.
* [ ] Required workflow files are present and clear.
* [ ] Reusable components are organized in a predictable structure.
* [ ] The app shell supports collapsible sidebar behavior.
* [ ] Ant Design components are used consistently.
* [ ] Supabase-ready patterns are available without exposing private keys.
* [ ] GitHub Pages deployment guidance is documented.
* [ ] `agent-workflow/REFERENCE_LINKS.md` contains external references for UI, analytics, document signing, document routing, and document management.
* [ ] Build, lint, and test commands pass before handoff.
* [ ] Known issues, dependency warnings, and pending work are documented.

## Technology Stack

### Frontend

* React
* TypeScript
* Vite

### Backend

* Supabase-ready structure

### Database

* PostgreSQL through Supabase-ready patterns

### Authentication

* Supabase Auth-ready patterns

### UI Framework

* Ant Design

### Hosting

* GitHub Pages

### Reference and Workflow Support

* Codex
* Cursor
* Graphify
* DOX workflow
* `agent-workflow/REFERENCE_LINKS.md`
* `agent-workflow/agent-history/`

## Architecture Decisions

These decisions are approved unless explicitly changed by the project owner.

### Authentication

Supabase Auth-ready structure shall be supported for future applications.

### Database

Supabase PostgreSQL-ready structure shall be supported for future applications.

### API Layer

Supabase Client shall be used when Supabase integration is required.

### State Management

Use React state and modular hooks by default.

Add a dedicated state management library only when project complexity requires it.

### Deployment

GitHub Pages shall be supported as the primary static hosting target.

### Storage

Supabase Storage-ready patterns may be added for future file upload, document management, or asset storage use cases.

### UI and Layout

Ant Design shall be the main UI framework.

The template shall prioritize reusable layouts, dashboards, forms, tables, and a ChatGPT-like collapsible sidebar or side-panel experience.

### Reference Repositories

External repositories listed in `agent-workflow/REFERENCE_LINKS.md` are for reference only.

Do not download, merge, or bulk-copy external repositories into this template unless explicitly instructed by the project owner.

## User Roles

For this reusable template baseline, include the following default examples only.

When this template is copied into a real project, replace or expand these roles based on the actual business workflow.

### Administrator

System administration privileges.

### Standard User

Normal authenticated application access.

### Viewer

Read-only or limited-access role.

### Future Project-Specific Roles

Future project-specific roles must be documented when the template is copied into a real application.

## Core Functional Requirements

### Reusable App Shell

The template shall include a modern reusable app shell with sidebar navigation, header or top navigation, content area, and responsive layout behavior.

### ChatGPT-like Sidebar

The template shall support collapsible and expandable sidebar or side-panel behavior similar to ChatGPT-style UI patterns.

### Dashboard Components

The template shall include reusable dashboard cards, KPI widgets, summary sections, chart-ready areas, and layout examples.

### Form Components

The template shall include reusable form patterns using Ant Design components.

### Table and Database View Components

The template shall include reusable data table patterns with search, filter, sorting, and action controls.

### Authentication Pages

The template shall include authentication page patterns such as login, protected routes, and user profile menu structure.

### Notification and Toast System

The template shall include notification or toast-ready patterns for user feedback.

### Empty and Loading States

The template shall include reusable loading states, empty states, and error-state patterns.

### Supabase-Ready Integration

The template shall include safe patterns for future Supabase URL and anon-key usage through environment variables.

### Reference Links Index

The template shall include `agent-workflow/REFERENCE_LINKS.md` as the central reference index for external GitHub repositories and documentation links.

## Non-Functional Requirements

### Performance

* Normal page interactions should feel fast and responsive.
* The template should avoid unnecessary heavy dependencies.
* Generated output such as `dist/` should not be treated as source code.

### Security

* No hardcoded secrets.
* No service role key in frontend code.
* Do not commit `.env` or `.env.local`.
* Use frontend-safe environment variables only.
* Future Supabase use must rely on Row Level Security where applicable.

### Scalability

* Components must be modular and reusable.
* Folder structure must be easy to extend.
* Business-specific logic must not pollute the reusable baseline.

### Availability

* The template shall support GitHub Pages deployment for static hosting.
* Future applications may adapt hosting based on project needs.

### Compliance and Traceability

* Handoff documentation must record verification, known issues, and next steps.
* Future projects may add audit trail, traceability, and compliance requirements as needed.

## Business Rules

1. This repository is a reusable starter/template folder.
2. Future agents must read workflow documents before editing.
3. `agent-workflow/agent-history/version-0-baseline.md` is the permanent source of truth.
4. Baseline modifications require explicit approval from the project owner.
5. External reference repositories must be used for study and adaptation only.
6. Do not bulk-copy external repositories into this template.
7. Do not hardcode secrets.
8. Do not expose Supabase service role keys in frontend code.
9. Generated files such as `dist/`, `node_modules/`, and Graphify output must not be treated as source-of-truth files.
10. Each significant coding session must create or update an applicable handoff file.
11. Verification results must be recorded before work is considered complete.
12. If Git is available, commit hash must be recorded in the handoff.
13. Preserve reusable-template neutrality.
14. Avoid adding business-specific logic unless explicitly approved.

## Approved Project Structure

```text
PROJECT_ROOT/
│
├── AGENTS.md
├── README.md
│
├── agent-workflow/
│   ├── AGENTS.md
│   ├── DOX.md
│   ├── HANDOFF.md
│   ├── PLAN.md
│   ├── REFERENCE_LINKS.md
│   └── agent-history/
│       ├── README.md
│       ├── version-0-baseline.md
│       ├── version-1-handoff.md
│       └── version-X-handoff.md
│
├── .cursor/
│   └── rules/
│       └── graphify.mdc
│
├── src/
├── public/
├── docs/
├── package.json
├── package-lock.json
└── .gitignore
```

## Coding Standards

Required standards:

* TypeScript strict mode where practical.
* Component reuse.
* Modular architecture.
* Consistent naming conventions.
* No hardcoded secrets.
* Ant Design-first UI implementation.
* Clear separation of components, layouts, pages, routes, services, hooks, and utilities.
* Avoid unnecessary business-specific logic in the reusable baseline.
* Keep reference code adapted, rewritten, and aligned with this project structure.
* Generated files must not be treated as source files.

## Documentation Standards

Every significant coding session must generate or update:

1. Handoff file
2. Plan or task notes when applicable
3. Verification results
4. Known issues
5. Next steps
6. Git commit when the folder is inside a Git worktree
7. Commit hash recorded in the handoff when a commit is created

No work is complete without documentation.

## Change Control Rules

The following changes require project owner approval:

* Baseline file modifications
* Authentication architecture changes
* Database or Supabase integration changes
* User role changes
* Workflow changes
* Infrastructure or deployment changes
* Major dependency upgrades
* Recharts migration or replacement
* Direct copying or merging of external reference repositories
* Any change that makes the template business-specific instead of reusable

## Known Constraints

* This repository must remain reusable as a starter/template folder.
* External GitHub repositories are references only.
* GitHub Pages is the default deployment target.
* Supabase integration must remain frontend-safe.
* Supabase service role keys must never be exposed in frontend code.
* Dependency audit findings must be reviewed separately.
* Deprecated Recharts 2.x warning must be reviewed separately.
* Graphify output should be generated on demand and ignored by Git.
* Git status may be unavailable if the folder is not inside a Git worktree.

## Definition of Done

A task is complete only when:

* Functionality or documentation update is implemented.
* Verification completed.
* Handoff file created or updated.
* Git commit created when the folder is inside a Git worktree.
* Commit hash recorded when a commit is created.
* Known issues documented.
* Next steps documented.
* Reusable-template purpose preserved.
* Baseline rules remain respected.

## Baseline Maintenance

This baseline remains the permanent source of truth unless revised by the project owner.

Future handoff files must refer back to this baseline when documenting:

* Changes
* Fixes
* Architectural decisions
* Implementation progress
* Verification results
* Known issues
* Next steps
* Commit hashes
