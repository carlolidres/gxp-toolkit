# Spreadsheet optimization report

Date: 2026-10-26

No performance change is retained. One scroll experiment was measured, made frame intervals slower, and was reverted. Formula evaluation, undo history, and storage were left as they are because the baseline did not show those as the growing cost.

## Comparison

These columns are the baseline run and the same benchmark after the CSS-variable scroll experiment. The experiment was reverted, so the running code matches the Before column. The After column is evidence for that revert, not a shipped speedup.

| Operation | Before (small median) | After experiment (small median) | Improvement | Regression |
|---|---|---|---|---|
| Cell selection | 140.6ms | 141.4ms | none | No |
| Editing | 145.9ms | 142.0ms | none measured as a change | No |
| Scrolling | vertical frame 50ms; horizontal frame 50ms; long task max 247ms | vertical frame 83.3ms; horizontal frame 116.7ms; long task max 304ms | none | Yes |
| Workbook loading | open median 88ms; reload median 2565ms | open median 80ms; reload median 2267ms | within run noise | No |
| Worksheet switching | 172.7ms | 73.8ms | not attributed; the experiment did not change sheet switching | No |
| Saving | 578.7ms, including the 400ms debounce | 563.7ms | none | No |

Medium and large scroll medians also moved the wrong way under the experiment: medium vertical frames 50ms to 66.7ms, large horizontal frames 83.3ms to 133.3ms. Scroll commits stayed in the same range (small 28 then 25, medium 30 then 34, large 35 then 32). DOM cell count stayed 468.

## What was investigated

The custom grid already virtualizes. `visibleIndexes` paints only the viewport plus a buffer. `offsetAt` walks resized rows and columns, not all 1,048,576 rows. The baseline confirms that: 5,000 stored cells paint the same 468 cells as the small book.

Wheel handling coalesces to one animation frame and then calls `setScroll`. That commit re-renders the toolbar and every visible cell. The baseline recorded 28–35 of those commits in a 40-wheel burst, with long tasks up to 294ms.

Selection is one commit, median 106–198ms depending on size. That is one render of the same 468 cells, not a loop of commits.

Undo stores a full workbook snapshot, capped at 40. Heap did not climb with the large fixture in a way that isolated those snapshots (large used 81.4MB, medium used 97.4MB). The history depth and the JSON shape were not changed.

`displayCell` evaluates a formula when that cell is painted. The large book has one formula. Its recalc median was 68ms versus 76.8ms on the medium book, so unrelated formulas are not being walked across the extra 5,000 values. Dollar absolute references such as `=$A$1` currently display `#ERROR!` because `$` is not accepted by the tokenizer. Cross-sheet references are not implemented. Neither behavior was changed.

`saveProductSectionWorkbook` writes one `localStorage` key, `gxp.cpv.product-profile.v1`, after a 400ms debounce. Save medians were 544–579ms. That is not a multi-second main-thread stall. IndexedDB was not introduced, and no stored product record was migrated or deleted.

## Experiment that was reverted

Scroll offset was written to CSS variables, and React state updated only when the visible row or column window changed. The same benchmark was run again. Median frame intervals got slower, and the horizontal long-task maximum on the small book rose from 247ms to 304ms. The 240px wheel step used by the benchmark moves the visible window every step, so the React commit still happened, and the extra DOM style writes made the frame worse. The change was removed.

After the revert, `tests/e2e/spreadsheet-accuracy.spec.ts` passed: row resize, vertical and horizontal wheel, zoom 150%, freeze top row, Data/Notes switching, and name-box navigation to `XFD1048576`. `tests/e2e/spreadsheet-toolbar.spec.ts` passed: edit, center, fill `#e53935`, save, reload, and a decoy `REAL-PRODUCT` key left untouched in that Playwright profile.

The retained-code benchmark was not run a third time. The scroll path after the revert is the path that produced the Before column.

## Tests

| Check | Result |
|---|---|
| `npm run test:spreadsheet` | 24 passed |
| Fixture edit, center, fill, save, reload | passed |
| Scroll, zoom, freeze, resize, sheet switch, `XFD1048576` | passed |
| Browser benchmark, three sizes | passed; numbers in `SPREADSHEET_PERFORMANCE_BASELINE.md` |
| `npm run e2e` (eDoc nav only) | not run in this pass |

`npm run test:spreadsheet:e2e` uses `playwright.spreadsheet.config.ts` on port 4177. The default `npm run e2e` match is still only `edoc-nav.spec.ts`.

## Files touched

- `src/features/cpv/spreadsheetTestFixture.ts`
- `src/features/cpv/productProfileWorkbook.ts`
- `src/features/cpv/productProfileWorkbook.test.ts`
- `src/features/apqr/apqrService.ts`
- `src/features/vmp/equipmentWorkbook.test.ts`
- `src/pages/vmp/EquipmentSpreadsheet.tsx` (test-only commit counter and `data-address`, active only when `VITE_SPREADSHEET_FIXTURE=true`)
- `src/vite-env.d.ts`
- `.env.example`
- `package.json`
- `playwright.spreadsheet.config.ts`
- `tests/e2e/spreadsheet-toolbar.spec.ts`
- `tests/e2e/spreadsheet-accuracy.spec.ts`
- `tests/e2e/spreadsheet-benchmark.spec.ts`
- `SPREADSHEET_PERFORMANCE_BASELINE.md`
- `SPREADSHEET_OPTIMIZATION_REPORT.md`
- `agent-workflow/HANDOFF.md`

## Remaining bottlenecks

1. Scrolling still re-renders the visible grid about once per wheel step. Long tasks reached 294ms and frame-interval p95 reached 316.7ms. A CSS-variable bypass was not faster on this benchmark.
2. Cold open p95 is 2.2–2.7s and reload median is 2.3–2.9s. Warm opens are about 90–100ms.
3. A cell edit or selection is one commit of the whole visible grid, about 100–200ms median.
4. Save time is dominated by the existing 400ms debounce plus a short `localStorage` write.

## Recommended next step

Record one scroll commit in the React profiler and split out only the subtree that the trace shows is expensive. Do not skip React renders for scrolling again unless that trace shows script time, rather than layout of the visible cells, is the long task. Leave formula evaluation, undo snapshots, and `localStorage` in place until a workbook with many formulas, or a save that blocks input, is measured.
