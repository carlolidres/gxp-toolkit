# eDoc Document Integrity & Signature Verification — Phase 1

**Status:** Phase 1 software controls implemented; **not** a claim of FDA Part 11 certification  
**Date:** 2026-08-04  
**Module:** eDocuSign  
**Canonical plan path:** `plans/edoc-integrity-verification/plan.md`

## Scope of this phase (implemented in software)

1. Per-page integrity footer on content pages of the finalized PDF  
2. Page Integrity Codes (SHA-256 of canonical page material; **not** the final file hash)  
3. Final SHA-256 of the exact downloadable PDF stored only in the database  
4. Opaque verification URL + QR on signature blocks (read-only verify page)  
5. Public verification page with Authentic / Failed / Superseded / Revoked statuses  
6. Upload-and-compare final file hash on the verify page  
7. Audit events for finalize integrity generation and public verification lookups  

## Requirements traceability (owner URS summary)

| URS area | Phase 1 software | Deferred / owner process |
|---|---|---|
| §1 Page footer + Page Integrity Code + final SHA-256 in DB | Done at finalize | New controlled revision workflow after post-completion change |
| §2 Clickable signature → opaque verify URL | Done (URI + manifestation) | CMS/PAdES + trusted timestamp + PDF encryption lock |
| §3 Verification QR | Done on signature block | — |
| §4 Public verify page + hash upload | Done (`/#/verify/:code`) | CDN rate-limit / bot protection |
| §5 Signer auth / MFA / lockout / certification letter | Reauth + meaning + consent exist | MFA policy, formal e-sig certification package |
| §6 Full audit trail inventory | Core edoc audit + integrity events | Exhaustive event catalog gaps (view/download/field move) as separate backlog |
| §7 Lifecycle / WORM / retention / revoke UX | Roles + encryption in transit via platform | WORM tier, formal retention SOP, revoke UI |
| §8 UX / accessibility on verify | Basic responsive verify page | Deeper a11y / hover tooltips in PDF readers |
| §9 URS / IQ-OQ-PQ / VSR / RTM evidence pack | This plan + unit tests | Formal validation records (owner/QA) |

## Explicitly out of scope / deferred (not claimed complete)

| Item | Reason |
|---|---|
| CMS/PAdES certificate-based PDF digital signatures + trusted timestamp | Requires org PKI / TSA |
| Full URS / IQ-OQ-PQ / VSR package as approved records | Owner/QA process |
| MFA mandate for all signatures | Risk assessment–driven |
| Immutable WORM object lock | Depends on storage tier |
| Rate-limit / bot protection at CDN edge | Infra |
| Guaranteed “FDA compliant” labeling | Forbidden claim |

## Canonicalization (page integrity)

**Algorithm ID:** `edoc-page-integrity-v1`

For each content page **before** drawing the integrity footer and **before** appending completion-history pages:

1. Copy the single page into a temporary PDF document (pdf-lib `copyPages`).  
2. Serialize that temporary PDF with `save()`.  
3. Compute `page_content_sha256 = SHA-256(bytes)` (hex, lowercase).  
4. Compute  
   `page_integrity_code = SHA-256("edoc-page-integrity-v1" || "|" || document_id || "|" || revision || "|" || page_number || "|" || page_content_sha256)`  
   Display the **first 16 hex characters** as the Page Integrity Code (labeled as a truncated code, never as the full PDF file hash).  
5. Draw the footer. Footer text is **excluded** from the page content hash by construction (hash precedes draw).  

**Excluded from page content hash:** integrity footer, completion-history pages, final-file digest, verification QR/link annotations drawn after the page hash step (links/QR are applied after page hashes are locked; they change bytes but page codes remain historically valid for the pre-annotation page snapshot stored in DB).

**Final file digest:** After all pages, footers, signature links/QR, and history pages are present, `final_pdf_sha256 = SHA-256(exact downloadable bytes)` and is stored only in DB / certificate record — never embedded into the PDF.

## Security model (public verify)

- Lookup key = opaque `verification_code` (UUID), not document/DB sequential IDs.  
- Anon-callable RPC / edge returns **minimum** public fields only.  
- Full PDF, audit trail, IPs, and auth evidence require authenticated document access.  
- Verification lookups append audit events and do not mutate the certificate hash.

## When controls appear

Integrity footers, signature verify links, and QR codes are applied when the route **finalizes** (all required signatures complete). In-progress / draft preview PDFs will **not** show these marks — download the **Final Signed PDF** after completion, or open `/#/verify/{code}`.

**Bug fixed 2026-08-05:** `applyContentIntegrityAndVerifyMarks` called `cssNormalizedToPdfRect(field, pageW, pageH)` (3 args). The helper expects `(field, { width, height })`, so link/QR geometry became `NaN` and finalize returned HTTP 500. Completed routes then had no certificate / integrity PDF. Fix deployed on staging; document view shows **Generate Final Signed PDF** when certificate or page-integrity rows are missing.

## Acceptance (phase 1)

- [x] Footer on each content page with Document ID, Revision, Page X of Y, Page Integrity Code (finalize pipeline)  
- [x] Final SHA-256 stored; upload compare on verify page  
- [x] One-byte change → verification failed (client compare)  
- [x] Signature link opens `/#/verify/{code}` read-only  
- [x] QR encodes the same HTTPS/hash-router URL  
- [x] No “FDA approved/certified” wording  
- [x] Finalize geometry bug fixed + repair path for incomplete certificates  
- [ ] Owner live E2E: Generate Final Signed PDF → download → confirm footer/QR → verify page hash match  
- [ ] Formal validation package (deferred)  
