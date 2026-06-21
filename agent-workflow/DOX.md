# DOX.md

Documentation standards and workflow rules for Codex, Cursor, and future AI agents.

Project-specific baseline, architecture decisions, and definition of done live in **`baseline-.md`**. Template-invariant workflow rules live in `agent-workflow/agent-history/version-0-baseline.md`. Current implementation status lives in `agent-workflow/HANDOFF.md`. Active tasks live in `agent-workflow/PLAN.md`.

---

## Documentation Ownership

| File | Responsibility |
|------|----------------|
| `baseline-.md` | **Project owner baseline** — goals, roles, schema intent, deployment (update on copy) |
| `agent-workflow/AGENTS.md` | Main agent instructions and workflow entry |
| `agent-workflow/DOX.md` | Documentation standards and workflow rules (this file) |
| `agent-workflow/HANDOFF.md` | Current state, verification, known issues, next steps |
| `agent-workflow/PLAN.md` | Temporary active task only |
| `agent-workflow/REFERENCE_LINKS.md` | External reference index only |
| `agent-workflow/agent-history/version-0-baseline.md` | Template-invariant workflow rules (read only on copy) |
| `agent-workflow/agent-history/` | Versioned handoffs and milestone records |
| `database/sqlite/` | Editable schema SQL; `sqlite-out/` is generated map |
| `README.md` | Human onboarding and template reuse instructions |
| `.cursor/rules/` | Cursor workflow and Graphify review rules |

Do not place permanent business rules in `agent-workflow/PLAN.md`.

---

## Required Reading Order

Before editing, read:

```text
agent-workflow/AGENTS.md
↓
agent-workflow/DOX.md
↓
agent-workflow/HANDOFF.md
↓
agent-workflow/PLAN.md
↓
baseline-.md
```

Consult `baseline-.md` for project-specific goals. Consult `agent-workflow/agent-history/version-0-baseline.md` for template-invariant workflow rules only.

---

## How Agents Should Document Work

Every significant coding session must update documentation:

1. Record work completed in `agent-workflow/HANDOFF.md` or a new file in `agent-workflow/agent-history/`.
2. Update `agent-workflow/PLAN.md` while active work is in progress.
3. Record verification commands run and their results.
4. Record known issues and next recommended steps.
5. Record Git commit hash when a commit is created.
6. Return reusable verified facts to `baseline-.md` (project facts) or `agent-workflow/agent-history/version-0-baseline.md` (template rules) only with project owner approval.

No work is complete without documentation.

---

## Handoff Expectations

`agent-workflow/HANDOFF.md` must document:

* Current version or status
* Completed work
* Files changed
* Verification performed
* Known issues
* Pending work and next steps
* Notes for the next agent
* Git commit hash when available

Do not duplicate the full baseline in `HANDOFF.md`.

---

## Verification Expectations

Run available commands before handoff:

```powershell
npm run build
npm run lint
npm run test
npm run verify:schema
npm run db:map
npm run graphify:check
npm run verify:supabase
```

Report missing scripts as `Command unavailable.` Do not invent successful verification.

Record all results in `agent-workflow/HANDOFF.md`.

---

## Workflow Stages

```text
Codex: plan → implement → initial verification → (commit when in Git worktree) → agent-workflow/HANDOFF.md
Cursor: Graphify or manual mapping → integration review → final verification → (commit when in Git worktree) → agent-workflow/HANDOFF.md
Milestone (optional): archive to agent-workflow/agent-history/version-N-handoff.md
```

### Codex

* Read required workflow files.
* Create or update `agent-workflow/PLAN.md`.
* Implement changes; sync SQL when data models change.
* Run available verification.
* Commit only when the project owner requests or repo policy requires it; record commit hash in HANDOFF.
* Update `agent-workflow/HANDOFF.md` with deliverables for Cursor.

### Cursor

* Read required workflow files and `.cursor/rules/`.
* Apply Graphify and sqlite map review.
* Review integration, UI, and regressions.
* Run final verification.
* Commit only when the project owner requests or repo policy requires it; record commit hash in HANDOFF.
* Update `agent-workflow/HANDOFF.md`.

---

## Version control (when using Git)

* Record the Git commit hash in `agent-workflow/HANDOFF.md` when a commit is created.
* Do not force-push, amend, or rewrite history unless the project owner explicitly requests it.
* Do not commit secrets or generated folders (`dist/`, `graphify-out/`, `sqlite-out/`).
* **Environment files:** commit `.env.example` only. Never commit `.env`, `.env.local`, or `.env.*.local` (listed in `.gitignore`). Local dev copies `.env.example` → `.env.local`.
* **CI/CD secrets:** store `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in GitHub Actions repository secrets, not in the repo. Only `VITE_*` vars are embedded in the static client bundle — never the Supabase service role key.
* When adding or changing Supabase integration, record env-related changes in `agent-workflow/HANDOFF.md`.
* Branch and PR strategy is project-specific — document it in `baseline-.md` when the owner defines it.

---

## Rollback and recovery

There is no automatic agent rollback. Use these recovery patterns:

| Situation | Recovery |
|-----------|----------|
| Bad code change | Owner uses Git (`git revert`, restore from last good commit) |
| Bad agent session | Read prior `HANDOFF.md` or `agent-history/version-N-handoff.md` |
| Schema / mock drift | Fix SQL files, then `npm run db:map` and `npm run verify:schema` |
| Local SQLite DB wrong | `npm run db:reset` (sqlite3 CLI) — dev reference only |
| Baseline doc mistake | Edit `baseline-.md` only |
| Bad env / secrets change | Revert env file edits via Git; restore local `.env.local` from `.env.example` template |
| Bad GitHub Pages deploy | Re-run a prior successful workflow from Actions history, or `git revert` the deploy commit and push |
| Bad Supabase migration (future) | Roll back via Supabase CLI / dashboard migration tools; document downgrade scripts when added |

**Not agent rollback:** SQL table `workflow_steps` is GxP document approval routing in the sample app, not Codex/Curator session steps. `schema_migrations` is forward-only until owner adds downgrade scripts.

---

## Graphify Documentation Rules

Graphify is a navigation and dependency-review aid, not a source of truth.

Install and verify when needed:

```powershell
py -m pip install --upgrade --user graphifyy
py -m pip show graphifyy
```

Never claim Graphify ran unless its command completed successfully. If unavailable, use direct search and manual dependency mapping.

Do not treat `graphify-out/` or other Graphify artifacts as source files.

---

## External References

`agent-workflow/REFERENCE_LINKS.md` lists external repositories for study and adaptation only.

Do not download, merge, or bulk-copy external repositories unless the project owner explicitly approves.

---

## Generated Output

Do not treat the following as source-of-truth files:

* `dist/`
* `node_modules/`
* `graphify-out/`
* Other build or cache output

---

## Template Adaptation Documentation

When copying this template into a new project, update:

* **`baseline-.md` only** with the new project definition
* `README.md` for human onboarding
* `agent-workflow/HANDOFF.md` with current status
* `agent-workflow/PLAN.md` with the first active tasks

Do not put project-specific goals in `agent-workflow/agent-history/version-0-baseline.md`.

Preserve the AI-agent workflow structure unless the project owner explicitly changes it.

---

## Coding and Documentation Standards

* TypeScript strict mode where practical.
* Component reuse and modular architecture.
* Consistent naming conventions.
* No hardcoded secrets.
* Custom CSS + Recharts UI (Ant Design references in REFERENCE_LINKS are external study only).
* Clear separation of components, layouts, pages, routes, services, hooks, and utilities.
* Avoid unnecessary business-specific logic in the reusable baseline.
* Adapt external reference code to match this project structure.

---

## Change Control

Baseline modifications, authentication architecture changes, database integration changes, role changes, workflow changes, deployment changes, major dependency upgrades, and conversion from reusable template to business-specific project require project owner approval.

See `agent-workflow/agent-history/version-0-baseline.md` for the full change control list.
