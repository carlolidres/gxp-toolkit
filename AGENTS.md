# AGENTS.md

## Purpose

This is the canonical instruction router for AI coding agents. Its job is to load the smallest useful context set for the assigned task.

Do not scan the repository or load every workflow document by default.

---

## Required Startup

Before modifying code:

1. Read this file.
2. Read `agent-workflow/CONTEXT.md`.
3. Read `agent-workflow/HANDOFF.md`.
4. Read only the task-specific document below.
5. Read `agent-workflow/PONYTAIL.md` once per coding session if its rules are not already in context.
6. Inspect only the directly affected source files.

| Task | Additional file |
|---|---|
| Source code, UI, routing, components | `agent-workflow/CODEMAP.md` |
| Database, SQLite, migration, API data flow | `agent-workflow/DATA_MAP.md` |
| Accepted implementation work | `agent-workflow/PLAN.md` |
| Browser evidence or runtime verification | `agent-workflow/BROWSER_TESTING.md` |
| Approved requirements, architecture, security, GxP, roles, audit, retention | `agent-history/version-0-baseline.md` |
| Historical regression investigation | Only the relevant `agent-history/version-*-handoff.md` |

For GxP-impacting implementation, also read the approved task plan at `plans/.../plan.md`. Do not implement regulated behavior without the required approval record.

### Ponytail Rule

Read `agent-workflow/PONYTAIL.md` once per coding session before making code changes. Do not reopen it during the same task when its rules are already known.

The rule is platform-neutral and applies to every AI coding agent, editor, and CLI workflow.

---

## Context-Efficiency Rules

- Use targeted search instead of repository-wide inspection.
- Do not reopen files whose relevant content is already known.
- Do not load dependencies, generated builds, logs, archives, or binary databases unless required.
- Use `CODEMAP.md` to locate code and `DATA_MAP.md` to locate data structures.
- Read the baseline only when a baseline trigger applies.
- Keep outputs focused on decisions, changes, verification, risks, and blockers.
- Prefer deletion, reuse, native features, standard libraries, and already-installed dependencies before adding code.
- Do not create a new abstraction, helper, dependency, document, or file unless it has a clear present use.

---

## SQLite Reading and Editing Rules

| Path | Role |
|---|---|
| `database/sqlite/` | Editable, version-controlled SQLite schema and migration SQL |
| `sqlite-out/` | Generated schema map; read-only navigation output |

For SQLite work:

1. Read `agent-workflow/DATA_MAP.md`.
2. Read only the relevant generated map file or section in `sqlite-out/`.
3. Open only the SQL files in `database/sqlite/` required for the change.
4. Edit `database/sqlite/`; never manually edit `sqlite-out/`.
5. Run the project-approved schema-map generation command.
6. Review the generated diff and update `DATA_MAP.md` and `HANDOFF.md` when the schema meaningfully changes.

Do not load all SQL files and all generated maps together unless a full schema review is explicitly required.

---

## Project Paths

- Application source: `src/`
- Current context: `agent-workflow/CONTEXT.md`
- Simplicity rule: `agent-workflow/PONYTAIL.md`
- Code map: `agent-workflow/CODEMAP.md`
- Data map: `agent-workflow/DATA_MAP.md`
- Active plan: `agent-workflow/PLAN.md`
- Current handoff: `agent-workflow/HANDOFF.md`
- Browser workflow: `agent-workflow/BROWSER_TESTING.md`
- Approved baseline: `agent-history/version-0-baseline.md`
- Historical handoffs: `agent-history/`
- Approved task plans: `plans/`
- Editable SQLite SQL: `database/sqlite/`
- Generated SQLite maps: `sqlite-out/`
- Reusable templates: `project-templates/`

---

## Standard Commands

Replace placeholders with project-approved commands.

```text
Install:           npm install
Develop:           npm run dev
Lint:              [NOT_CONFIGURED]
Type-check:        npm run type-check
Test:              npm run test
Build:             npm run build
Verify:            npm run verify:vrms-csv && npm run test && npm run build
SQLite map sync:   [SQLITE_MAP_COMMAND]
Deploy:            GitHub Actions workflow `.github/workflows/deploy-pages.yml`
```

---

## Working Rules

Always:

- Inspect the existing implementation before editing.
- Apply the smallest change that satisfies the approved requirement.
- Preserve approved business rules and workflow behavior.
- Reuse existing components, services, types, utilities, and patterns.
- Keep database changes in version-controlled SQL or migrations.
- Validate trust boundaries and protect against data loss.
- Add one small runnable check for non-trivial logic.
- Run applicable verification before declaring completion.
- Report failed checks, assumptions, blockers, and unresolved risks honestly.
- Update `agent-workflow/HANDOFF.md` after meaningful completed work.

Never:

- Expose secrets in code, documentation, logs, screenshots, or browser bundles.
- Edit generated files manually unless the project explicitly requires it.
- Bypass authentication, authorization, validation, audit, approval, or compliance controls.
- Rewrite the approved baseline without explicit project-owner approval.
- Delete or rewrite historical handoffs.
- Claim that checks passed when they were not run.
- Commit, push, merge, deploy, or migrate unless explicitly requested or required by the approved workflow.

---

## Baseline Triggers

Read `agent-history/version-0-baseline.md` when the task affects:

- scope, business goals, or approved workflow;
- database architecture or record relationships;
- authentication, roles, permissions, or authorization;
- audit trail, data integrity, retention, privacy, or GxP controls;
- hosting, deployment, environment, or security architecture;
- migration rules or approved source-to-target behavior;
- any conflict with an approved requirement.

Routine styling, copy changes, and isolated implementation fixes do not require the full baseline unless they trigger one of the conditions above.

---

## Completion Requirements

Before declaring completion:

1. Confirm the requested behavior.
2. Run applicable lint, type-check, tests, build, smoke, migration, and security checks.
3. Review the diff for unrelated changes.
4. For SQLite changes, regenerate `sqlite-out/` and confirm schema sync.
5. Update affected maps and `agent-workflow/HANDOFF.md`.
6. Create a versioned handoff only for meaningful completed work, releases, migrations, or deployment checkpoints.
7. Record verification results, known issues, risks, and next action.
8. Record commit and deployment status only when those actions occurred.

Recommended commit format:

```text
v[VERSION]: [concise summary]
```
