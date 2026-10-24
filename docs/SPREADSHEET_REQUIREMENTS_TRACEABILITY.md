# Spreadsheet requirements traceability

Source: `reference/APQR_CPV_EXCEL_FEATURE_REQUIREMENTS.md` (FR-APQR-CPV-SPREADSHEET-001).

Surface: `EquipmentSpreadsheet`, used by every CPV product-profile section (Raw Material, Packaging Material, In-process Control, Analytical Report, Stability, Holding-Time, Other Data, Deviation Report, Product Complaints). The product list at `#/cpv/products` is the record table.

Status values: Implemented, Partial, Missing, Blocked.

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| XL-001 | Workbook, sheets, cells, selection | P0 | Implemented | Existing grid plus ribbon, formula bar, and name box |
| XL-002 | Undo and redo | P0 | Implemented | Ctrl+Z / Ctrl+Y, in-session |
| XL-003 | Formula bar and Name Box | P0 | Implemented | Enter commits; name box accepts A1 and A1:C10 |
| XL-004 | Bold, italic, underline, align, wrap, fill, number formats | P0 | Implemented | Home ribbon. Percent and number change what is shown. The stored cell text stays the same |
| XL-005 | Clear contents and clear formats | P0 | Implemented | Ribbon and cell menu |
| XL-006 | Sort entire rows | P0 | Implemented | A to Z and Z to A. Numeric collation. Stored text is unchanged |
| XL-007 | Filter by value | P0 | Partial | Filters the column to the selected cell’s displayed value and hides other rows. No per-value checkbox list |
| XL-008 | Find | P0 | Implemented | Ctrl+F, find next, match case |
| XL-009 | Freeze panes | P0 | Partial | Freeze top row, freeze first column, unfreeze |
| XL-010 | Gridlines, headings, formula bar, zoom | P0 | Implemented | View tab. Zoom is 80, 100, 125 |
| XL-011 | CSV import and export | P0 | Implemented | Import prefixes `=`, `+`, `-`, and `@` so they stay text. No XLSX library is installed |
| XL-012 | Text to Columns | P1 | Partial | Splits the selection on a comma |
| XL-013 | AutoSum, ROUND, ABS | P1 | Partial | AutoSum writes SUM. Formula bar accepts ROUND and ABS. No function wizard |
| XL-014 | Status bar count, sum, average | P0 | Implemented | Footer. Leading-zero text is counted and not summed |
| XL-015 | Cell notes and http(s) links | P1 | Partial | Insert tab. Ctrl+click opens a link. Notes are single text, not a thread |
| XL-016 | Cell context menu | P0 | Implemented | Copy, cut, paste, clear, sort, filter, link to this cell |
| XL-017 | Sheet tab menu | P0 | Implemented | Insert, delete, rename, move or copy, protect, tab color, hide, unhide, select all, link |
| XL-018 | Protection enforced on edit | P0 | Implemented | Locked sheets reject the blocked action |
| XL-019 | Apostrophe text prefix | P0 | Implemented | A leading apostrophe is stored and hidden on display |
| XL-020 | Autofit column | P1 | Partial | Double-click the column border |
| XL-021 | Paste values and formulas | P0 | Partial | Paste writes the clipboard text, including formulas that start with `=` |
| XL-022 | XLSX import/export | P1 | Blocked | No spreadsheet file library is installed |
| XL-023 | Pivot tables, charts, slicers, sparklines, SmartArt, VBA | P2 | Missing | Not shown as buttons |
| XL-024 | Conditional formatting, data validation, tables, print | P2 | Missing | Not shown as buttons |
| XL-025 | View Code | P1 | Implemented | States that this workbook has no script editor |

## Google Sheets toolbar (TB-001–TB-032)

Verified by workbook unit tests for currency display, leading-zero identifiers, and STDEV.S. Toolbar click-through in the browser is NOT_RUN.

| ID | Status | Notes |
|---|---|---|
| TB-001 | Implemented | Search field lists commands and runs the chosen one |
| TB-002 | Implemented | Undo, Ctrl+Z. In-session only |
| TB-003 | Implemented | Redo, Ctrl+Y and Ctrl+Shift+Z |
| TB-004 | Partial | Print dialog sets scope, paper, orientation, margin, and a repeated header row, then opens the browser print dialog. No live page-preview canvas |
| TB-005 | Implemented | Paint format copies the active cell’s format. Double-click keeps it on until Escape |
| TB-006 | Implemented | 50% through 200%, plus a custom value in that range |
| TB-007 | Implemented | Currency display. Symbol can be changed. Stored number stays the same |
| TB-008 | Implemented | Percent display. Stored number stays the same |
| TB-009 | Implemented | Decrease decimal places on the display |
| TB-010 | Implemented | Increase decimal places on the display |
| TB-011 | Partial | General, number, text, currency, percent, date, time, and scientific. No custom format string. Leading-zero identifiers stay text |
| TB-012 | Implemented | Searchable font list of fonts installed with the operating system |
| TB-013 | Implemented | Decrease font size |
| TB-014 | Implemented | Font size list |
| TB-015 | Implemented | Increase font size |
| TB-016 | Implemented | Bold, Ctrl+B |
| TB-017 | Implemented | Italic, Ctrl+I |
| TB-018 | Implemented | Strikethrough |
| TB-019 | Implemented | Text color palette and custom color |
| TB-020 | Implemented | Fill palette, custom color, and no fill |
| TB-021 | Implemented | All, outer, inner, side, none, dashed, and dotted borders |
| TB-022 | Implemented | Merge cells is enabled for a multi-cell selection with no merge. Unmerge cells is enabled when the selection contains a merge. Merging keeps the top-left value and its formatting, warns, then discards other values. Unmerge keeps the remaining value and formatting |
| TB-023 | Implemented | Left, center, right |
| TB-024 | Implemented | Top, middle, bottom |
| TB-025 | Partial | Overflow, wrap, and clip. Wrap does not grow the row by itself |
| TB-026 | Implemented | Up, down, vertical, none, and a typed angle |
| TB-027 | Partial | Add and open an http(s) link. Removing it is a blank link prompt |
| TB-028 | Partial | Comment text, replies, resolve, and a timestamp. No signed-in author name |
| TB-029 | Partial | Bar, column, line, scatter, and histogram drawing of the selected numbers, plus CSV export. The chart is a panel, not a floating object bound to later edits |
| TB-030 | Partial | Creates a value filter. Color filter is on the cell menu |
| TB-031 | Partial | Dropdown and formula-bar suggestions insert SUM, AVERAGE, COUNT, COUNTA, MIN, MAX, ABS, ROUND, STDEV.S, and VAR.S. IF, XLOOKUP, and the other listed functions are not in the formula engine |
| TB-032 | Implemented | Hide toolbar and Show toolbar. Selection is unchanged |
| XLSX | Blocked | No spreadsheet-file library is installed. CSV import and export remain available |

