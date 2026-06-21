# Version v6 Handoff

Baseline Reference:

```text
agent-history/version-0-baseline.md
```

Version: `v6`
Date: `2026-06-21`
Status: `COMPLETE_LOCAL_FIX`
Prepared By: `Codex`

## Objective

Address reviewer feedback that deployed Supabase Auth returns `401 Unauthorized` for Google OAuth, email/password sign-in, email signup, and OAuth signup flows.

## Scope of Changes

Included:

- Sanitized `agent-workflow/HANDOFF.md` to remove a pasted password and replace long console traces with a concise feedback summary.
- Added user-facing normalization for Supabase/Auth 401 failures so the app explains that the deployed Supabase URL/anon key secrets need to match the same Supabase project.
- Added a focused Vitest check for the 401 auth-message path.

Not included:

- Reading or exposing `.env.local` values.
- Redeploying with updated secrets.
- Changing Supabase project settings or user credentials.

## Diagnosis

Multiple auth endpoints returning 401 at the Supabase project URL points to a deployment configuration problem, not a single bad password. The most likely cause was a missing, invalid, or mismatched `VITE_SUPABASE_ANON_KEY` in GitHub Actions secrets for the deployed bundle. After explicit approval, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` were updated in GitHub Actions secrets from `.env.local` without printing values.

The browser-extension line `writer.min.js` / Ginger Widget is unrelated to the application.

## Files Changed

| Path | Change |
|---|---|
| `src/lib/authMessages.ts` | Map Supabase/Auth 401 and invalid API key messages to a deployment-secret explanation |
| `src/lib/authMessages.test.ts` | Add focused test for the 401 message |
| `agent-workflow/HANDOFF.md` | Sanitize feedback and record the auth/deployment blocker |
| `agent-history/version-6-handoff.md` | Add this checkpoint |

## Security and Compliance Impact

```text
AUTHENTICATION | SECRET_HANDLING | DEPLOYMENT
```

Details:

`A pasted password was removed from the tracked handoff. No secret values were printed or committed. GitHub Actions Supabase secrets were updated only after explicit user approval.`

## Verification Performed

| Check | Command or Method | Result |
|---|---|---|
| Auth message unit check | `npm run test -- src/lib/authMessages.test.ts` | `PASSED; 1 test` |
| Full test suite | `npm run test` | `PASSED; 5 files, 17 tests` |
| Build | `npm run build` | `PASSED; chunk-size warning only` |

## Known Issues and Risks

| Severity | Issue or Risk | Impact | Recommended Action |
|---|---|---|---|
| MEDIUM | Existing deployment was built before refreshed GitHub Supabase secrets | Live login/signup/OAuth may keep failing until redeploy completes | Push v6 to `master`, confirm Pages workflow, then retest auth |
| MEDIUM | Live Supabase database/auth settings were not independently verified | App may still fail if provider redirect allow-list or user setup is wrong after key fix | Verify Supabase Auth providers, redirect URL allow-list, and target admin user |
| LOW | Build emits Vite chunk-size warning | App still builds, but initial bundle may be heavy | Consider code splitting after auth acceptance |

## Git Traceability

- Branch: `local main; deployment branch is origin/master`
- Commit: `NOT_COMMITTED`
- Pull request: `N/A`

## Deployment

- Environment: `GitHub Pages`
- Status: `READY_TO_REDEPLOY`
- Production URL: `https://carlolidres.github.io/gxp-toolkit/`
- Required external action: `Push v6 to master and confirm Pages redeploy`

## Next Steps

1. Run local verification for the auth-message fix.
2. Push/redeploy and retest login/signup/OAuth on the live site.
