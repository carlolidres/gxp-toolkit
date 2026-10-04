# eDoc signature stamp — collision-free layout

**Status:** Implemented — staging edge functions redeployed; frontend uncommitted  
**Date:** 2026-08-18  
**Module:** eDocuSign  
**Canonical plan path:** `plans/edoc-signature-stamp-responsive/plan.md`  
**Owner prompt:** `reference/Prompt_ Make the e-Signature Block Fully Responsive and Prevent Element Overlap.md`

**Not a Part 11 certification claim.** Layout-only. Do not change signing crypto, page-integrity algorithm, or `final_pdf_sha256` semantics.

## Problem (confirmed from signed PDF)

Stacked stamps on the Final Signed PDF show:

1. Timestamp colliding with the QR (`GMT` under the code)
2. “Scan or click to verify…” drawn **between** cards, overlapping both borders
3. Inconsistent ink scaling across signers
4. No reserved QR / footer region in the stamp planner

## Root cause

QR and caption are **not** part of `planSignatureStampLayout`. They are painted later in `applyContentIntegrityAndVerifyMarks`:

```text
qrSize  = clamp(fieldW * 0.22, 16, 28) vs fieldH * 0.55
qrX     = field.x + field.width - qrSize - 2
qrY     = field.y + 2                    ← bottom-right of field (on top of timestamp)
caption y = max(field.y - 8, 16)         ← OUTSIDE the card, onto the next stamp
```

Files:

| Path | Role |
|---|---|
| `supabase/functions/_shared/edocIntegrityFinalize.ts` | Overlay QR + caption with absolute field coords (bug) |
| `src/features/edoc/pdfStampGeometry.ts` | Planner: ink + status + timestamp; **no QR box / verify row** |
| `supabase/functions/_shared/edocStampGeometry.ts` | Edge copy of planner (must stay in sync) |
| `supabase/functions/_shared/edocPdfStamp.ts` | `drawSignatureBlock` — draws planner, not QR |
| `src/components/edoc/EdocSignatureStampPreview.tsx` + `src/styles/globals.css` | Placement preview; 2-column, no QR/footer |

pdf-lib cannot use CSS Grid. The planner must **reserve** boxes; CSS Grid is only for the HTML preview.

## Regression / deformation risk

| Risk | Why it happens | Severity | Control (mandatory at execution) |
|---|---|---|---|
| **Stacked stamps collide worse** | Planner already has `expandRectWithinPage`. Adding QR/caption by growing the card would paint onto the next field. | Critical | `STAMP_INTEGRITY_FIT_POLICY = 'contain-within-field'`. Never expand for integrity marks. Shrink internals / switch mode / wrap / hide caption. |
| **Caption outside field** | Current overlay uses `field.y - 8`. | Critical | Draw only `planIntegrityMarkSlots().verifyRow` (`y ≥ field.y`). Covered by unit tests. |
| **Ink stretched / oversized** | `STAMP_SIGNATURE_DRAW_BOOST = 1.05` plus non-contain draw. Different PNG aspect ratios look inconsistent. | High | Keep `containRect`; draw size `min(fit * boost, box)`. Do not raise boost. Test aspect ratio preserved. |
| **Existing completed PDFs change** | Re-finalize rewrites Final Signed PDF. In-progress sign-time stamps change if planner changes before last signature. | High | Do not migrate historical bytes. Overlay-only change affects **new finalize** (and explicit repair). Sign-time planner change only for **new** signatures. |
| **Page integrity / hash confusion** | QR is applied **after** page-content hash by design. Moving QR does not invalidate page codes; `final_pdf_sha256` changes for new finals. | Medium | Do not change hash algorithm or hash order. |
| **URI / QR verify broken** | Wrong slot coords or omitted QR in micro. | High | Keep `addUriLink` on full card. Omit QR only when slot &lt; 16 pt; caption may hide in micro. |
| **Client/edge geometry drift** | Two copies of the planner. | High | Change `pdfStampGeometry.ts` and `edocStampGeometry.ts` in the same commit. |
| **Preview ≠ PDF** | HTML 2-column vs PDF overlay. | Medium | Preview uses same slot/mode rules; no CSS-only layout the PDF cannot match. |
| **Readable identity lost** | Over-shrinking to fit QR. | Medium | Priority: status → name → ink → QR → date → caption. Ellipsize; do not drop name. |
| **`adjusted: true` on fields that already fit** | Reserving QR might fail `tryWideLayout` and trigger expansion. | High | Fixture `274×88` must remain `adjusted === false` and `stampBoxContains(field, card)`. |

**Do not “fix” overlap by making the field larger.** That is deformation.

## Controls already in code (run during execution)

| Control | Location |
|---|---|
| Fit policy constant | `STAMP_INTEGRITY_FIT_POLICY` |
| In-field QR + caption slots | `planIntegrityMarkSlots` |
| Slot containment + square QR | `assertIntegritySlotsFitField` |
| Content vs slots disjoint | `assertDetailsAvoidIntegritySlots` (skipped test until planner execution; **unskip as the merge gate**) |
| Stacked-field non-collision | `pdfStampGeometry.test.ts` — caption/QR vs stamp below |
| Aspect-preserving contain | existing `containRect` test + ratio assertion |

Execution sequence: planner reserves columns **inside** original rect → unskip overlap gate → finalize draws slots only → preview match → `npm run test` + type-check.

## Objective

One layout contract for every signature field:

```text
┌─────────────────────────────────────────────────────────┐
│ ink (contain) │ status / name / date     │ QR (square) │
├─────────────────────────────────────────────────────────┤
│ Scan or click to verify document authenticity           │  ← inside card
└─────────────────────────────────────────────────────────┘
```

- No child may occupy another child’s box.
- Caption never leaves the card (stacked stamps stay independent).
- Ink uses `contain` (no stretch, no 1.05 boost overflow).
- Preview and PDF use the same mode rules (`full` / `compact` / `narrow`+).
- Crypto, verify URL, URI link on the stamp, and integrity hashing stay as today.

## Layout contract (planner)

Extend `SignatureStampLayout` with:

```ts
qrBox: { x, y, width, height } | null   // square, inside card
verifyRow: { x, y, width, height, text } | null
detailMaxWidth  // must exclude qrBox + gaps
```

Column split (PDF points, analogous to CSS `minmax`):

```text
full:     ink minmax(48, 30%) | details 1fr | QR clamp(18, 16%, 36)
compact:  ink ~28% | details 1fr | QR clamp(16, 14%, 28)
micro:    ink compact | SIGNED + name + date | QR ≥ 16 if scannable else omit QR, keep URI
```

Footer row: `verifyRow.height ≈ max(8, font*1.3)` taken from the **bottom of the card** before placing timestamp. Timestamp `maxWidth` = details column only, wrap to two lines (`Aug 04, 2026` / `01:44:46 PM GMT+8`) when `approxTextWidth > detailMaxWidth`.

Modes (reuse existing `pickPreferredMode`; do not add a new React component type unless preview needs it):

| Mode | When | QR | Caption |
|---|---|---|---|
| full | ≥ ~260×70 pt | yes | full sentence |
| compact | ≥ ~150×60 pt | yes | shorter or wrap |
| micro (`narrow`/`slim`/`banner`) | smaller | yes if ≥ 16 pt else omit | hide; URI + tooltip/ARIA in preview |

## Draw path

1. **Sign time** (`drawSignatureBlock`): lay out ink/status/date **above** `verifyRow` and **left of** `qrBox`. Leave QR box empty (verification code does not exist yet).
2. **Finalize** (`applyContentIntegrityAndVerifyMarks`): call the **same** `planSignatureStampLayout(pdfRect, …)` and draw QR into `qrBox`, caption into `verifyRow`. Keep `addUriLink` on the full card.
3. Stop using `pdfRect.y - 8` and bottom-right field heuristics.

Keep client/edge geometry files in sync (existing comment already requires this).

## Preview (HTML)

Refactor `EdocSignatureStampPreview` to the three-column + footer structure from the prompt (`esignature-main` + `esignature-verification`). Container queries already exist — add a QR column (placeholder or generated URL when available) and a reserved footer. `object-fit: contain` on ink; `min-width: 0` on details; no absolute positioning for timestamp/QR.

Placement editor still sizes the **field rectangle**; the stamp fills 100% of that box.

## Out of scope

- Changing verification_code / hash algorithms
- Redesigning stamp colors/brand
- Auto-growing fields on the page (fields stay owner-placed; planner fits **inside** the rect)
- PAdES / TSA

## Acceptance (from prompt, mapped to this codebase)

Must not occur:

- Timestamp overlaps QR
- Caption crosses card border or next stamp
- Ink stretched; name under QR; QR clipped
- Horizontal overflow; stacked cards colliding
- Preview layout ≠ PDF layout for the same field size

Tests (extend `pdfStampGeometry.test.ts`):

- For boxes `180×70`, `220×80`, `280×90`, `320×100`, `390×100`, `450×120` (CSS px ≈ pt at planner scale): `qrBox` disjoint from timestamp/name; `verifyRow` inside `card`.
- Long name / long timestamp wrap or ellipsize inside `detailMaxWidth`.
- Three stacked rects: lower card.y ≥ upper `verifyRow` top (no shared pixels).
- Existing stamp-mode tests still pass.

Manual: three stacked signatures on Final Signed PDF; scan QR; click stamp URI; placement preview at small/large field sizes.

## Implementation order

1. Planner: reserve `qrBox` + `verifyRow`; wrap timestamp; remove `STAMP_SIGNATURE_DRAW_BOOST` overflow.
2. `drawSignatureBlock`: honor reserved boxes.
3. Finalize overlay: draw into reserved boxes only (`planIntegrityMarkSlots`). Delete `field.y - 8`. Unskip `assertDetailsAvoidIntegritySlots` test.
4. Preview CSS/HTML match.
5. Tests + smoke stacked PDF. `274×88` must stay `adjusted === false`.

## Files to change

- `src/features/edoc/pdfStampGeometry.ts` (+ tests)
- `supabase/functions/_shared/edocStampGeometry.ts`
- `supabase/functions/_shared/edocPdfStamp.ts`
- `supabase/functions/_shared/edocIntegrityFinalize.ts`
- `src/components/edoc/EdocSignatureStampPreview.tsx`
- `src/styles/globals.css` (`.esignature-stamp*`)

Do not edit `graphify-out/` or `sqlite-out/` by hand. No schema change expected.
