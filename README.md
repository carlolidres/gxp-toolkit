# AI-Efficient Markdown Workflow

## Purpose

This workflow gives AI coding agents a small, predictable set of Markdown files to read before making changes in a software project. It is designed for future projects where the project owner wants consistent handoffs, lower token usage, controlled SQLite schema work, manual browser verification, Git traceability, and clear rollback references.

The core idea is simple: agents should not scan the whole repository by default. They should read the routing file, current context, current handoff, one task-specific map or plan, and only the directly affected source files.

## How It Reduces AI Token Consumption

The workflow saves tokens by replacing broad repository exploration with targeted navigation:

- `AGENTS.md` tells the agent exactly which documents to load for each task type.
- `CONTEXT.md` keeps stable project identity and constraints in one short file.
- `HANDOFF.md` gives the current operational state without forcing the agent to read historical records.
- `CODEMAP.md` points to source areas so the agent can avoid scanning `src/`.
- `DATA_MAP.md` and `sqlite-out/` point to database structures before the agent opens SQL.
- `PONYTAIL.md` forces the smallest sufficient implementation.
- Versioned handoffs preserve history so current work does not need long narrative context.

## Recommended Folder Structure

Use this structure at the root of the target project:

```text
AGENTS.md
agent-workflow/
  BROWSER_TESTING.md
  CODEMAP.md
  CONTEXT.md
  DATA_MAP.md
  HANDOFF.md
  PLAN.md
  PONYTAIL.md
agent-history/
  version-0-baseline.md
  version-X-handoff.md
database/
  sqlite/
    schema.sql
    seed.sql
plans/
  task-name/
    plan.md
project-templates/
  version-0-baseline-builder.md
sqlite-out/
  SCHEMA_REPORT.md
  schema.json
  schema-map.html
src/
```

Some projects may not use SQLite. If so, keep `DATA_MAP.md`, but mark SQLite sections as not applicable. If the project does use SQLite, the paths below are mandatory:

| Path | Purpose |
| --- | --- |
| `database/sqlite/` | Editable and authoritative SQLite schema and migration SQL |
| `sqlite-out/` | Generated, read-only schema maps used for targeted AI navigation |

## Files to Copy

Copy these workflow files into a future project:

- `AGENTS.md`
- `agent-workflow/CONTEXT.md`
- `agent-workflow/HANDOFF.md`
- `agent-workflow/PLAN.md`
- `agent-workflow/PONYTAIL.md`
- `agent-workflow/CODEMAP.md`
- `agent-workflow/DATA_MAP.md`
- `agent-workflow/BROWSER_TESTING.md`
- `agent-history/version-0-baseline.md`
- `agent-history/version-X-handoff.md`
- `project-templates/version-0-baseline-builder.md`

For SQLite projects, also create or copy:

- `database/sqlite/`
- `sqlite-out/`

Do not copy generated schema output from another project as authoritative truth. Regenerate `sqlite-out/` from the target project's own SQL.

## Correct Copying and Setup Order

1. Copy the workflow folders and files into the project root.
2. Fill in `agent-workflow/CONTEXT.md` with stable project identity, stack, priorities, constraints, and source-of-truth paths.
3. Fill in `AGENTS.md` standard commands for install, develop, lint, type-check, test, build, verify, SQLite map sync, and deploy.
4. Build or revise `agent-history/version-0-baseline.md` using `project-templates/version-0-baseline-builder.md`.
5. Populate `agent-workflow/CODEMAP.md` with high-value source paths only.
6. Populate `agent-workflow/DATA_MAP.md` with database entities, relationships, integrity rules, and migration rules.
7. For SQLite projects, place authoritative SQL in `database/sqlite/` and run the project-approved schema-map command to generate `sqlite-out/`.
8. Initialize `agent-workflow/HANDOFF.md` with current status, known issues, next action, verification state, and Git/deployment status.
9. Use `agent-workflow/PLAN.md` only for accepted implementation work.
10. Commit the initialized workflow when the project owner approves it.

## Required AI-Agent Reading Order

Before modifying code, agents must read:

1. `AGENTS.md`
2. `agent-workflow/CONTEXT.md`
3. `agent-workflow/HANDOFF.md`
4. One task-specific file:
   - UI, routing, components, source code: `agent-workflow/CODEMAP.md`
   - Database, SQLite, migration, API data flow: `agent-workflow/DATA_MAP.md`
   - Accepted implementation work: `agent-workflow/PLAN.md`
   - Browser evidence or runtime verification: `agent-workflow/BROWSER_TESTING.md`
   - Approved requirements, roles, audit, retention, security, GxP: `agent-history/version-0-baseline.md`
5. `agent-workflow/PONYTAIL.md` once per coding session.
6. Only the directly affected source files.

For GxP-impacting work, also read the approved task plan under `plans/.../plan.md` before implementing.

## Purpose of Each Workflow File

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Main instruction router, reading order, project paths, SQLite rules, working rules, and completion requirements. |
| `CONTEXT.md` | Stable project identity, stack, priorities, constraints, and sources of truth. |
| `HANDOFF.md` | Current operational state, recent work, active work, known issues, minimal read set, verification, SQLite sync, and next action. |
| `PLAN.md` | Active approved implementation objective, acceptance criteria, scope, Ponytail gate, expected files, verification plan, and completion notes. |
| `PONYTAIL.md` | Simplicity rule that forces reuse, native features, standard libraries, installed dependencies, or minimum new code. |
| `CODEMAP.md` | Source-code navigation map for entry points, modules, components, services, utilities, configuration, tests, and boundaries. |
| `DATA_MAP.md` | Human-readable database and data-flow map for SQLite, entities, relationships, migration rules, integrity, authorization, and audit. |
| `BROWSER_TESTING.md` | Manual Chrome DevTools workflow, minimum evidence template, panel selection, retest template, and browser-related handoff rules. |
| `version-0-baseline.md` | Permanent approved project baseline for objective, scope, requirements, architecture, security, data model, workflow, and verification. |
| `version-X-handoff.md` | Template for historical version handoffs after meaningful work, releases, migrations, or deployment checkpoints. |
| `version-0-baseline-builder.md` | Project-owner questionnaire and prompt for creating or revising the approved baseline. |

## Where the Project Owner Adds Comments

Use `agent-workflow/HANDOFF.md` for comments that the next agent should see. Put unresolved bugs, regressions, limitations, or requested follow-up in `Known Issues` with severity, impact, and next action.

Use `agent-workflow/PLAN.md` only after a comment becomes accepted implementation work. This keeps HANDOFF as the current status board and PLAN as the active task contract.

## From HANDOFF Comments to PLAN Tasks

1. Project owner or reviewer records the issue in `HANDOFF.md` under `Known Issues` or `Next Action`.
2. Project owner accepts the work and clarifies the expected outcome.
3. Agent creates or updates `PLAN.md` with objective, scope, acceptance criteria, expected files, SQLite impact, security impact, and verification plan.
4. For direct GxP-impacting work, the approved plan must also exist under `plans/.../plan.md`.
5. Agent implements only the approved scope.
6. Agent records completion and verification back in `HANDOFF.md`.

## Ponytail Minimal Implementation Rule

`PONYTAIL.md` tells agents to stop at the first solution rung that works:

1. Do not build what is not needed now.
2. Reuse existing project code.
3. Use the standard library.
4. Use native platform features.
5. Use already-installed dependencies.
6. Make one clear line or the smallest safe change.
7. Write only the minimum new code required.

This rule does not allow agents to remove safeguards. Validation, error handling, authentication, authorization, security, privacy, accessibility, auditability, data integrity, approved requirements, and GxP controls remain mandatory.

## Using CODEMAP.md

`CODEMAP.md` is a navigation index, not a duplicate of the source tree. Use it to identify likely files before opening source.

Example flow for source work:

1. Read `AGENTS.md`, `CONTEXT.md`, `HANDOFF.md`, `CODEMAP.md`, and `PONYTAIL.md`.
2. Find the relevant module, component, service, or test path in `CODEMAP.md`.
3. Open only those files.
4. Use targeted search for a specific symbol, route, component name, or error.
5. Update `CODEMAP.md` only when important paths are added, moved, renamed, or become regular agent entry points.

Do not use `CODEMAP.md` as permission to scan the entire repository.

## Using DATA_MAP.md

`DATA_MAP.md` is the human map for data work. Use it for database, SQLite, migration, API data flow, reporting, authorization, audit, and integrity questions.

Database reading order:

1. Read `DATA_MAP.md`.
2. Read only the relevant generated map file or section in `sqlite-out/`.
3. Open only the matching SQL files in `database/sqlite/`.
4. Inspect application data-access code only when behavior requires it.
5. Read the baseline only when architecture, workflow, security, audit, retention, roles, or GxP requirements are affected.

## SQLite Rules

For SQLite work:

- `database/sqlite/` is editable and authoritative.
- `sqlite-out/` is generated and read-only.
- Runtime `.db` files are not schema sources of truth.
- Agents must never manually edit generated files under `sqlite-out/`.
- After changing SQL, run the project-approved schema-map command.
- Review generated output for unexpected drops, type changes, relationship changes, missing indexes, or trigger changes.
- Record the sync result in `HANDOFF.md`.
- Update `DATA_MAP.md` when entities, relationships, workflow rules, migration rules, or integrity controls meaningfully change.

The example source workflow includes `database/sqlite/schema.sql`, `database/sqlite/seed.sql`, and generated outputs such as `sqlite-out/SCHEMA_REPORT.md`, `sqlite-out/schema.json`, and `sqlite-out/schema-map.html`.

## Manual Chrome DevTools Workflow

Manual Chrome DevTools inspection is the default browser-verification method. The user provides minimal evidence; the agent reads the relevant workflow files, applies the smallest fix, runs checks, and returns concise retest steps.

Use the relevant DevTools panel:

| Issue | Panel |
| --- | --- |
| Layout, spacing, overflow, responsive behavior | Elements / Device Toolbar |
| Runtime error or inactive control | Console |
| Login, save, load, API, or database failure | Network |
| Session, token, cache, refresh state | Application |
| Handler or execution path | Sources |
| Slow interaction | Performance |

Minimum bug evidence should include route, feature, reproduction steps, expected result, actual result, one relevant console error if any, one failed request if any, selector or source path if known, and screenshot only when visual evidence matters.

Do not paste full console logs, full network exports, complete HTML, authentication headers, cookies, tokens, secrets, database dumps, or duplicate screenshots.

## Version Control, Handoffs, Rollback, and Commits

This workflow supports Git version control by requiring agents to record branch, commit hash, deployment status, and rollback references when those actions occur.

Important rules:

- Do not commit, push, merge, deploy, or migrate unless explicitly requested or required by the approved workflow.
- Record commit status only when a commit occurred.
- Record deployment status only when deployment occurred.
- Preserve `agent-history/version-0-baseline.md` as the approved baseline unless the project owner explicitly approves a revision.
- Keep `agent-workflow/HANDOFF.md` concise and current.
- Use versioned handoffs for durable checkpoints.

Recommended commit format:

```text
v[VERSION]: [concise summary]
```

Rollback references belong in the current handoff and the relevant versioned handoff. A rollback reference may be a commit hash, tag, release, migration rollback method, deployment workflow run, backup reference, or documented restore process.

## When to Create a Versioned Handoff

Create a versioned handoff in `agent-history/` for:

- Meaningful completed implementation work.
- Releases.
- Migrations.
- Deployment checkpoints.
- Rollback events.
- Major verification milestones.

Do not create a versioned handoff for tiny notes, routine status updates, or unfinished work unless the project owner requests it.

## Initialize the Workflow for a Brand-New Project

1. Create the recommended folder structure.
2. Fill in `CONTEXT.md` with project identity, stack, owner, environment, priorities, constraints, and sources of truth.
3. Use `project-templates/version-0-baseline-builder.md` to gather project-owner answers.
4. Populate `agent-history/version-0-baseline.md` and mark it approved only after project-owner review.
5. Fill `AGENTS.md` with the real project commands and paths.
6. Create initial `CODEMAP.md` from the planned or scaffolded application structure.
7. Create initial `DATA_MAP.md`; for SQLite, add authoritative SQL under `database/sqlite/`.
8. Generate `sqlite-out/` from the project SQL if SQLite is used.
9. Initialize `HANDOFF.md` with the current status and next action.
10. Commit the initialized workflow when approved.

## Integrate the Workflow into an Existing Project

1. Copy the workflow files into the existing project root.
2. Replace placeholders with real project commands, paths, stack, and constraints.
3. Build `CODEMAP.md` from only high-value source paths, not every file.
4. Build `DATA_MAP.md` from the current database and data-access model.
5. Move or identify authoritative SQLite SQL under `database/sqlite/` if SQLite is used.
6. Generate `sqlite-out/` from the existing SQL.
7. Create or approve `version-0-baseline.md` from the existing product requirements.
8. Summarize current work, known issues, verification, Git state, deployment state, and next action in `HANDOFF.md`.
9. Avoid rewriting historical project documentation unless the project owner approves the migration.

## Start a New Task

1. Read the required startup files.
2. Read the one task-specific map or plan.
3. Read `PONYTAIL.md` once for the coding session.
4. Inspect only affected source, SQL, or test files.
5. Confirm whether the task affects baseline triggers such as scope, roles, authorization, audit, retention, security, migration, or GxP.
6. If accepted implementation work is needed, update `PLAN.md`.
7. Implement the smallest safe change.
8. Run applicable verification.

## Complete and Hand Over a Task

Before declaring completion:

1. Confirm the requested behavior was implemented.
2. Run applicable lint, type-check, tests, build, smoke checks, migration checks, schema sync, and security checks.
3. Review the diff for unrelated changes.
4. For SQLite changes, regenerate `sqlite-out/` and confirm schema sync.
5. Update `DATA_MAP.md` or `CODEMAP.md` only when meaningful navigation or business meaning changed.
6. Update `HANDOFF.md` with completed work, verification, known issues, SQLite sync, next action, commit status, deployment status, and rollback reference.
7. Create a versioned handoff when required.
8. Report failed checks, assumptions, blockers, and unresolved risks honestly.

## Practical Examples

### 1. Starting a UI Task

User request:

```text
Fix the dashboard card overflow on mobile.
```

Agent reading order:

```text
AGENTS.md
agent-workflow/CONTEXT.md
agent-workflow/HANDOFF.md
agent-workflow/CODEMAP.md
agent-workflow/PONYTAIL.md
affected dashboard component and style files only
```

Expected behavior:

- Use `CODEMAP.md` to find the dashboard module.
- Inspect the affected component and styles.
- Apply the smallest responsive layout fix.
- Run lint/type-check/build or the project-approved equivalent.
- Ask the user to verify in Chrome DevTools Device Toolbar if manual visual confirmation is needed.
- Record meaningful completion in `HANDOFF.md`.

### 2. Starting a Database Task

User request:

```text
Add an index for routing document status filtering.
```

Agent reading order:

```text
AGENTS.md
agent-workflow/CONTEXT.md
agent-workflow/HANDOFF.md
agent-workflow/DATA_MAP.md
agent-workflow/PONYTAIL.md
relevant sqlite-out section
database/sqlite/schema.sql or migration file
relevant data-access code only if query behavior changes
```

Expected behavior:

- Edit authoritative SQL in `database/sqlite/`.
- Regenerate `sqlite-out/` with the project-approved schema-map command.
- Review generated schema changes.
- Run applicable migration and data-access checks.
- Record SQLite sync in `HANDOFF.md`.

### 3. Reporting a Bug Through HANDOFF.md

Add the issue under `Known Issues`:

```markdown
| Severity | Issue | Impact | Next action |
| --- | --- | --- | --- |
| High | Dashboard filters reset after page refresh. | Users lose selected work queue context. | Confirm desired persistence behavior, then create an accepted PLAN.md task. |
```

This tells the next agent what is known without approving implementation scope yet.

### 4. Converting an Accepted Comment into PLAN.md

Accepted comment:

```text
Persist dashboard filters across refresh for the current user.
```

PLAN update:

```markdown
## Objective

Persist dashboard filter selections across browser refresh for the current user without changing shared filter defaults.

## Scope

Included:

- Save selected dashboard filters locally for the current user/session.
- Restore filters when the dashboard loads.
- Add one small check for the restore behavior.

Excluded:

- Server-side preferences.
- Cross-device synchronization.

## Acceptance Criteria

- [ ] Selected filters remain after refresh.
- [ ] Clearing filters updates the saved state.
- [ ] Default filters still apply for first-time users.
```

The plan turns a handoff comment into bounded, verifiable implementation work.

### 5. Completing a Task with Verification, Commit, and Rollback Reference

HANDOFF completion entry:

```markdown
## Recently Completed

- Persisted dashboard filters across refresh using existing local state utilities.

## Verification

| Check | Status | Result |
| --- | --- | --- |
| Lint | PASSED | `npm run lint` |
| Type-check | PASSED | `npm run type-check` |
| Tests/self-check | PASSED | Added filter restore self-check |
| Build | PASSED | `npm run build` |
| Smoke/manual | PASSED | Chrome DevTools refresh test on `/dashboard` |
| Deployment | NOT_RUN | Not requested |

## Next Action

`Project owner to confirm behavior in test environment.`

Historical evidence: `agent-history/version-2-handoff.md`
```

Versioned handoff Git traceability:

```markdown
## Git Traceability

- Branch: `feature/dashboard-filter-persistence`
- Commit message: `v2: persist dashboard filters`
- Commit hash: `abc1234`
- Pull request: `N/A`

## Deployment

- Environment: `N/A`
- Status: `NOT_DEPLOYED`
- Deployment reference: `N/A`
- Production URL: `N/A`
- Rollback reference: `git revert abc1234`
```

## Common Mistakes to Avoid

- Asking an agent to scan the whole repository.
- Letting `HANDOFF.md` become a long historical narrative.
- Putting accepted task scope in `HANDOFF.md` instead of `PLAN.md`.
- Reading the baseline for routine UI copy or styling fixes.
- Editing generated files in `sqlite-out/`.
- Treating runtime `.db` files as schema truth.
- Forgetting to regenerate `sqlite-out/` after SQL changes.
- Copying all SQL files and all generated maps into context for a one-table issue.
- Adding abstractions, dependencies, or files before checking reuse options.
- Omitting verification results or claiming checks passed when they were not run.
- Recording commit, deployment, or rollback information when those actions did not happen.
- Storing secrets, tokens, cookies, private keys, or production credentials in Markdown.
- Rewriting the approved baseline without project-owner approval.

## Reusable Prompt to Initialize This Workflow

```text
Initialize the AI-efficient Markdown workflow in this project.

Use the existing workflow files as templates:
- AGENTS.md
- agent-workflow/CONTEXT.md
- agent-workflow/HANDOFF.md
- agent-workflow/PLAN.md
- agent-workflow/PONYTAIL.md
- agent-workflow/CODEMAP.md
- agent-workflow/DATA_MAP.md
- agent-workflow/BROWSER_TESTING.md
- agent-history/version-0-baseline.md
- agent-history/version-X-handoff.md
- project-templates/version-0-baseline-builder.md

Rules:
1. Treat the project owner's approved requirements as the source of truth.
2. Replace placeholders with this project's real commands, paths, stack, constraints, and verification workflow.
3. Build CODEMAP.md as a concise navigation map, not a full file listing.
4. Build DATA_MAP.md as a concise database and data-flow map.
5. If the project uses SQLite, keep authoritative SQL in database/sqlite/ and generated read-only maps in sqlite-out/.
6. Do not edit generated sqlite-out files manually.
7. Initialize HANDOFF.md with current status, known issues, verification state, Git/deployment status, and next action.
8. Preserve Git traceability and rollback-reference sections.
9. Do not create .mdc, .mdx, editor-specific, or Cursor-specific requirements.
10. Keep the result standard Markdown and concise enough for AI agents to use efficiently.
```
