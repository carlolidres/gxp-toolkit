# eDoc Staging Test Accounts

**Do not use real production or team user accounts for browser smoke, Playwright, or password resets.**

Phase 4 and automated e2e use **disposable staging-only accounts** on the `@example.test` domain. Real users (e.g. colleagues with live email addresses) must not be assigned pilot fixtures, menu permissions, or test passwords for this workflow.

## Test accounts

| Role | Email | Purpose |
|------|-------|---------|
| Reviewer / assignee | `edoc-reviewer@example.test` | Inbox smoke — sees `EDOC-STAGING-001` |
| Document creator | `edoc-creator@example.test` | Create Document wizard smoke |
| RLS outsider | `edoc-outsider@example.test` | Not in org; eDoc menus denied |

Password is set only when provisioning (see below). Store it in a local secret manager or shell env — **never commit**.

## One-time setup (staging)

```powershell
# 1. Service role key from Supabase Dashboard → Settings → API (local env only)
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
$env:STAGING_EDOC_TEST_PASSWORD = "<strong-staging-only-password>"

# URL from .env.local or dashboard
$env:VITE_SUPABASE_URL = "https://<project-ref>.supabase.co"

npm run edoc:provision-test-users

# 2. Seed org, permissions, and fixture assignment for test accounts
npm run edoc:seed-staging-test

# 3. Verify backend prerequisites
supabase db query --linked -f supabase/scripts/verify_edoc_phase4_browser.sql
```

## Browser / Playwright smoke

```powershell
$env:E2E_EDOC_TEST_PASSWORD = "<same-as-STAGING_EDOC_TEST_PASSWORD>"
npm run e2e:edoc-staging
```

Optional per-role overrides: `E2E_EDOC_REVIEWER_EMAIL`, `E2E_EDOC_REVIEWER_PASSWORD`, `E2E_EDOC_CREATOR_EMAIL`, `E2E_EDOC_CREATOR_PASSWORD`.

## Manual smoke (no Playwright)

1. `npm run dev` with staging `.env.local` and `VITE_BASE_PATH=./`
2. Sign in as **edoc-reviewer@example.test** → eDoc → **My Inbox** → `EDOC-STAGING-001`
3. Sign in as **edoc-creator@example.test** → eDoc → **Create Document**

## Cleaning up real-user pilot seed (optional)

If `seed_edoc_pilot.sql` was applied earlier against real profiles, re-run:

```powershell
supabase db query --linked -f supabase/scripts/revert_edoc_real_user_pilot.sql
npm run edoc:seed-staging-test
```

This removes real users from the staging eDoc org and reassigns the fixture to the test reviewer.

## RLS SQL tests (Phase 3)

JWT simulation scripts (`verify_edoc_rls_manual.sql`) resolve auth IDs by **test account email**. No real-user sessions are required.
