# eDoc PayMongo + GoTyme (additive billing)

**Status:** Implementation in progress on `feature/paymongo-integration`  
**Date:** 2026-08-19  
**Source:** `reference/eDoc_PayMongo_GoTyme_Integration_Plan_for_Cursor.md`  
**Restore point:** git tag `pre-paymongo-integration`

This is an **additive** second provider. It does not replace Paddle. Existing C1–C22 in `plans/edoc-international-subscription/plan.md` remain locked.

## Locked decisions

| Decision | Value |
|---|---|
| Architecture | Paddle = international; PayMongo = Philippines (GCash, Visa/Mastercard, PayMaya). GoTyme = PayMongo settlement only — never entitlement. |
| Feature flag | `ENABLE_PAYMONGO` / `VITE_ENABLE_PAYMONGO` default **false**. Hide PayMongo without DB rollback. |
| Activation | Webhook signature + idempotency only (C4). Success URL never grants access. |
| Plan identity | Keep internal codes `FREE` / `PERSONAL_*` / `PRO_*` / `BUSINESS_*`. PHP list prices: 199 / 499 / 999. |
| Checkout UX | User chooses Philippines vs International. No IP geo-routing. |
| Double billing | One paid org subscription. Do not overwrite a live Paddle row with PayMongo (or the reverse). |
| Payment methods | Hosted checkout `payment_method_types`: `card` (Visa + Mastercard), `gcash`, `paymaya`. Enable those channels on the PayMongo account. |
| Secrets | PayMongo secret + webhook keys are Edge-only. Never `VITE_*`. |

## Rollback

```text
ENABLE_PAYMONGO=false
VITE_ENABLE_PAYMONGO=false
```

Paddle keeps working. PayMongo rows stay. No schema rollback required.
