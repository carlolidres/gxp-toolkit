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

## Agent Reliability Guardrails

The agent must prevent context loss, uncontrolled changes, repeated failures, and unsupported assumptions while preserving the token-efficient startup model.

### Preflight Before Implementation

Before making changes, the agent must:

1. Restate the task objective and acceptance criteria in `PLAN.md` or the working response when the task is small.
2. Identify the files expected to be modified and inspect their current implementation before editing.
3. Check current repository, build, database, and runtime status using the smallest applicable commands or recorded evidence.
4. Read the latest relevant task history, open issues, comments, and handoff notes from `HANDOFF.md`, the active `PLAN.md`, and only the applicable versioned handoff or issue reference.
5. Check whether the latest approved baseline applies. Read the relevant baseline section for accepted implementation work, and read the full `agent-history/version-0-baseline.md` when a baseline trigger applies, the active plan requires it, or the task may conflict with approved requirements.
6. Confirm that no instruction conflicts or missing essentials block safe implementation.

Do not begin implementation when essential information is missing, contradictory, or unverifiable. Ask for clarification or record the blocker instead.

### Execution Guardrails

During execution, the agent must:

- Make the smallest change necessary to complete the approved task.
- Avoid modifying unrelated files or generated outputs.
- Validate each significant change before continuing to a larger change.
- Use existing project conventions, reusable components, standard libraries, native features, and installed dependencies before adding new code.
- Never guess table names, routes, schemas, environment variables, configuration keys, dependencies, or business rules.
- Inspect the actual implementation before making assumptions.
- Record important decisions, errors, failed attempts, and meaningful changes in `HANDOFF.md` or the relevant versioned handoff.
- Preserve the last known working state before risky changes by reviewing repository status and avoiding destructive commands unless explicitly approved.

### Dumb-Zone Detection

Stop execution and switch to recovery when any of the following occurs:

- The same error happens repeatedly.
- A previous fix creates additional unrelated errors.
- The agent can no longer clearly explain the current project state.
- The requested task conflicts with the approved baseline or active plan.
- A required file, table, route, dependency, environment variable, or configuration cannot be verified.
- Tests or checks that previously passed begin failing unexpectedly.
- The agent is about to perform a large rewrite for a small issue.
- More than three unsuccessful repair attempts have been made.
- The agent cannot clearly explain why the proposed change should work.

### Recovery Procedure

When a dumb-zone condition is detected, the agent must:

1. Stop making further changes.
2. Return to the last known working state only when safe and non-destructive, or request approval for destructive recovery.
3. Review the latest applicable baseline, active plan, handoff, task history, and modified files.
4. Run the relevant build, lint, type-check, database, and test commands when available.
5. Separate confirmed root cause from assumptions.
6. Prepare a recovery summary with original objective, changes made, errors encountered, confirmed findings, unverified assumptions, files affected, and recommended next action.
7. Request user approval when recovery requires a scope change, architectural decision, destructive action, database migration, or baseline change.

### Context Refresh Checkpoint

After a major stage, several file edits, failed verification, or a long debugging branch, refresh understanding by reviewing:

- current task objective;
- approved requirements and active plan;
- files changed;
- test and build results;
- open issues and assumptions;
- remaining work.

Do not rely only on earlier conversation context when the project state may have changed.

## Context-Efficiency Rules

- Use targeted search instead of repository-wide inspection.
- Do not reopen files whose relevant content is already known.
- Do not load dependencies, generated builds, logs, archives, or binary databases unless required.
- Use `CODEMAP.md` to locate code and `DATA_MAP.md` to locate data structures.
- Read the baseline only when a baseline trigger applies.
- Read comments, open issues, and task history from the smallest available source: usually `HANDOFF.md`, `PLAN.md`, a referenced issue, or one relevant versioned handoff.
- Keep outputs focused on decisions, changes, verification, risks, and blockers.
- Prefer deletion, reuse, native features, standard libraries, and already-installed dependencies before adding code.
- Do not create a new abstraction, helper, dependency, document, or file unless it has a clear present use.

---

## SQLite Reading and Editing Rules

| Path | Role |
|---|---|
| `database/sqlite/` | Editable, version-controlled SQLite schema and migration SQL |
| `workflow-app/database/schema.sql` | Editable SQLite schema for the reusable local workflow app |
| `sqlite-out/` | Generated schema map; read-only navigation output |

### SQLite-First Supabase Migration Gate

Build and validate the SQLite database before migrating schema or data to Supabase.

For database work that will eventually target Supabase:

1. Design tables, constraints, indexes, triggers, and seed or fixture data in `database/sqlite/` first.
2. Regenerate and review `sqlite-out/` until table structures, keys, and relationships are stable.
3. Run local SQLite checks that prove foreign-key integrity, required constraints, representative inserts, updates, deletes, and workflow queries behave as expected.
4. Update `DATA_MAP.md`, `PLAN.md`, and `HANDOFF.md` with the accepted SQLite structure and validation result.
5. Start Supabase migration work only after the SQLite schema has passed local validation and the source-to-target mapping is documented.

Do not create or apply Supabase migrations from an unvalidated or still-changing SQLite design.

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
- Local workflow app: `workflow-app/`
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
- Workflow app SQLite SQL: `workflow-app/database/schema.sql`
- Generated SQLite maps: `sqlite-out/`
- Workflow runtime data: `workflow-app/data/`, `project-files/`
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
SQLite map sync:   npm run db:map
Workflow app:      npm run workflow:dev
Workflow schema:   npm run workflow:validate
Workflow smoke:    npm run workflow:smoke
Deploy:            GitHub Actions workflow `.github/workflows/deploy-pages.yml`
```

---

## Working Rules

Always:

- Inspect the existing implementation before editing.
- Apply the smallest change that satisfies the approved requirement.
- Preserve approved business rules and workflow behavior.
- Use `workflow-app/` as the local communication, approval, baseline, review, deployment, and maintenance interface when available.
- Reuse existing components, services, types, utilities, and patterns.
- Keep database changes in version-controlled SQL or migrations.
- Validate trust boundaries and protect against data loss.
- Validate each significant change before expanding scope.
- Stop and recover when a dumb-zone condition occurs.
- Add one small runnable check for non-trivial logic.
- Run applicable verification before declaring completion.
- Report failed checks, assumptions, blockers, and unresolved risks honestly.
- Update `agent-workflow/HANDOFF.md` after meaningful completed work.

Never:

- Expose secrets in code, documentation, logs, screenshots, or browser bundles.
- Edit generated files manually unless the project explicitly requires it.
- Bypass authentication, authorization, validation, audit, approval, or compliance controls.
- Guess table names, routes, schemas, environment variables, dependencies, or business rules.
- Continue repeated repair attempts without a recovery summary.
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
2. Confirm the acceptance criteria were satisfied.
3. Run applicable lint, type-check, tests, build, smoke, migration, and security checks.
4. Confirm SQLite tables, relationships, connections, and schema maps remain valid when database behavior is involved.
5. Review the diff or changed-file list for unrelated changes.
6. Confirm no unrelated functionality was knowingly broken.
7. Update affected maps, documentation, and `agent-workflow/HANDOFF.md`.
8. Create a versioned handoff only for meaningful completed work, releases, migrations, or deployment checkpoints.
9. Record verification results, known issues, limitations, risks, and next action.
10. Record commit and deployment status only when those actions occurred.

Never report success without supporting validation results. If a required check cannot run, report it as `NOT_RUN` with the reason.

Recommended commit format:

```text
v[VERSION]: [concise summary]
```
