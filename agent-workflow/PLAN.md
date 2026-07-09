# Active Plan

Last Updated: `2026-07-09`

Plan Owner: `Cursor`

Status: `IMPLEMENTED`

## Objective

Ensure password-reset requests notify the admin via the Messages (bell) inbox, and that acknowledged notifications are deleted within 24 hours.

## Acceptance

1. [x] Forgot password inserts an `app_feedback_messages` row (admin Messages / topbar unread).
2. [x] Opening Messages acknowledges unread (marks `read` + stamps `status_updated_at`).
3. [x] `purge_expired_feedback_messages` deletes `read` messages after 24 hours (addressed/rejected remain 3 days).
4. [x] Migration applied to linked Supabase project (via MCP).
5. [x] Narrow tests + build pass.

## Remaining

- [ ] Browser smoke of notify → acknowledge → 24h delete
- [ ] Repair remote-only migration versions so `supabase db push` works again
- [ ] Frontend deploy
