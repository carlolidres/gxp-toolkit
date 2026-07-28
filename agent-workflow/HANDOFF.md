# Current Handoff

Last Updated: `2026-07-28`
Version: `v41`
Branch: `main` (+ `master` for Pages deploy)
Commit: `(pending after commit)`
Deployment: pending GitHub Pages

## Current Status

**v41** — External Document Controller authorization, User Management picker, eDoc profile gate, profile avatars, lean dashboards.

## Key implementation notes

### External Document Controller authorization
- Detection: normalized `profiles.organization` creator vs assignees (Option A).
- Send RPC `edoc_create_and_start_route`: blocks if external + no active DC; else prepends `step_kind=external_auth` approve/`any` step; defers member bootstrap for external assignees.
- Advance RPC `edoc_advance_route`: first-action-wins lock, sibling/creator notify via `edoc_notify_profiles` → `edoc_notifications`, bootstrap on approve, race message “already completed.”
- Helpers: `edoc_list_org_document_controllers`, `edoc_admin_missing_controller_warnings`.
- Client: `src/lib/edocExternalAuth.ts`; Create preflight + warning; Workspace banner; Admin AppShell + User Management missing-DC alerts; self-assign confirm on DC nomination.
- Migrations applied to staging `ydndeoacgfnxjqwwnswh`:
  - `20260728150000_edoc_external_auth_gate.sql`
  - `20260728151000_edoc_external_auth_advance.sql`
  - (also) `20260728120000_admin_nominate_edoc_document_controller.sql`, `20260728140000_profile_avatar.sql`

### Also in v41
- Profile avatar (`avatar_data_url`); User Management authorization picker; eDoc profile-completion gate; Document Controller nomination; lean eDoc/APQR dashboards.

## Verification

| Check | Status | Result |
|---|---|---|
| Staging RPCs + `step_kind` | `PASSED` | external-auth create/advance/notify/list/warnings |
| `src/lib/edocExternalAuth.test.ts` | `PASSED` | 2 tests |
| `npm run type-check` | `PASSED` | `tsc -b` |
| `npm run db:map` | `PASSED` | 32 tables |
| GitHub Pages deploy | `PENDING` | push to `master` |

## Next Action

1. Confirm GitHub Pages workflow success after push.
2. Browser-smoke external auth flows on staging/Pages when convenient.

## Prior stable release

- Previous: `v40` — eDoc Send → inbox/workspace PDF — GitHub Pages run [30271079381](https://github.com/carlolidres/gxp-toolkit/actions/runs/30271079381).
