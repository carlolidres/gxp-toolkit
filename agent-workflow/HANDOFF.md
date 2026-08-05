# Current Handoff

Last Updated: `2026-08-05`
Version: `v42`
Branch: `main` (+ `master` for GitHub Pages)
Commit: `(pending commit)`
Deployment: staging `ydndeoacgfnxjqwwnswh` + GitHub Pages (pending push)

## Current Status

**v42 release** — eDoc integrity Phase 1 + Final Signed PDF automation + critical/high audit fixes.

### Included

- Per-page integrity footers, Page Integrity Codes, final SHA-256, verify links/QR, public verify page
- Auto Final Signed PDF after route complete; download bound to certificate hash
- Finalize claim-before-upload, orphan purge, assignee-only sign, admin delete verification-lookup purge
- Related eDoc UX (disposition, zoom, due-date inbox, assignable profiles)

Plan: `plans/edoc-integrity-verification/plan.md`

## Verification

| Check | Result |
|---|---|
| `npm run type-check` | PASS (pre-release) |
| `vitest` pageIntegrity | PASS |
| Staging migration + edge finalize/sign | PASS (prior session) |
| GitHub Pages deploy | PENDING push to `master` |

## Next Action

1. Push `main` + `master`; confirm Pages workflow success.
2. Owner smoke-test Final Signed PDF + verify page on production URL.
