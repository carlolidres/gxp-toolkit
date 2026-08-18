# eDoc international subscription (Paddle) — stack-specific plan

**Status:** Approved 2026-08-18 — Phase 2 checkout implemented; public flags off  
**Date:** 2026-08-18  
**Module:** eDoc  
**Canonical plan path:** `plans/edoc-international-subscription/plan.md`  
**Source blueprint:** `reference/eDocuSign_International_Subscription_Implementation_Plan.md`

**Not a Part 11 certification claim.** Billing must never rewrite signed-document evidence, hashes, or certificates.

**Approval status:** Owner approved 2026-08-18. Control register C1–C22 accepted with the locked decisions below. Phase 1 (foundation) may proceed. Public checkout remains **off**.

### Locked owner decisions (2026-08-18)

| Decision | Locked value |
|---|---|
| PAST_DUE grace | **14 days** (C18) |
| In-flight signing after cancel | **always allowed** (C2) |
| Billable seats | **exclude auto-added assignees** (`counts_toward_seat`) (C7) |
| Public catalog name | Internal **eDoc** for now; commercial name is a live-launch blocker (C19) |
| Staging `BILLING_ENABLED` | **off until owner turns it on** (C9) |
| Legal | Sandbox after approval; **live Paddle + public pricing only after policies** (C20) |

---

## Risk assessment and pre-approval controls

Severity: **C** critical · **H** high · **M** medium · **L** low.

### Pre-approval control register (must be accepted before plan approval)

These are **not** “build billing first.” They are decisions and design controls that must be part of the approved plan. Implementation of billing code is blocked until this register is accepted.

| ID | Control (required in the approved plan) | Risk it treats | Sev |
|---|---|---|---|
| C1 | **Record freeze:** Billing must never delete, purge, rewrite, re-hash, or hide Final Signed PDFs, certificates, signature events, page-integrity codes, or audit rows. Cancel/downgrade may only block **new** paid sends. | GxP evidence loss used as a billing lever | C |
| C2 | **In-flight routes complete:** Once a route exists, assignees may **sign/review/approve/acknowledge** and finalize regardless of FREE/PAST_DUE/CANCELED. Entitlement is checked at **send/create**, not at sign. | Incomplete regulated workflow; trapped signers | C |
| C3 | **Public verify stays free:** `/#/verify/:code` and verify QR/URI remain unauthenticated and not paywalled. | Broken trust in already-signed documents | C |
| C4 | **Webhook-only activation:** Browser success/cancel pages must not write `edoc_subscriptions` or entitlements. | Stolen success URL grants paid access | C |
| C5 | **No cards in eDoc / Wise is payout only:** No PAN/CVV storage. No Wise checkout. Paddle secrets never in `VITE_*`, git, or logs. | PCI + secret leak in GitHub Pages bundle | C |
| C6 | **Webhook JWT off, checkout JWT on:** `edoc-paddle-webhook` `verify_jwt = false` + Paddle signature on **raw body**. Checkout/portal functions require a user JWT and org membership. | Forged webhooks or open checkout | C |
| C7 | **Seat metric ≠ assignee membership:** Today send RPCs insert assignees into `edoc_organization_members` for RLS. Seat limits must count **billable seats** only (owner/admin/controller + opted members), **not** every assignee. | Business plan (5 seats) blocks external signers | C |
| C8 | **No auto-charge of existing users:** Pilot/staging orgs map to FREE. Checkout is explicit. | Surprise charges; destroys pilot trust | C |
| C9 | **Feature flags default off** in production (and staging until owner enables sandbox). | Accidental live checkout on github.io | H |
| C10 | **Sandbox vs live isolation:** Separate Paddle sandbox vs live price IDs and webhook endpoints. Staging project must not use live keys. | Real charges during QA | H |
| C11 | **Atomic usage:** Document quota increment inside the send RPC transaction (`SELECT … FOR UPDATE` or equivalent). | Two last-allowance sends both succeed | H |
| C12 | **Idempotent billing events:** Unique `(provider, provider_event_id)`; duplicate webhook returns 200 and does not double-provision. | Duplicate subscriptions / usage | H |
| C13 | **In-progress cancel policy:** Cancel-at-period-end by default. Immediate cancel (if ever offered) still obeys C1–C2. | Access yanked mid-signature | H |
| C14 | **Org-scoped checkout:** Checkout metadata includes `organization_id`. User with multiple orgs cannot bill the wrong org. | Charging Org A for Org B’s usage | H |
| C15 | **HashRouter return URLs:** Paddle success/cancel URLs must land on HashRouter (`…/gxp-toolkit/#/billing/success`). Query params must not be swallowed by the hash. | Paid customers stuck; support load | H |
| C16 | **RLS write path:** Clients may **read** own org billing rows. Only webhook/checkout Edge Functions (service role) **write** subscription/usage from Paddle. | User self-sets ACTIVE in the client | C |
| C17 | **Audit billing without secrets:** Log plan/status changes in `edoc_audit_events`. Never log API keys, webhook payloads with PII beyond what Paddle already stores, or card data. | Audit vs privacy conflict | M |
| C18 | **PAST_DUE grace (duration locked):** Recommended **14 days** full send access + banner, then same as canceled-after-period (C1–C2 still apply). Owner may pick another duration **in this plan** before approval. | Undefined dunning → accidental lockout | H |
| C19 | **Product name:** Public commercial name is a **launch blocker**, not a coding blocker. Internal module may stay “eDoc.” Do not market as DocuSign. | Trademark / Paddle / ads rejection | H |
| C20 | **Legal pages are a production blocker:** Terms, privacy, refund/cancel, e-sign consent. Sandbox coding may proceed after plan approval; **live Paddle + public pricing may not**. | Unenforceable charges; Paddle account risk | H |
| C21 | **Wise payout KYC:** Use **Wise Business** receive details as Paddle’s payout account. Personal Wise may fail Paddle onboarding. Confirm before live. | Seller cannot get paid | M |
| C22 | **Do not bill VRMS/APQR** under this plan. Entitlement hooks only in eDoc send/member paths. | Unrelated modules locked by eDoc quota | M |

### Owner decisions (locked 2026-08-18)

See **Locked owner decisions** at the top of this file. Do not re-open C1–C22 without an explicit owner amendment.

### Additional risks (controls during build, not approval blockers)

| ID | Risk | Control when building |
|---|---|---|
| R1 | Missed webhook / Edge outage | Daily reconcile job (Phase 6); admin “unprocessed events” view |
| R2 | Paddle.js token in frontend (expected) | Client token only; never API key |
| R3 | Price ID drift | Plans table stores `paddle_price_id`; webhook maps by price id, not name |
| R4 | Clock / timezone on period end | Store Paddle period timestamps as timestamptz; do not recompute in the browser |
| R5 | FREE_PLAN_LIMITS_ENABLED off while checkout on | If flags disagree, fail closed (treat as FREE limits) |
| R6 | Service-role webhook writes too broad | Function only upserts billing tables + refresh entitlements; no document/storage writes |
| R7 | Success-page polling race | Poll local subscription; show “activating” until webhook; timeout + “refresh / contact support” |
| R8 | GitHub Actions logs | Never echo Paddle secrets in deploy logs |
| R9 | Refunds | Paddle handles money; local status follows `subscription.updated`; do not invent refund RPCs in MVP |
| R10 | FX / PHP display | USD canonical; no home-grown FX engine |

### Residual risk after controls

Paddle remains a third-party MoR. Outages, tax classification errors, and payout delays (Wise) are **operational** residuals. They do not justify storing cards or skipping webhook verification.

---

## Recommendation (keep from the blueprint)

| Decision | Choice |
|---|---|
| International checkout | **Paddle Billing** (Merchant of Record) |
| App rule | **Paddle owns billing state. eDoc owns entitlement.** |
| Activation | **Webhook only** — never trust `/billing/success` |
| Abstraction | Internal `BillingProvider` so Xendit can be added later |
| Base currency | USD |
| Launch plans | FREE + Personal + Professional + Business (monthly and annual) |
| Trial | Permanent limited Free plan; no card required at signup |
| Existing users | Map to FREE; **do not auto-charge** |

Defer: usage overages, add-ons, SSO, custom invoices, Xendit, affiliate/reseller.

---

## Where Wise fits

Wise is **not** a checkout or subscription provider. Customers will not pay eDoc through Wise.

Use the existing Wise account as the **Paddle seller payout destination**:

```text
International customer
        │
        ▼
  Paddle Checkout (cards / wallets / local methods)
        │
        ▼
  Paddle (MoR: tax, receipts, dunning)
        │  settlement / payout
        ▼
  Wise Business account (USD / EUR / GBP local details)
        │  optional conversion
        ▼
  PHP or operating spend
```

Owner setup (outside the app, before production billing):

1. Paddle sandbox, then live seller account (PH supplier is allowed per Paddle’s published list).
2. Add Wise as the Paddle payout bank (Wise “Receive” details for the currency Paddle pays).
3. Keep Paddle API key / webhook secret in **Supabase Edge Function secrets**, never `VITE_*`.

Do not add a `WiseBillingProvider`. Do not collect cards in eDoc.

---

## Stack mapping (do not invent a Node API)

This app is a **Vite SPA on GitHub Pages** + **Supabase**. There is no `/api/billing/*` Express server. Map the blueprint as follows:

| Blueprint | This repo |
|---|---|
| Application API | Supabase Edge Functions + Postgres RPCs |
| `POST /api/webhooks/paddle` | `supabase/functions/edoc-paddle-webhook` (no user JWT; signature verify) |
| `POST /api/billing/checkout` | `edoc-billing-checkout` (authenticated) |
| `POST /api/billing/portal` | `edoc-billing-portal` (authenticated; Paddle hosted portal) |
| `GET /api/billing/plans` | Public/authenticated read from `edoc_subscription_plans` (RLS) |
| Entitlement checks | Postgres RPC inside existing send/create paths (server-side) |
| UI | HashRouter pages: `/#/pricing`, `/#/settings/billing`, `/#/billing/success` |
| Secrets | Edge secrets: `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET` |
| Browser | `VITE_PADDLE_CLIENT_TOKEN` + `VITE_PADDLE_ENV` only |

Webhook URL (staging):

```text
https://ydndeoacgfnxjqwwnswh.supabase.co/functions/v1/edoc-paddle-webhook
```

GitHub Pages cannot receive Paddle webhooks.

---

## Existing domain to reuse

Do **not** invent a second org model.

| Existing | Billing use |
|---|---|
| `edoc_organizations` | Subscription owner |
| `edoc_organization_members` | Seat counting (`status = 'active'`) |
| `membership_role` (`owner`, `admin`, …) | Billing admin = owner (MVP); billing-admin role later |
| `edoc_create_and_start_route` | Entitlement + `DOCUMENTS_SENT` check **before** send |
| `edoc_audit_events` | Billing audit events (no card data) |
| `profiles` | Identity only; subscription is not per-user |

Subscriptions belong to **organization**, not person.

---

## Schema (SQLite first, then Supabase)

Add to `database/sqlite/` then `npm run db:map` + `npm run verify:schema`. Only then write a Supabase migration.

Tables (names prefixed `edoc_` to match the module):

- `edoc_subscription_plans` — code, interval, `paddle_price_id`, currency, active
- `edoc_subscriptions` — org, plan, provider, provider ids, internal status, period, cancel-at-period-end
- `edoc_billing_customers` — org ↔ Paddle customer id
- `edoc_plan_entitlements` — `DOCUMENTS_PER_MONTH`, `USERS_PER_ORG`, feature flags
- `edoc_usage_counters` — `DOCUMENTS_SENT` (+ seats later) per period
- `edoc_billing_events` — provider + `provider_event_id` unique (idempotency)
- `edoc_billing_transactions` — optional local receipt cache from `transaction.completed`
- `edoc_billing_reconcile_runs` — daily drift job counts (no payloads)

Internal statuses: `FREE | TRIALING | ACTIVE | PAST_DUE | PAUSED | CANCELED | EXPIRED`

Translate Paddle statuses in **one** adapter. Do not scatter Paddle enums in UI.

RLS: org members can read own subscription/usage; only Edge Functions (service role) write from webhooks. Never expose service role to the browser.

---

## Access policy (GxP override)

| State | App behavior |
|---|---|
| FREE | Free limits |
| ACTIVE / TRIALING | Plan entitlements |
| PAST_DUE | Grace + banner; do not delete records |
| Canceled, period not ended | Keep paid access until `current_period_end` |
| After effective cancel / EXPIRED | Free/read-only for **new** sends; **keep** documents, signatures, certificates, audit |

Never delete or rewrite Final Signed PDFs because billing changed.

---

## Enforcement points (server only)

1. `edoc_create_and_start_route` (and any other send RPC): `canConsume(org, DOCUMENTS_SENT, 1)` then atomic increment.
2. Invite/add member: seat limit vs active members.
3. Feature gates (templates, branding, API) only when those features exist; do not stub unused gates.

Concurrency: `SELECT … FOR UPDATE` on `edoc_usage_counters` (Postgres). SQLite reference can use a simpler unique-row update for local mapping only.

---

## MVP UI

- `/#/pricing` — FREE / Professional / Business, monthly|annual toggle
- `/#/settings/billing` — plan, status, renewal, usage meter, Manage Billing (Paddle portal)
- `/#/billing/success` and `/#/billing/cancelled` — “activating…” copy; poll local subscription; **do not grant access here**
- Past-due banner on eDoc shell
- Limit modal with Upgrade CTA

Paddle.js overlay/inline checkout using client token. Checkout transaction created by the Edge Function with custom data:

```json
{ "organization_id": "…", "user_id": "…", "plan_code": "PRO_MONTHLY", "environment": "staging" }
```

No secrets in custom data.

---

## Feature flags

```text
BILLING_ENABLED
PADDLE_CHECKOUT_ENABLED
ANNUAL_BILLING_ENABLED
BUSINESS_PLAN_ENABLED
FREE_PLAN_LIMITS_ENABLED
BILLING_PORTAL_ENABLED
```

Default **off** until the owner enables them after the go-live checklist. Phase 6 ships readiness artifacts; it does not flip live flags.

---

## Implementation phases (approval required before coding)

### Phase 0 — Owner / commercial (not code)

- [ ] Paddle sandbox account
- [ ] Products + monthly/annual prices (PRO, BUSINESS; FREE is local-only)
- [ ] Wise payout details added in Paddle when going live
- [ ] Confirm public product name (blueprint flags **eDocuSign vs DocuSign** trademark risk)
- [ ] Pricing numbers locked (blueprint figures are proposals)
- [ ] Terms, privacy, refund/cancel pages path

### Phase 1 — Foundation

SQLite tables + seed plans + `BillingProvider` TypeScript interface + Paddle adapter (Edge). No public checkout yet.

### Phase 2 — Checkout

Pricing page + checkout Edge Function + success/cancel routes. Success page does not activate.

### Phase 3 — Webhooks

`edoc-paddle-webhook`: raw body, signature verify, idempotent `edoc_billing_events`, `subscription.created` / `subscription.updated` (+ `transaction.completed` if needed).

### Phase 4 — Entitlements

`EntitlementService` + document quota on send RPC + seat limit on add-member.

### Phase 5 — Billing management

Portal, upgrade (immediate), downgrade (period end + seat check), cancel-at-period-end, past-due banner.

### Phase 6 — Production readiness

Live credentials stay **unset**. Delivered: legal page routes, Wise payout + go-live checklist, sandbox→live test matrix, daily reconcile function (flag default off), admin billing-health counts.

**Owner next:** `plans/edoc-international-subscription/go-live-checklist.md`. Keep live keys off.

---

## Files expected (when approved)

- `database/sqlite/edoc_schema.sql` + seed
- `supabase/migrations/…_edoc_billing.sql` (after SQLite validation)
- `supabase/functions/edoc-paddle-webhook/`
- `supabase/functions/edoc-billing-checkout/`
- `supabase/functions/edoc-billing-portal/`
- `supabase/functions/_shared/edocBilling*.ts`
- `src/features/edoc/billing/` (types, entitlement helpers for UI display only)
- Pricing + billing settings pages
- `.env.example` placeholders: `VITE_PADDLE_CLIENT_TOKEN`, `VITE_PADDLE_ENV` (no API key)
- Public legal routes + `plans/edoc-international-subscription/go-live-checklist.md`

Do not edit `graphify-out/` or `sqlite-out/` by hand.

---

## Out of scope (this plan)

- Replacing Paddle with Wise for card checkout
- Xendit / GCash / Maya (later local provider behind the same interface)
- Changing signature crypto, integrity hashing, or certificate semantics
- Auto-charging current staging/pilot users
- Committing Paddle or Wise credentials

---

## Definition of done (MVP)

- International customer can complete Paddle Checkout
- Access flips only after a verified webhook
- Duplicate webhooks do not duplicate subscriptions
- Document and seat limits enforced in Postgres
- Historical signed records survive cancel
- No raw card data and no Paddle API key in the browser bundle
- Wise used only as payout destination, documented in HANDOFF

---

## Next

**Owner Step 2:** Done — six sandbox `pri_…` IDs recorded 2026-08-18.

```text
PERSONAL_MONTHLY=pri_01m09kd9fw8tpbeyrcnsrzy4ea
PERSONAL_ANNUAL=pri_01m09kem1734t13qt18y2xn75x
PRO_MONTHLY=pri_01m09kvd9rxggqb1jf49aknn4k
PRO_ANNUAL=pri_01m09kwn51w0ej0ptxstf5jwxx
BUSINESS_MONTHLY=pri_01m09m0pt9rmyp7fweexttyd4b
BUSINESS_ANNUAL=pri_01m09m1t2zg6t1pp8ppnwa1858
```

**Owner Step 3:** Client token in `.env.local` and sandbox API key in Edge secrets — done 2026-08-18.

**Owner Step 4:** Default payment link saved: `https://carlolidres.github.io/gxp-toolkit/#/billing/success`

**Phase 2–3 (agent):** Checkout + `edoc-paddle-webhook` deployed. Flags remain off. Success page does not activate (C4).

**Phase 4 (agent):** Document quota + billable seat enforcement in Postgres. Runtime row defaults **off**. Signing is not gated.

**Phase 5 (agent):** Billing settings, Paddle portal, upgrade/downgrade/cancel-at-period-end, past-due banner. Portal Edge flag defaults off.

**Phase 6 (agent):** Legal drafts, reconcile job (off by default), admin health counts, go-live checklist, test matrix. Live keys not set.

**Owner next:** Complete `plans/edoc-international-subscription/go-live-checklist.md` (Wise Business payout, counsel review, commercial name). Keep live keys off. To try sandbox portal after a subscribe, set `BILLING_PORTAL_ENABLED` / `VITE_BILLING_PORTAL_ENABLED`. To try reconcile, set `BILLING_RECONCILE_ENABLED` plus matching secrets.
