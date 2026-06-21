# Active Plan

Last Updated: `2026-06-21`
Plan Owner: `Codex`
Status: `COMPLETE`

## Objective

Fix deployed Supabase Auth 401 feedback while preserving secret-handling controls and the GitHub Pages deployment workflow.

## Approval and GxP Gate

- GxP impact: `YES`
- Approved task plan: `NOT_AVAILABLE`
- Approval status: `HANDOFF_REQUEST`
- Approver and date: `N/A`

Implementation note: no live Supabase secret update, migration, deployment, push, or production data import is performed without explicit approval. Work is limited to local code/doc fixes and verification unless approval is granted.

## Ponytail Simplicity Gate

- [x] Requirement is necessary now; deployed auth 401 feedback was reported.
- [x] Existing auth service and message normalization were reused.
- [x] No new runtime dependency was added.
- [x] Secret publication was not attempted without explicit approval.
- [x] A small focused test was added for the auth-message behavior.

Chosen rung and rationale:

`REUSE + MINIMUM FIX — Normalize the existing Supabase/Auth 401 error path and document the required secret update without exposing credentials.`

## Scope

Included:

- Sanitize the handoff feedback so no password or long console dump remains in tracked docs.
- Add a user-facing auth message for Supabase/Auth 401 failures caused by invalid/mismatched deployed secrets.
- Add a focused unit test for the auth-message path.
- Update current and versioned handoffs.

Excluded:

- Reading, printing, committing, or publishing secret values.
- Updating GitHub repository secrets without explicit approval.
- Redeploying to GitHub Pages without approval.
- Changing Supabase provider, redirect, user, or database settings.

## Acceptance Criteria

- [x] Handoff feedback no longer contains the pasted password.
- [x] Supabase/Auth 401s produce an actionable deployment-secret message.
- [x] Focused auth-message test covers the 401 path.
- [x] App tests and build pass after the auth-message fix.

## Implementation Steps

- [x] 1. Read required startup files plus `CODEMAP.md`, baseline, and active plan.
- [x] 2. Inspect auth service, Supabase client, redirect, and auth-message helpers.
- [x] 3. Add Supabase/Auth 401 message normalization and focused test.
- [x] 4. Sanitize `HANDOFF.md` and create v6 handoff.
- [x] 5. Run verification and app checks.

## Expected Files

| Path | Expected change |
|---|---|
| `src/lib/authMessages.ts` | Supabase/Auth 401 message normalization |
| `src/lib/authMessages.test.ts` | Focused auth-message test |
| `agent-workflow/HANDOFF.md` | Sanitized feedback and current auth blocker |
| `agent-history/version-6-handoff.md` | Versioned auth feedback checkpoint |

## SQLite Impact

- Impact: `REVIEW_ONLY`
- Editable SQL: `NONE`
- Generated map target: `NONE`
- Map command: `NOT_APPLICABLE`
- Rollback: `N/A`

SQLite remains placeholder-only; Supabase is the prepared migration target for this task.

## Security and Compliance Impact

```text
AUTHENTICATION | AUTHORIZATION | AUDIT | DATA_INTEGRITY | DEPLOYMENT
```

Details:

`Auth messaging was changed only to clarify Supabase/Auth 401 deployment-secret failures. The suspected live fix requires GitHub Actions secret updates, but secret publication requires explicit approval. The baseline remains unapproved/template-like.`

## Verification Plan

- [x] Auth message focused test: `npm run test -- src/lib/authMessages.test.ts`
- [x] Lint: `NOT_CONFIGURED`
- [x] Type-check: covered by `npm run build`
- [x] Unit/self-check: `npm run test`
- [x] Production build: `npm run build`
- [x] SQLite schema-map sync: `NOT_APPLICABLE`
- [x] Deployment: `NOT_RUN`

## Risks, Dependencies, and Blockers

- Risk: `Deployed Supabase Auth will continue to fail until GitHub Actions secrets are corrected and the site is redeployed.`
- Risk: `Supabase provider redirect settings or user state may still need verification after the anon key is corrected.`
- Risk: `Baseline and approved task plan remain template-like; production-regulated use requires owner approval.`
- Risk: `Build still reports Vite chunk-size warning; build passes.`
- Blocker: `Updating GitHub secrets from .env.local requires explicit approval.`

## Completion Notes

Reviewer auth feedback was sanitized and converted into an actionable app message. The likely root cause is a missing, invalid, or mismatched GitHub Actions Supabase anon key; no external secret update was performed without approval.
