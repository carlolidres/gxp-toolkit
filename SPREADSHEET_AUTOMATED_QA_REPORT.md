# Spreadsheet automated QA report

Date: 2026-10-26

## Executive summary

Status: **INCOMPLETE**

The sheet is a custom DOM grid (`EquipmentSpreadsheet`), not Univer, ONLYOFFICE, or an XLSX editor. Product-profile workbooks are JSON in browser `localStorage` (`gxp.cpv.product-profile.v1`), one key per product and section.

| | Count |
|---|---|
| Executed automated tests | 22 unit + 1 browser attempt |
| Passed | 22 unit |
| Failed | 0 unit |
| Blocked | 1 browser test |
| Not executed | Browser coverage of the remaining sheet features; performance timings in a browser |

`npm run test:spreadsheet` passed: 19 tests in `src/features/vmp/equipmentWorkbook.test.ts` and 3 in `src/features/cpv/productProfileWorkbook.test.ts` (22 total, about 5.8s).

The browser test signed in and opened CPV Product Profile. The catalog count was 0, so no product name opened a sheet. That run is blocked, not a sheet-logic failure.

Critical risk: fill, alignment, formulas, and save behavior are covered by unit tests. They were not rechecked by clicking through a populated product sheet in this run.

## Feature inventory

| Feature | Source | Expected behavior | Testability | Priority | Automated coverage |
|---|---|---|---|---|---|
| Custom grid | `src/pages/vmp/EquipmentSpreadsheet.tsx` | Viewport paints visible cells only. Logical size is 1,048,576 by 16,384. | Unit for coordinates. Browser for paint. | High | Unit pass. Browser not executed. |
| Cell edit | same, formula bar | Type, double-click, Enter, and the formula bar write the cell. | Unit for values. Browser for focus. | High | Paste and value tests pass. Browser not executed. |
| Copy, cut, paste | same | Tab-separated paste fills a block. | Unit | High | Paste test passes. |
| Undo, redo | same | Restores the previous workbook, up to 40 steps. | Browser or component | Medium | Not executed. |
| Formulas | `src/features/vmp/equipmentWorkbook.ts` | SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, ABS, ROUND, STDEV, STDEV.S, VAR, VAR.S, and `+ - * /`. `$` is accepted on references. | Unit | High | SUM, percent, and currency display pass. The rest of the set was not executed in this run. |
| IF, AND, OR, VLOOKUP, XLOOKUP, INDEX, MATCH, CONCATENATE, date functions | — | — | — | — | **NOT IMPLEMENTED** |
| Autofill | — | — | — | — | **NOT IMPLEMENTED** |
| Fill color | toolbar swatch `fill-#rrggbb` | Selected cell keeps the fill. | Unit | High | Pass after DEF-001. |
| Alignment, wrap, rotation | `cellContentLayout` | Left, center, right, top, middle, bottom, wrap, clip, overflow, 90-degree text. | Unit | High | Layout assertions pass. Browser not executed. |
| Bold, italic, underline, font, text color, borders, decimals | `applyCellStyle`, `applyBorders` | Style is stored on the cell and painted. | Unit partial | Medium | Percent, currency, and merge styles pass. The other controls were not executed in this run. |
| Merge and unmerge | `mergeCells` | Keeps the top-left value. | Unit | High | Pass. |
| Rows and columns | insert, delete, resize | Insert shifts cells. Far sizes stay sparse. | Unit | High | Insert and sparse-size tests pass. |
| Hide row or column | — | — | — | — | **NOT IMPLEMENTED** |
| Worksheets | add, rename, copy, hide, delete, protect | At least one sheet stays visible. Formulas survive rename and copy. | Unit | High | Pass. |
| Freeze, zoom, filter, print, chart | spreadsheet commands | Freeze stores counts. Zoom is view state. Filter hides non-matching rows. Print and chart open a panel. | Browser | Medium | Not executed. |
| Save and reload | `productProfileWorkbook.ts` | Each product section is stored separately. A failed write keeps the sheet in the tab. | Unit | Critical | 3 persistence tests pass. |
| CSV | import and export | CSV import and download. | Unit partial | Medium | Import-as-text assertion passes. Browser download not executed. |
| XLSX file | — | — | — | — | **NOT IMPLEMENTED** |

## Feature coverage matrix

| Feature | Implemented | Automated test | Result | Defect |
|---|---|---|---|---|
| Cell editing | Yes | Partial | Pass for stored values | — |
| Copy and paste | Yes | Yes | Pass | — |
| Undo and redo | Yes | No | Not executed | — |
| Formulas | Partial | Partial | Pass for SUM and display formats | — |
| IF and lookup functions | No | — | Not implemented | — |
| Fill color | Yes | Yes | Pass | DEF-001 fixed |
| Alignment and wrap | Yes | Yes | Pass | — |
| Other formatting | Yes | Partial | Not executed in the browser | — |
| Merge | Yes | Yes | Pass | — |
| Rows, columns, sheets | Yes | Yes | Pass | — |
| Hide rows or columns | No | — | Not implemented | — |
| Scrolling | Yes | Unit bound only | Pass under 500ms for 2,000 lookups | Browser FPS not measured |
| Persistence | Yes | Yes | Pass | — |
| Browser toolbar | Yes | Attempted | Blocked | Empty catalog |
| Performance in the browser | — | No | Not executed | — |

## Defect log

### DEF-001 — Fill color hidden on the selected cell

- Severity: **HIGH**
- Component: `EquipmentSpreadsheet` cell paint
- Steps: Select a cell. Open Fill color. Click the `#e53935` swatch.
- Expected: The cell background becomes `rgb(229, 57, 53)` while it stays selected.
- Actual: The selection paint cleared the fill, so the cell stayed the selection color.
- Cause: `background` was omitted whenever the cell was inside the selection. `.eq-cell.is-selected` and `.eq-cell.is-active` then painted their own backgrounds.
- Fix: `paintedFill` always returns the stored fill. A selected cell also keeps an inset ring so the selection is still visible.
- Verification: `keeps a fill color on a selected cell` passed in `npm run test:spreadsheet`. Browser click-through of this swatch was not completed.

## Performance

No browser timings were recorded. No before-and-after frame rate, memory, or long-task numbers are claimed.

The existing unit check that 2,000 viewport lookups finish in under 500ms passed inside the workbook file. That is a logic bound, not a browser frame rate.

## Browser test

`tests/e2e/spreadsheet-toolbar.spec.ts` signs in, opens the first product, centers the text, and applies `#e53935`.

Executed once with Playwright Chromium. Result: **blocked**. The product list loaded with 0 products (`No APQR products match`), so the sheet never opened. The default Playwright match is still only `edoc-nav.spec.ts`, so this blocked case does not fail `npm run e2e`.

## Commands

```text
npm run test:spreadsheet
npm test
npm run e2e
```

`npm test` is the full Vitest run and is already what the GitHub Pages workflow runs. `test:spreadsheet` is the sheet regression slice. There is no separate performance script. Browser frame-rate measurement was not run.

## Final assessment

**INCOMPLETE.** The sheet unit regression passed, and the fill-color defect is fixed at the paint rule. A populated product sheet was not clicked through in the browser, so this run is not evidence that every toolbar control works on screen.
