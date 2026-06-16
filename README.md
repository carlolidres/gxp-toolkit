# GxP Toolkit

GxP Toolkit is a reusable Vite + React + TypeScript starter for quality-systems and GxP-oriented web applications. It includes reusable UI patterns, mock authentication, SQLite schema mapping, Supabase-ready service interfaces, GitHub Pages deployment, and AI-agent workflow documentation.

The UI uses **custom CSS + Recharts** (not Ant Design at runtime). Ant Design links in `REFERENCE_LINKS.md` are external study references only.

The application uses mock data and small service interfaces so copied projects can adopt Supabase, REST APIs, local JSON, or other providers without rewriting every page component.

Workflow for AI-assisted development:

```txt
Codex first → Cursor second → Verification
```

## What This Template Is For

This repository is a reusable starter, not a finished business application.

It provides:

* Vite + React + TypeScript + custom CSS + Recharts
* SQLite schema reference with generated `sqlite-out/` map (`npm run db:map`)
* Graphify codebase map (`npm run graphify:update`)
* Reusable layouts, dashboards, forms, tables, charts, and feedback patterns
* Mock authentication, protected routes, and role examples
* Supabase-ready frontend integration patterns
* GitHub Pages deployment direction
* Structured AI-agent workflow in `agent-workflow/`

## Start

```bash
git clone <repository-url> my-new-project
cd my-new-project
npm install
cp .env.example .env.local        # Unix/macOS — or: copy .env.example .env.local (Windows)
npm run dev
```

You may also copy this folder manually without Git if you prefer.

**Environment:** `.env.example` is the committed template (no secrets). Copy it to `.env.local` for local values — `.env.local` is gitignored. Supabase vars are optional until backend integration; the app runs with mock data without them.

Use any password on the sample login page. Select `Admin`, `Manager`, `Editor`, or `Viewer` to exercise mock role behavior.

## Common Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
```

Additional scripts when available:

```bash
npm run preview
npm run graphify:check
npm run graphify:update
npm run db:map
npm run verify:schema
npm run db:init
npm run db:update
```

If a command is unavailable, document that in `agent-workflow/HANDOFF.md`.

## Structure

```txt
/
├── AGENTS.md
├── README.md
├── agent-workflow/
│   ├── AGENTS.md
│   ├── DOX.md
│   ├── HANDOFF.md
│   ├── PLAN.md
│   ├── REFERENCE_LINKS.md
│   └── agent-history/
├── .cursor/rules/graphify.mdc
├── public/
├── docs/
└── src/
    ├── app/
    ├── components/
    ├── data/
    ├── hooks/
    ├── pages/
    ├── services/
    ├── styles/
    ├── types/
    └── utils/
```

## How to Use This Template for a New Project

1. Clone or copy this repository into a new folder.
2. Rename the project folder if needed.
3. Run `npm install` and `npm run dev` to confirm the app starts.
4. Update template-specific values (see checklist below).
4. Update **`baseline-.md` only** with your project definition (see checklist below).
6. Update `agent-workflow/HANDOFF.md` and `agent-workflow/PLAN.md`.
7. Ask Codex or Cursor to read `agent-workflow/AGENTS.md` before making changes.

Keep the minimal root `AGENTS.md` at the project root. It redirects agents to `agent-workflow/AGENTS.md`.

Child `AGENTS.md` files may be added only for durable subtrees with their own rules, for example:

```txt
/new-project-root/src/components/AGENTS.md
/new-project-root/src/features/AGENTS.md
/new-project-root/supabase/AGENTS.md
```

## What to Change When Adapting the Template

Replace template-specific values:

* Project name
* App title
* Package name in `package.json`
* GitHub repository name
* Vite base path
* Supabase project URL
* Supabase anon key
* Environment variables
* App routes
* Sidebar menu items
* Dashboard content
* Form fields
* Table columns
* User roles
* Branding, colors, logo, and icons
* README project description
* Baseline project definition in **`baseline-.md`**

## How to Tailor This Template to Your Project

Before coding, define:

* What the new project is
* Who will use it
* What user roles are needed
* What pages are needed
* What forms are needed
* What database tables are needed
* What dashboard metrics are needed
* What workflows need approval, status tracking, or audit trail
* What data should be stored in Supabase
* What features should stay frontend-only
* What should be removed from the template

Recommended first prompt after copying:

```txt
Read and execute agent-workflow/AGENTS.md. This folder was copied from a reusable starter/template project. Update the project documentation, agent-workflow files, HANDOFF baseline, PLAN.md, and README.md so they match this new project. Preserve the Codex-first, Cursor-second, and Graphify workflow.
```

## AI-Agent Workflow

Codex, Cursor, and future agents must read:

```text
agent-workflow/AGENTS.md
↓
agent-workflow/DOX.md
↓
agent-workflow/HANDOFF.md
↓
agent-workflow/PLAN.md
```

Purpose of each file:

| File | Purpose |
|------|---------|
| `agent-workflow/AGENTS.md` | Main instruction file for AI agents |
| `agent-workflow/DOX.md` | Documentation and workflow rules |
| `agent-workflow/HANDOFF.md` | Current status, verification, known issues, and next steps |
| `agent-workflow/PLAN.md` | Active implementation plan |
| `agent-workflow/REFERENCE_LINKS.md` | External references only |
| `baseline-.md` | Project owner baseline — what to build |
| `agent-workflow/agent-history/version-0-baseline.md` | Template-invariant workflow rules |

Codex plans and implements, runs available verification, then updates `agent-workflow/HANDOFF.md`.

Cursor reads the same files plus `.cursor/rules/graphify.mdc`, performs Graphify-assisted or manual dependency mapping, reviews integration and regressions, runs final verification, then updates `agent-workflow/HANDOFF.md`.

## How to Update the Baseline for a New Project

When the template is copied into a real project, update:

```text
baseline-.md
```

The baseline should include the new project’s:

* Project name
* Objective
* Business rules
* Tech stack
* User roles
* Database design
* Main workflows
* Pages and modules
* Security rules
* Deployment target
* Definition of done

## Recommended Adaptation Workflow

```text
1. Copy the template.
2. Rename the project.
3. Update package.json.
4. Update README.md.
5. Update baseline-.md.
6. Update agent-workflow/PLAN.md.
7. Ask Codex or Cursor to read agent-workflow/AGENTS.md.
8. Replace sample pages, routes, forms, tables, and dashboard widgets.
9. Configure Supabase only if the project needs backend/database/auth.
10. Run build, lint, and test verification.
11. Update agent-workflow/HANDOFF.md.
12. Commit the customized starter project.
```

## What Not to Do

* Do not commit `.env`, `.env.local`, or `.env.*.local` — commit `.env.example` only.
* Do not hardcode secrets.
* Do not expose Supabase service role keys in frontend code or `VITE_*` variables.
* Do not store CI/CD secrets in the repository — use GitHub Actions repository secrets.
* Do not treat `dist/`, `node_modules/`, or Graphify output as source files.
* Do not bulk-copy external repositories listed in `agent-workflow/REFERENCE_LINKS.md`.
* Do not add business-specific logic to the reusable baseline unless intentionally converting the template into a real project.

## Reusable Components

* App shell, navigation, breadcrumbs, profile menu, and responsive layout
* Mock authentication, protected routes, and role examples
* Dashboard cards, tables, search, filters, pagination, forms, modals, toasts, and state feedback
* Statistical summaries and multiple chart types
* Document lifecycle, routing, approvals, and e-signature simulations
* Typed mock data, replaceable services, export helpers, and focused utility tests

These are reference implementations, not production security or compliance controls.

## Graphify

Install and confirm Graphify when dependency mapping is needed:

```powershell
py -m pip install --upgrade --user graphifyy
py -m pip show graphifyy
```

Graphify output is a navigation aid. Verify behavior in source before editing or making correctness claims. Never report Graphify as executed unless its command completed successfully. If Graphify is unavailable, use direct search and manual dependency tracing.

## Backend and Security Notes

* Implement service interfaces for the chosen backend.
* Enforce authorization on a trusted server or with database policies such as Supabase Row Level Security.
* Process provider webhooks on a trusted backend.
* Never place privileged keys in Vite client variables.
* Treat uploads, notifications, workflow actions, and signatures in this template as mock behavior.
