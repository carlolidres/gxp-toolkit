# Current Handoff

Last Updated: `2026-08-18`
Version: `v43`
Branch: `main`
Commit: pending this push
Deployment:
- GitHub Pages: deploying v43 (stamp + billing UI; billing flags remain off)
- Staging Edge: checkout, webhook, portal, reconcile on `ydndeoacgfnxjqwwnswh`
- App URL: https://carlolidres.github.io/gxp-toolkit/

## Current Status

eDoc international billing Phases 2–6 are in the app with **all public flags off**. Entitlement is webhook-only (C4). Live Paddle keys are not set (C10). Collision-free e-signature stamps shipped in `128ed52` and are included in this release.

Wise is payout only.

Plans:
- Billing: `plans/edoc-international-subscription/plan.md`
- Stamp: `plans/edoc-signature-stamp-responsive/plan.md`
- Go-live: `plans/edoc-international-subscription/go-live-checklist.md`

## Next Action

1. Owner: sandbox checkout/portal flags when ready. Keep live keys off.
2. Complete go-live checklist (commercial name, counsel review, Wise Business, separate live project) before public charges.

## Verification

| Check | Result |
|---|---|
| Billing unit tests | pending this session |
| `npm run test` | pending this session |
| GitHub Pages | pending deploy |
| Live Paddle keys | NOT_SET (intentional) |
