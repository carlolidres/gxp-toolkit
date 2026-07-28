# Active Plan

Last Updated: `2026-07-28`

Plan Owner: `Cursor`

Status: `COMPLETE` (v41 commit/deploy in progress)

## Objective

External Document Controller authorization: when any signatory’s Account Settings organization differs from the creator’s, prepend a first-action-wins DC authorization step; block send if no controller; notify and audit throughout.

## Acceptance

1. [x] Migration: external org detect, DC prepend step (`completion_rule any`), defer member bootstrap, block if no DC + audit
2. [x] Advance path for `external_auth`: lock, sibling/creator notifications, bootstrap on approve
3. [x] TS helper + Create/Workspace UI warnings; race error messaging
4. [x] Admin persistent missing-DC warning + self-assign confirm/audit on DC nomination
5. [x] Tests, type-check, db:map, pilot docs, HANDOFF/PLAN
6. [x] Version bump to v41 + commit/push/deploy (owner requested)
