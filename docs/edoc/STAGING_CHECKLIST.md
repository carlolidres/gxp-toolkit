# eDoc Staging Migration Checklist

Use this checklist when applying eDoc to the linked Supabase project (`supabase/.temp/linked-project.json`) or a dedicated staging project.

## Phase 1 — SQLite reference (local, no Supabase)

| Step | Command / action | Expected result |
|------|------------------|-----------------|
| 1.1 | Review `database/sqlite/edoc_schema.sql` against `supabase/migrations/20260704100000_edoc_supabase_module.sql` | Table/column parity for all `edoc_*` entities |
| 1.2 | `npm run db:map` | Regenerates `sqlite-out/` with eDoc tables |
| 1.3 | `npm run verify:edoc-sqlite` | Table coverage + FK targets pass; live apply if `sqlite3` on PATH |
| 1.4 | `npm run db:init` (optional) | `database/sqlite/dev.db` includes pilot seed from `edoc_seed.sql` |

## Phase 2 — Staging Supabase apply

| Step | Command / action | Expected result |
|------|------------------|-----------------|
| 2.1 | Back up staging project (Dashboard → Database → Backups) | Backup confirmed |
| 2.2 | Confirm prior migrations applied: `supabase migration list` | All migrations before `20260704100000` show **Applied** |
| 2.3 | Apply pending migrations: `supabase db push` | `20260704100000_edoc_supabase_module.sql` applied without error |
| 2.4 | Deploy Edge Functions | See commands below |
| 2.5 | Confirm storage buckets | Five `edoc-*` buckets, all **private** |
| 2.6 | Run RLS script | See commands below |
| 2.7 | Seed org membership for pilot users | See SQL below |
| 2.8 | Grant eDoc menu permissions | User Management → enable eDoc menus per role |
| 2.9 | Browser smoke test | Sign in → eDoc Dashboard → Create Document (staging) |

### Commands (PowerShell, repo root)

```powershell
# Link project (once)
supabase link --project-ref <your-staging-ref>

# Check migration status
supabase migration list

# Apply pending migrations to linked remote
supabase db push

# Deploy Edge Functions
supabase functions deploy edoc-file-access
supabase functions deploy edoc-sign-document
supabase functions deploy edoc-create-certificate

# RLS static validation (requires psql or Supabase SQL editor)
# Paste contents of supabase/scripts/verify_edoc_rls.sql into SQL editor
```

### Pilot org membership (SQL editor — replace profile IDs)

```sql
INSERT INTO public.edoc_organizations (id, name, slug)
VALUES ('staging-edoc-org', 'Staging Quality Org', 'staging-quality')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.edoc_organization_members (organization_id, profile_id, membership_role, status)
SELECT 'staging-edoc-org', p.id, 'owner', 'active'
FROM public.profiles p
WHERE p.email = 'admin@example.com'  -- replace with staging admin email
ON CONFLICT (organization_id, profile_id) DO NOTHING;
```

## Phase 3 — Manual RLS scenarios (two test users)

Run after Phase 2.6 static checks pass.

| # | Scenario | How to test | Pass criteria |
|---|----------|-------------|---------------|
| 3.1 | Cross-org document read | User B (not in org) queries `edoc_documents` for org A doc | 0 rows / denied |
| 3.2 | Wrong assignee action | User B calls `edoc_advance_route` on User A assignment | Exception: not authorized |
| 3.3 | Audit immutability | Attempt UPDATE/DELETE on `edoc_audit_events` | Trigger blocks with append-only message |
| 3.4 | Storage access | Request signed URL via `edoc-file-access` for foreign doc | 403 / authorization error |
| 3.5 | Return without reason | `edoc_advance_route(..., 'return', NULL)` | Exception: reason required |

## Phase 4 — Frontend verification (disposable staging test accounts)

**Do not use real team user accounts for smoke or Playwright.** See [`STAGING_TEST_ACCOUNTS.md`](STAGING_TEST_ACCOUNTS.md).

### 4.0 Provision + seed

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "<from-dashboard>"
$env:STAGING_EDOC_TEST_PASSWORD = "<staging-only-password>"
npm run edoc:provision-test-users
npm run edoc:revert-real-user-pilot   # if real-user pilot seed was applied earlier
npm run edoc:seed-staging-test
supabase db query --linked -f supabase/scripts/verify_edoc_phase4_browser.sql
```

Pass: `PASS 4.R` (reviewer inbox) and `PASS 4.C` (creator permission).

### 4.1 Local dev setup

| Step | Action | Pass criteria |
|------|--------|---------------|
| 4.1 | Staging `VITE_SUPABASE_*` in `.env.local` | Footer: **Supabase live backend** |
| 4.2 | `VITE_BASE_PATH=./` for local dev | Routes at `http://127.0.0.1:5173/#/edoc` |
| 4.3 | `npm run build` && `npm run test` | All pass |

### 4.2 Automated smoke (Playwright)

```powershell
$env:E2E_EDOC_TEST_PASSWORD = "<same-as-STAGING_EDOC_TEST_PASSWORD>"
npm run e2e:edoc-staging
```

| Test account | Expected behavior |
|--------------|-------------------|
| `edoc-reviewer@example.test` | Inbox shows `EDOC-STAGING-001`; `/edoc/create` denied |
| `edoc-creator@example.test` | Create Document wizard loads |

### 4.3 Manual browser smoke

1. Sign in as **edoc-reviewer@example.test** → **My Inbox** → `EDOC-STAGING-001`
2. Sign in as **edoc-creator@example.test** → **Create Document**

### Mock e2e (no Supabase)

```powershell
npm run e2e
```

## Rollback

1. Revert frontend deploy to prior GitHub Pages build.
2. Do **not** drop `edoc_*` tables on staging without owner approval — use feature flags via menu permissions instead.
3. If migration must be reversed, restore from Supabase backup taken in step 2.1.

## Sign-off

- [ ] Phase 1 SQLite reference verified
- [ ] Phase 2 migration + functions deployed on staging
- [ ] Phase 2.6 RLS static script PASS
- [ ] Phase 3 manual RLS scenarios PASS
- [ ] Phase 4 browser smoke PASS
- [ ] Owner approves production apply
