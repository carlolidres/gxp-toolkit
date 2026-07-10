# Ant Design 6 Migration Baseline

Recorded before UI migration work begins.

| Field | Value |
|-------|-------|
| Date | 2026-07-10 |
| Source branch | `main` |
| Stable commit | `ad02788641bd656dce266300a7b052ab599fc54e` |
| Stable short SHA | `ad02788` |
| Stable message | `v33: record GitHub Pages deploy status in HANDOFF` |
| Backup branch | `backup/pre-antd6-migration-20260710` |
| Working branch | `ui/antd6-migration` |

## Rollback

- Restore original UI from `backup/pre-antd6-migration-20260710` or commit `ad02788`.
- Prefer `git revert <commit>` for individual migration commits when a page/group regresses.
- Do not continue past a failing page until that commit is fixed or reverted.

## Validation (post-migration)

- `npm run type-check` — pass
- `npm run test` — 121 tests pass
- `npm run build` — pass
- `npm run lint` — 0 errors (pre-existing warnings remain)
- `npm run e2e` — pass (`edoc-nav` mock-mode smoke)

## Notes

- Unrelated untracked files (`.cursor`, `reference`, etc.) were intentionally left unstaged.
- Existing dirty file at baseline: `supabase/README.md` (not part of this migration).
