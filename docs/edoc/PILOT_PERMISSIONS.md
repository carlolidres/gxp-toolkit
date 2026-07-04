# eDoc Pilot Permissions (Staging)

> **Browser smoke / Playwright:** use disposable accounts in [`STAGING_TEST_ACCOUNTS.md`](STAGING_TEST_ACCOUNTS.md) — **not** real team emails.

## Staging test accounts (Phase 4+)

| Role | Email | Org member? |
|------|-------|-------------|
| Reviewer / assignee | `edoc-reviewer@example.test` | Yes |
| Document creator | `edoc-creator@example.test` | Yes |
| RLS outsider | `edoc-outsider@example.test` | No |

Provision + seed: `npm run edoc:provision-test-users` → `npm run edoc:seed-staging-test`.

---

## Historical note — real-user pilot seed (deprecated)

`seed_edoc_pilot.sql` previously targeted real staging profiles. That seed is **deprecated** for smoke testing. To detach real users:

```powershell
npm run edoc:revert-real-user-pilot
npm run edoc:seed-staging-test
```

| Role | Email (historical — do not use for smoke) |
|------|-------------------------------------------|
| Reviewer | ghinogabriel@gmail.com |
| Creator | mmbuen@pharmaindustries.com |
| Outsider | isaiah014290118@gmail.com |

## Adjusting permissions in User Management

1. Sign in as **admin** → **User Management**
2. Select user → **Permission matrix** → toggle eDoc menus → **Save**

Changes write to `user_menu_permissions` (same shape as seed scripts).
