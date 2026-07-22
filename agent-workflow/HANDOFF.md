# Current Handoff

Last Updated: `2026-07-22`
Version: `v37`
Branch: `main` → deploy via `master`
Commit: (pending)
Deployment: `PENDING`

## Current Status

**v37** — Desktop collapsed sidebar: 28×28 Expand FAB + group icon rail; hover/focus opens glass-bubble text submenus. Collapse persists via `sessionStorage`. Mobile ≤960px keeps hamburger drawer; hover chrome unmounts when expanded.

## Key implementation notes

- `useSidebarCollapsed` + `useDesktopNav` (`min-width: 961px`) gate layout collapse.
- `SidebarHoverChrome` mounts only while collapsed (or during FAB expand-exit ~180ms).
- Group icons keep hierarchy; glass labels dismiss with the rail when pointer leaves.
- Scrollbars hidden on hover chrome; wheel/keyboard scroll retained on long submenus.

## Verification

| Check | Status | Result |
|---|---|---|
| `npm run type-check` | `PASSED` | 2026-07-22 |
| `npx vitest run src/hooks/useSidebarCollapsed.test.ts` | `PASSED` | 2 tests |
| `npm run lint` | `PASSED` | 0 errors; pre-existing warnings |
| `npm run build` | `PASSED` | 2026-07-22 |
| Owner browser check | `PASSED` | hover/dismiss iteration |

## Next Action

1. Confirm GitHub Pages deploy after push to `master`.

## Prior stable release

- Last deployed: `v36` commit `a81b80f` — GitHub Pages run [29832776324](https://github.com/carlolidres/gxp-toolkit/actions/runs/29832776324) (2026-07-21).
