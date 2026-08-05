# Current Handoff

Last Updated: `2026-08-05`
Version: `v42`
Branch: `main` (+ `master` for GitHub Pages)
Commit: `dba4153`
Deployment:
- GitHub Pages: **PASS** — https://github.com/carlolidres/gxp-toolkit/actions/runs/31006467498
- Staging Supabase `ydndeoacgfnxjqwwnswh`: edge functions redeployed (`edoc-finalize-document`, `edoc-sign-document`, `edoc-admin-delete-document`, `edoc-create-certificate`)
- App URL: https://carlolidres.github.io/gxp-toolkit/

## Current Status

**v42 released and deployed.**

- eDoc Phase 1 integrity (footers, page codes, final SHA-256, verify links/QR, public `/#/verify/:code`)
- Auto Final Signed PDF after route complete; download bound to certificate hash
- Finalize hardening (claim-before-upload, orphan purge, assignee-only sign, admin delete lookup purge)
- Related eDoc UX (disposition, zoom, due-date inbox, assignable profiles)

Plan: `plans/edoc-integrity-verification/plan.md`

## Verification

| Check | Result |
|---|---|
| Commit `dba4153` pushed to `main` + `master` | PASS |
| GitHub Pages workflow | PASS |
| Edge function redeploy (4 functions) | PASS |
| Owner E2E on production URL | PENDING |

## Next Action

Owner smoke-test Final Signed PDF + public verify on https://carlolidres.github.io/gxp-toolkit/
