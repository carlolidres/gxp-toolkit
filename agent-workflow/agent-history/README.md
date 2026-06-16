# Agent History

Archive completed milestone handoffs here when preserving an audit trail is useful.

Use clear names such as:

```txt
version-0-baseline.md
version-1-handoff.md
2026-06-14-template-setup.md
```

## Responsibilities

| File | Purpose |
|------|---------|
| `baseline-.md` (repo root) | **Project owner baseline** — what to build (update on copy) |
| `version-0-baseline.md` | Template-invariant workflow rules (read only on copy) |
| `version-X-handoff.md` | Versioned session or milestone handoff records (archive, not rollback) |

Do not use this folder as the current working status file. Current status belongs in `agent-workflow/HANDOFF.md`, active work in `agent-workflow/PLAN.md`, and project definition in `baseline-.md`.

## Milestone handoff template

When archiving a milestone, create `version-N-handoff.md` with:

* Date and milestone name
* Work completed and files changed
* Verification results
* Git commit hash (if any)
* Known issues and next steps

This is an audit trail. Recovery from a bad session uses Git or a prior HANDOFF — see `agent-workflow/DOX.md` § Rollback and recovery.
