# Active Plan

Last Updated: `2026-07-22`

Plan Owner: `Cursor`

Status: `IMPLEMENTED`

## Objective

Desktop-only (≥961px) fully collapsed sidebar with a 28×28 Expand FAB and hover/focus-revealed icon-only navigation rail; persist collapse across remounts/routes; keep mobile drawer behavior.

## Acceptance

1. [x] Collapsed desktop: only FAB at top 12 / left 12 / z-index 1100
2. [x] Hover or focus-within reveals group icon rail; group hover shows glass-bubble text submenus
3. [x] Role-filtered hierarchy, active route highlight on group + submenu labels
4. [x] FAB click → exit animation → full sidebar/topbar; chrome unmounted when expanded
5. [x] Collapsed: hide sidebar/topbar; ~44px main left padding; sessionStorage persistence
6. [x] Mobile ≤960px keeps drawer/hamburger; hover chrome hidden
7. [x] Focus labels, keyboard rail reveal, scroll for long menus
8. [x] Focused persistence test + type-check + lint (0 errors)

## Remaining

- Owner browser visual check (light/dark, long permission set, tooltip hover path)
