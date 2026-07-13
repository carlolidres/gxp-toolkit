# Active Plan

Last Updated: `2026-07-13`

Plan Owner: `Cursor`

Status: `IMPLEMENTED`

## Objective

Improve login logo integration, Messages drawer UX, notification sharpness, global typography, VRMS routing form alignment, and searchable/editable registry suggestions while preserving existing data, workflows, and permissions.

## Acceptance

1. [x] Login lockup blends with login-story background in light/dark
2. [x] Messages open as a right-side drawer (~40% desktop, responsive)
3. [x] Clear/Send live in compose section; copy action on inbox entries
4. [x] Ant notifications render sharply with elevated z-index
5. [x] Routing form grid alignment improved
6. [x] Registry-backed fields are searchable; Status/Sent/Routing are search-only
7. [x] Inline create (non-workflow registries) persists after successful save
8. [x] Authorized remove with confirmation; historical records untouched
9. [x] Typography baseline raised via Ant tokens + CSS
10. [x] Focused tests + type-check + build passed
11. [ ] Owner browser visual check
12. [ ] Remote migration `20260713170000_registry_values_ci_unique_and_rls.sql` applied when history drift is repaired

## Remaining

- Owner visual check across breakpoints and themes
- Apply registry CI unique + RLS migration after Supabase history repair
