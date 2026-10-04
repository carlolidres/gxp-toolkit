# eDoc billing go-live checklist

Owner-only. Completing this list is required before live Paddle keys. The agent must not set live credentials.

Canonical plan: `plans/edoc-international-subscription/plan.md` (C1–C22 locked).

## Do not do yet

- Do not set `VITE_PADDLE_ENV=production` on staging project `ydndeoacgfnxjqwwnswh`.
- Do not put live `PADDLE_API_KEY` or live webhook secrets in this project's Edge secrets.
- Do not turn production checkout flags on until legal review and commercial name are done.

Live billing belongs in a **separate** Supabase project (C10).

## Commercial and legal (C19, C20)

- [ ] Public catalog name decided (internal module may stay eDoc; do not market as DocuSign).
- [ ] Counsel review of `/#/terms`, `/#/privacy`, `/#/refunds`, `/#/esign-consent`.
- [ ] Support contact published on those pages.
- [ ] Paddle account legal/business details match the seller.

## Wise payout (C5, C21)

Wise is **payout only**. Customers never pay through Wise.

- [ ] Wise **Business** account (personal Wise may fail Paddle onboarding).
- [ ] Add Wise receive details as the Paddle live payout destination (USD / EUR / GBP as Paddle pays).
- [ ] Confirm a sandbox or live test payout path in Paddle before public checkout.

## Live Paddle project (separate from staging)

- [ ] Live seller account (PH supplier allowed per Paddle's published list).
- [ ] Live products and six `pri_…` price IDs stored only as Edge secrets `PADDLE_PRICE_*` in the **live** project.
- [ ] Live webhook URL: `https://<live-project>.supabase.co/functions/v1/edoc-paddle-webhook` (`verify_jwt` false; Paddle signature on raw body).
- [ ] Live success URL: `https://carlolidres.github.io/gxp-toolkit/?billing=success#/billing/success`.
- [ ] Staging webhook remains sandbox-only:
  `https://ydndeoacgfnxjqwwnswh.supabase.co/functions/v1/edoc-paddle-webhook`

## Flags (default off until owner enables)

Edge: `BILLING_ENABLED`, `PADDLE_CHECKOUT_ENABLED`, `BILLING_PORTAL_ENABLED`, `BILLING_RECONCILE_ENABLED`  
Client: matching `VITE_*` flags. Postgres `edoc_billing_runtime` is a separate quota switch.

- [ ] Sandbox checkout verified with flags on, then flags returned to off if needed.
- [ ] Live flags enabled only on the live project after the test matrix passes.

## Monitoring

- [ ] GitHub secret `EDOC_BILLING_RECONCILE_SECRET` matches Edge `BILLING_RECONCILE_SECRET`.
- [ ] `BILLING_RECONCILE_ENABLED=true` on the environment that should run daily drift repair.
- [ ] Confirm `.github/workflows/edoc-billing-reconcile.yml` completes (`workflow_dispatch`).
- [ ] eDoc Administration shows last reconcile, failed webhook count, and past-due count.

## Sandbox → live test matrix

Use `plans/edoc-international-subscription/test-matrix.md`. Do not mark production done until that file is checked off in live.
