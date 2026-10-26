# Spreadsheet performance baseline

Measured 2026-10-26 in Chromium through `tests/e2e/spreadsheet-benchmark.spec.ts` (`npm run test:spreadsheet:e2e`).

The page was the Vite dev server at `http://127.0.0.1:4177` with `VITE_SPREADSHEET_FIXTURE=true`, Supabase disabled, and CPV enabled. The only product was `ZZ-SHEET-FIXTURE`. Nothing was written to a real user's product workbook. The browser profile was Playwright's, not the desktop profile.

Workbook sizes:

| Size | Stored cells | Sheets |
|---|---|---|
| Small | A1=`2`, A2=`3`, A3=`=SUM(A1:A2)`, plus Notes!A1 | Data, Notes |
| Medium | Those three cells plus 500 values | Data, Notes |
| Large | Those three cells plus 5,000 values | Data, Notes |

Samples: 5 for the small book, 3 for medium and large, except reload which is 3 for every size. Frame samples are the animation frames captured during one 20-step wheel burst. Median and 95th percentile use the nearest rank method.

Timings are milliseconds inside the page (`performance.now`), except load and reload, which are Playwright navigation times. The dev server runs React Strict Mode, so the first mount can run an effect twice. Selection and scroll commit counts below are later updates.

The browser does not expose a layout-recalculation counter. `layoutShiftCount` is the number of `layout-shift` entries observed during the wheel burst. `jsHeap` is `performance.memory` in this Chromium build. Long tasks are `PerformanceObserver` entries of type `longtask` during that burst.

## Results

### Small

| Measure | Median | p95 | n |
|---|---:|---:|---:|
| Open the profile | 88 | 2707 | 5 |
| Select a cell | 140.6 | 150.9 | 5 |
| Edit the formula bar and commit | 145.9 | 353.6 | 5 |
| Paste two cells | 99.5 | 226.1 | 5 |
| Recalculate `=SUM(A1:A2)` after editing A1 | 386.5 | 728.9 | 5 |
| Undo | 89.6 | 192.7 | 5 |
| Redo | 239.2 | 330.1 | 5 |
| Switch worksheet | 172.7 | 208.1 | 5 |
| Save, including the 400ms debounce | 578.7 | 664 | 5 |
| Reload until the toolbar is visible | 2565 | 3031 | 3 |
| Vertical frame interval | 50 | 233.3 | 33 |
| Horizontal frame interval | 50 | 266.5 | 35 |

Other small measurements: 468 `.eq-cell` nodes, 1,435 DOM nodes, JS heap used 64,000,000 of 148,000,000. Selection caused 1 React commit (median and p95). The wheel burst caused 28 scroll commits, 28 layout-shift entries, 12 vertical long tasks (max 200ms), and 19 horizontal long tasks (max 247ms).

### Medium

| Measure | Median | p95 | n |
|---|---:|---:|---:|
| Open the profile | 103 | 2179 | 3 |
| Select a cell | 197.7 | 227.1 | 3 |
| Edit the formula bar and commit | 202 | 492.6 | 3 |
| Paste two cells | 102.6 | 195.9 | 3 |
| Recalculate `=SUM(A1:A2)` after editing A1 | 76.8 | 274.6 | 3 |
| Undo | 73.6 | 141.8 | 3 |
| Redo | 54.2 | 234 | 3 |
| Switch worksheet | 35.5 | 62.9 | 3 |
| Save, including the 400ms debounce | 543.5 | 586.8 | 3 |
| Reload until the toolbar is visible | 2920 | 3202 | 3 |
| Vertical frame interval | 50 | 249.9 | 32 |
| Horizontal frame interval | 50 | 316.7 | 39 |

Other medium measurements: 468 `.eq-cell` nodes, 1,435 DOM nodes, JS heap used 97,400,000 of 148,000,000. Selection commits: median 1, p95 1. Scroll commits: 30. Layout-shift entries: 29. Vertical long tasks: 12, max 205ms. Horizontal long tasks: 27, max 294ms.

### Large

| Measure | Median | p95 | n |
|---|---:|---:|---:|
| Open the profile | 92 | 2439 | 3 |
| Select a cell | 106.1 | 130.4 | 3 |
| Edit the formula bar and commit | 199.9 | 360.1 | 3 |
| Paste two cells | 63.9 | 65.2 | 3 |
| Recalculate `=SUM(A1:A2)` after editing A1 | 68 | 267.6 | 3 |
| Undo | 56.5 | 136 | 3 |
| Redo | 117.5 | 254.8 | 3 |
| Switch worksheet | 60.9 | 68.4 | 3 |
| Save, including the 400ms debounce | 558.7 | 585.2 | 3 |
| Reload until the toolbar is visible | 2285 | 2298 | 3 |
| Vertical frame interval | 50 | 200.1 | 36 |
| Horizontal frame interval | 83.3 | 266.6 | 33 |

Other large measurements: 468 `.eq-cell` nodes, 1,435 DOM nodes, JS heap used 81,400,000 of 148,000,000. Selection commits: median 1, p95 1. Scroll commits: 35. Layout-shift entries: 35. Vertical long tasks: 11, max 181ms. Horizontal long tasks: 26, max 225ms.

## What the baseline shows

The painted grid does not grow with the stored cell count. Small, medium, and large all painted 468 cells and 1,435 DOM nodes. The scroll surface is the viewport. Name-box navigation to `XFD1048576` still reaches the last Excel row and column; that check is in `tests/e2e/spreadsheet-accuracy.spec.ts`, which passed after the scroll experiment was reverted.

Scroll is the expensive interaction. A 20-step wheel burst commits the sheet about once per step and records long tasks of 181–294ms. Frame intervals sit at a 50ms median on most axes, with a 95th percentile of 200–317ms.

Formula time does not grow from the medium book to the large book. The small book's first formula samples were slower (median 386.5ms, p95 728.9ms) than the later sizes. That run is recorded as measured; it is not evidence that a larger cell map recalculates more work, because the large book was faster.

Save stays near 544–579ms median. The profile page already waits 400ms before writing `localStorage`. The measurement includes that wait.

Heap used was 64MB, 97.4MB, and 81.4MB for small, medium, and large. The large book was not the largest heap sample.
