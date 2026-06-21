# Manual Chrome DevTools Workflow

Last Updated: `[YYYY-MM-DD]`

## Purpose

Use manual Chrome DevTools inspection as the default browser-verification method. The user supplies minimal runtime evidence; the AI agent reads only the relevant workflow and source files, applies the smallest fix, and returns concise verification steps.

Use browser automation only when manual reproduction is impractical, repeated regression coverage is required, automation is approved scope, or the project owner explicitly requests it.

## Workflow

```text
AGENTS.md
  → CONTEXT.md
  → HANDOFF.md
  → BROWSER_TESTING.md
  → one relevant map or plan
  → affected source files only
  → smallest fix
  → automated checks
  → manual DevTools verification
  → HANDOFF.md update
```

For database-related browser failures, read `DATA_MAP.md`, then only the relevant generated map in `sqlite-out/`, and finally only the required editable SQL in `database/sqlite/`.

## Select the Relevant Panel

| Issue | Panel | Inspect |
|---|---|---|
| Layout, spacing, overflow, responsive behavior | Elements / Device Toolbar | DOM, computed CSS, breakpoints |
| Runtime error or inactive control | Console | First relevant error and stack |
| Login, save, load, API, or database failure | Network | Failed request, status, concise response |
| Session, token, cache, refresh state | Application | Relevant storage item only |
| Handler or execution path | Sources | Breakpoint, call stack, variable |
| Slow interaction | Performance | Long task or bottleneck only |

Do not inspect every panel unless evidence shows that multiple layers are involved.

## Minimum Evidence Template

```text
Page or route:
[ROUTE]

Feature:
[FEATURE]

Steps:
1. [STEP_1]
2. [STEP_2]
3. [STEP_3]

Expected:
[EXPECTED]

Actual:
[ACTUAL]

Console error:
[ONE_RELEVANT_ERROR_OR_NONE]

Failed request:
[METHOD URL, STATUS, RELEVANT_RESPONSE_OR_NONE]

Selector or source path:
[VALUE_OR_UNKNOWN]

Screenshot:
[ATTACHED_ONLY_IF_VISUAL]
```

Never provide complete console history, all network requests, full HTML, full HAR files, complete source files, authentication headers, tokens, cookies, passwords, private keys, production secrets, database dumps, or duplicate screenshots.

## Agent Instructions

When browser evidence is provided:

1. Read `AGENTS.md`, `CONTEXT.md`, `HANDOFF.md`, and this file.
2. Read only one or more task-specific files that are truly necessary: `CODEMAP.md`, `DATA_MAP.md`, `PLAN.md`, an approved `plans/.../plan.md`, or a relevant baseline section.
3. Identify the root cause before editing.
4. Apply the first valid Ponytail rung: reuse, standard library, native feature, installed dependency, or minimum new code.
5. Do not change unrelated behavior.
6. Add one small runnable check for non-trivial logic.
7. Run applicable lint, type-check, tests, build, and schema sync.
8. Return concise manual retest steps, changed files, verification results, assumptions, risks, and blockers.
9. Update `HANDOFF.md` after meaningful work.

## Manual Verification Template

```text
Date: [YYYY-MM-DD]
Route: [ROUTE]
Tested by: [USER]
Original issue: [ISSUE]

Verification steps:
1. [STEP_1]
2. [STEP_2]
3. [STEP_3]

Result: [PASSED | FAILED | PARTIALLY_PASSED]
Console: [NO_NEW_ERRORS | DETAILS]
Network: [NO_FAILED_REQUESTS | DETAILS | N/A]
Responsive: [PASSED | FAILED | N/A]
Session/storage: [PASSED | FAILED | N/A]
Comments: [COMMENTS]
```

## Where to Record Findings

| Finding | Update |
|---|---|
| New bug, regression, failed check, unresolved limitation | `agent-workflow/HANDOFF.md` → Known Issues |
| Accepted implementation work | `agent-workflow/PLAN.md` |
| Completed fix or successful manual check | `agent-workflow/HANDOFF.md` |
| Meaningful completed feature, release, migration, or deployment | Relevant versioned handoff |
| New or changed source path | `agent-workflow/CODEMAP.md` |
| Database, API, migration, session, or data-flow rule | `agent-workflow/DATA_MAP.md` |
| SQLite schema change | `database/sqlite/`, regenerate `sqlite-out/`, then update `DATA_MAP.md` and `HANDOFF.md` as needed |
| Stable project fact | `agent-workflow/CONTEXT.md` |
| Permanent approved requirement or GxP control | `agent-history/version-0-baseline.md` after approval |
| General agent instruction | `AGENTS.md` |
| Browser procedure | This file |

## Token-Saving Rules

- Submit one clear issue per prompt when practical.
- Include only the first relevant error or failed request.
- Provide the affected route, selector, and source path when known.
- Use screenshots only for visual evidence.
- Do not ask an agent to browse the whole repository.
- Do not load the baseline for routine UI fixes.
- Do not load all SQLite SQL and generated maps for one table or query issue.
- Keep `HANDOFF.md` current and concise.

## Security Rules

- Use development or test accounts.
- Redact personal, regulated, and confidential information.
- Never share access tokens, refresh tokens, session cookies, passwords, private keys, service credentials, or authorization headers.
- Do not store secrets in Markdown files.
