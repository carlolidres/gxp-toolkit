# Active Plan

Last Updated: `2026-08-04`

Plan Owner: `Cursor`

Status: `IN PROGRESS` → Phase 1 software complete; validation package deferred

Active visual/requirements plan: `plans/edoc-integrity-verification/plan.md`

## Objective

Deliver Phase 1 eDoc integrity footers, page codes, signature verify links/QR, and public verification without claiming FDA certification. Add PDF zoom on document/workspace preview.

## Done (Phase 1)

1. Canonicalization helpers + unit tests  
2. Finalize: footers, links, QR, page-code persistence, audit events  
3. Migration + `edoc_public_verify_certificate` RPC  
4. Public verify page + hash upload compare  
5. Staging migrate + finalize deploy  
6. PDF zoom in/out (document view + signing workspace)  
7. URS §1–§9 mapped in plan (software vs deferred)

## Remaining / deferred

- PAdES / TSA  
- Full URS / RTM / IQ-OQ-PQ / VSR  
- MFA policy, WORM storage, CDN bot protection  
- Live E2E finalize smoke by owner  
- Exhaustive audit-event catalog gaps (separate backlog)  
