# AGENTS.md

Main entry file for Codex, Cursor, and future AI agents.

---

## Reusable Template Purpose

This repository is the **GxP Toolkit** — a reusable starter, sample-component library, and reference project for future GxP-oriented applications.

The entire folder may be copied into a new project and adapted. After copying:

1. Keep the minimal root `AGENTS.md` at the new project root.
2. Update **`baseline-.md` only** with your project definition (name, goals, roles, pages, schema intent, deployment).
3. Update `agent-workflow/HANDOFF.md` and `agent-workflow/PLAN.md` for the first work session.
4. Preserve the Codex-first, Cursor-second, Graphify + SQLite map workflow unless the project owner explicitly changes it.

All work must preserve the reusable starter/template purpose unless the project owner explicitly approves conversion into a business-specific project.

---

## Required Reading Order

Future agents must read workflow files in this order before editing:

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

Cursor agents must also read .cursor/rules/project-workflow.mdc and .cursor/rules/graphify.mdc after the files above.

Map layers: `graphify-out/` → `sqlite-out/` → `database/sqlite/`.

For template-invariant workflow rules only, read `agent-workflow/agent-history/version-0-baseline.md`. **Project-specific goals belong in `baseline-.md`, not version-0-baseline.**

---

## File Responsibilities

| File | Purpose |
|------|---------|
| `baseline-.md` | **Project owner baseline** — what to build (update on copy) |
| `agent-workflow/AGENTS.md` | Main instruction file for AI agents |
| `agent-workflow/DOX.md` | Documentation standards and workflow rules |
| `agent-workflow/HANDOFF.md` | Current work status, verification, known issues, next steps |
| `agent-workflow/PLAN.md` | Active task planning |
| `agent-workflow/REFERENCE_LINKS.md` | External references only — study and adaptation, not bulk copy |
| `agent-workflow/agent-history/version-0-baseline.md` | Template-invariant workflow rules (read only on copy) |
| `database/sqlite/` | Editable schema and seed SQL |
| `sqlite-out/` | Generated schema map (`npm run db:map`) |
| `graphify-out/` | Generated codebase map (`npm run graphify:update`) |

Do not duplicate project goals in `HANDOFF.md` or `version-0-baseline.md`.

---

## Schema change rule (prevents mock/SQL drift)

When changing `src/types/`, `src/data/`, or `src/services/`:

1. Update `database/sqlite/schema.sql` and `seed.sql`.
2. Run `npm run db:map`.
3. Run `npm run verify:schema`.

---

## Project Workflow Extension

```txt
DOX → HANDOFF → PLAN → baseline-.md → Graphify + sqlite-out maps
Codex → Cursor → Verification
```

### Graphify and SQLite maps

- **Graphify** (`graphify-out/`): primary codebase map for agents — verify against source.
- **SQLite map** (`sqlite-out/`): primary schema map for agents — regenerate with `npm run db:map`.
- Do not edit generated map folders by hand.

---

## AI Workflow

### Stage 1 — Codex

1. Read project context in the required order.
2. Create or update `agent-workflow/PLAN.md`.
3. Identify affected files (use Graphify when available).
4. Implement changes; sync SQL when data models change.
5. Run verification.
6. Update `agent-workflow/HANDOFF.md`.

### Stage 2 — Cursor

1. Review Codex work.
2. Apply Graphify and sqlite map review.
3. Trace dependencies and schema alignment.
4. Fix integration gaps.
5. Run final verification.
6. Update `agent-workflow/HANDOFF.md`.

---

## Verification

When available:

```powershell
npm install
npm run build
npm run lint
npm run test
npm run verify:schema
npm run db:map
npm run graphify:check
npm run verify:supabase
```

Report missing scripts as `Command unavailable.`

---

## Conflict Resolution

Priority order:

```txt
baseline-.md (project-specific)
↓
agent-workflow/AGENTS.md
↓
agent-workflow/DOX.md
↓
agent-workflow/HANDOFF.md
↓
agent-workflow/PLAN.md
```

`agent-workflow/agent-history/version-0-baseline.md` defines template-invariant workflow rules only.

---

## Recommended Repository Structure

```txt
/
├── AGENTS.md
├── baseline-.md
├── README.md
├── agent-workflow/
├── database/sqlite/
├── .cursor/rules/
├── graphify-out/   (generated)
├── sqlite-out/     (generated)
├── src/
└── package.json
```
