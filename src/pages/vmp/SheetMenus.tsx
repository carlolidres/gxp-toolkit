type MenuItem = { label: string; command?: string; children?: MenuItem[]; disabled?: boolean }

const FILE_MENU: MenuItem[] = [
  { label: 'Import CSV', command: 'import-csv' },
  { label: 'Download CSV', command: 'export-csv' },
]

const EDIT_MENU: MenuItem[] = [
  { label: 'Undo', command: 'undo' },
  { label: 'Redo', command: 'redo' },
  { label: 'Cut', command: 'cut' },
  { label: 'Copy', command: 'copy' },
  { label: 'Paste', command: 'paste' },
  {
    label: 'Paste special',
    children: [
      { label: 'Values only', command: 'paste-values' },
      { label: 'Formulas', command: 'paste-formulas' },
      { label: 'Formats', command: 'paste-formats' },
    ],
  },
  { label: 'Find', command: 'find' },
  { label: 'Clear contents', command: 'clear' },
]

const VIEW_MENU: MenuItem[] = [
  { label: 'Freeze top row', command: 'freeze-row' },
  { label: 'Freeze first column', command: 'freeze-col' },
  { label: 'Unfreeze', command: 'unfreeze' },
  { label: 'Gridlines', command: 'gridlines' },
  { label: 'Headings', command: 'headings' },
  { label: 'Formula bar', command: 'formula-bar' },
  { label: 'Zoom 100%', command: 'zoom-100' },
]

const INSERT_MENU: MenuItem[] = [
  {
    label: 'Rows',
    children: [
      { label: 'Insert row above', command: 'insert-row-above' },
      { label: 'Insert row below', command: 'insert-row-below' },
    ],
  },
  {
    label: 'Columns',
    children: [
      { label: 'Insert column left', command: 'insert-col-left' },
      { label: 'Insert column right', command: 'insert-col-right' },
    ],
  },
  { label: 'Sheet', command: 'add-sheet' },
  {
    label: 'Function',
    children: [
      { label: 'SUM', command: 'fn-SUM' },
      { label: 'AVERAGE', command: 'fn-AVERAGE' },
      { label: 'MIN', command: 'fn-MIN' },
      { label: 'MAX', command: 'fn-MAX' },
      { label: 'COUNT', command: 'fn-COUNT' },
      { label: 'ROUND', command: 'fn-ROUND' },
    ],
  },
  { label: 'Link', command: 'link' },
  { label: 'Checkbox', command: 'checkbox' },
  { label: 'Dropdown', command: 'dropdown' },
  { label: 'Emoji', command: 'emoji' },
  { label: 'Chart', command: 'chart' },
  { label: 'Pivot table', command: 'pivot' },
  { label: 'Image', command: 'image' },
  { label: 'Comment', command: 'comment' },
  { label: 'Note', command: 'note' },
]

const FORMAT_MENU: MenuItem[] = [
  {
    label: 'Number',
    children: [
      { label: 'General', command: 'format-general' },
      { label: 'Number', command: 'format-number' },
      { label: 'Percent', command: 'format-percent' },
      { label: 'Text', command: 'format-text' },
    ],
  },
  {
    label: 'Text',
    children: [
      { label: 'Bold', command: 'bold' },
      { label: 'Italic', command: 'italic' },
      { label: 'Underline', command: 'underline' },
      { label: 'Font color', command: 'font-color-ask' },
    ],
  },
  {
    label: 'Alignment',
    children: [
      { label: 'Left', command: 'align-left' },
      { label: 'Center', command: 'align-center' },
      { label: 'Right', command: 'align-right' },
    ],
  },
  {
    label: 'Wrapping',
    children: [
      { label: 'Wrap', command: 'wrap' },
      { label: 'Clip', command: 'clip' },
    ],
  },
  {
    label: 'Rotation',
    children: [
      { label: 'None', command: 'rotate-0' },
      { label: 'Rotate 90°', command: 'rotate-90' },
    ],
  },
  {
    label: 'Font size',
    children: [
      { label: '10', command: 'font-10' },
      { label: '12', command: 'font-12' },
      { label: '14', command: 'font-14' },
      { label: '18', command: 'font-18' },
    ],
  },
  { label: 'Merge cells', command: 'merge' },
  { label: 'Unmerge cells', command: 'unmerge' },
  { label: 'Convert to table', command: 'table' },
  { label: 'Conditional formatting', command: 'conditional' },
  { label: 'Alternating colors', command: 'band' },
  { label: 'Clear formatting', command: 'clear-formats' },
]

const DATA_MENU: MenuItem[] = [
  {
    label: 'Sort sheet',
    children: [
      { label: 'Sort A to Z', command: 'sort-sheet-asc' },
      { label: 'Sort Z to A', command: 'sort-sheet-desc' },
    ],
  },
  {
    label: 'Sort range',
    children: [
      { label: 'Sort A to Z', command: 'sort-range-asc' },
      { label: 'Sort Z to A', command: 'sort-range-desc' },
    ],
  },
  { label: 'Create a filter', command: 'filter-create' },
  { label: 'Create group by view', command: 'group-by' },
  { label: 'Create filter view', command: 'filter-view-save' },
  { label: 'Add a slicer', command: 'slicer' },
  { label: 'Protect sheets and ranges', command: 'protect-range' },
  { label: 'Named ranges', command: 'named-range' },
  { label: 'Named functions', command: 'named-function' },
  { label: 'Column stats', command: 'column-stats' },
  { label: 'Data validation', command: 'dropdown' },
  {
    label: 'Data cleanup',
    children: [
      { label: 'Trim whitespace', command: 'trim' },
      { label: 'Remove duplicates', command: 'dedupe' },
    ],
  },
  { label: 'Split text to columns', command: 'split' },
  { label: 'Data extraction', command: 'extract' },
  { label: 'Randomize range', command: 'shuffle' },
]

const MENUS = [
  ['File', FILE_MENU],
  ['Edit', EDIT_MENU],
  ['View', VIEW_MENU],
  ['Insert', INSERT_MENU],
  ['Format', FORMAT_MENU],
  ['Data', DATA_MENU],
] as const

export const CELL_MENU: MenuItem[] = [
  { label: 'Cut', command: 'cut' },
  { label: 'Copy', command: 'copy' },
  { label: 'Paste', command: 'paste' },
  {
    label: 'Paste special',
    children: [
      { label: 'Values only', command: 'paste-values' },
      { label: 'Formulas', command: 'paste-formulas' },
      { label: 'Formats', command: 'paste-formats' },
    ],
  },
  {
    label: 'Insert',
    children: [
      { label: 'Row above', command: 'insert-row-above' },
      { label: 'Row below', command: 'insert-row-below' },
      { label: 'Column left', command: 'insert-col-left' },
      { label: 'Column right', command: 'insert-col-right' },
    ],
  },
  {
    label: 'Delete',
    children: [
      { label: 'Delete row', command: 'delete-row' },
      { label: 'Delete column', command: 'delete-col' },
    ],
  },
  { label: 'Clear contents', command: 'clear' },
  {
    label: 'Filter',
    children: [
      { label: 'Clear Filter', command: 'clear-filter' },
      { label: 'Reapply', command: 'filter-reapply' },
      { label: "Filter by Selected Cell's Value", command: 'filter' },
      { label: "Filter by Selected Cell's Color", command: 'filter-fill' },
      { label: "Filter by Selected Cell's Font Color", command: 'filter-font' },
    ],
  },
  {
    label: 'Sort',
    children: [
      { label: 'Sort A to Z', command: 'sort-asc' },
      { label: 'Sort Z to A', command: 'sort-desc' },
      { label: 'Put Selected Cell Color On Top', command: 'sort-color' },
      { label: 'Put Selected Font Color On Top', command: 'sort-font' },
      { label: 'Custom Sort', command: 'sort-custom' },
    ],
  },
  { label: 'New Comment', command: 'comment' },
  { label: 'New Note', command: 'note' },
  {
    label: 'Format Cells',
    children: [
      { label: 'Bold', command: 'bold' },
      { label: 'Italic', command: 'italic' },
      { label: 'Underline', command: 'underline' },
      { label: 'Number', command: 'format-number' },
      { label: 'Text', command: 'format-text' },
      { label: 'Percent', command: 'format-percent' },
    ],
  },
  { label: 'Link', command: 'link' },
  { label: 'Link to this Range', command: 'link-range' },
]

export function SheetMenuBar({
  readOnly,
  openMenu,
  savedViews,
  canMerge,
  canUnmerge,
  onOpen,
  onCommand,
}: {
  readOnly: boolean
  openMenu: string | null
  savedViews: string[]
  canMerge: boolean
  canUnmerge: boolean
  onOpen: (name: string | null) => void
  onCommand: (command: string) => void
}) {
  return (
    <div className="eq-app-menus" role="menubar" aria-label="Spreadsheet menus">
      {MENUS.map(([name, items]) => (
        <div key={name}>
          <button
            type="button"
            role="menuitem"
            aria-expanded={openMenu === name}
            className={openMenu === name ? 'is-open' : ''}
            onClick={() => onOpen(openMenu === name ? null : name)}
          >
            {name}
          </button>
          {openMenu === name ? (
            <div className="eq-drop" role="menu">
              <MenuList
                items={withMergeState(name === 'Data' ? withViews(items, savedViews) : items, canMerge, canUnmerge)}
                readOnly={readOnly}
                onCommand={onCommand}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function CellContextMenu({
  x,
  y,
  readOnly,
  onCommand,
}: {
  x: number
  y: number
  readOnly: boolean
  onCommand: (command: string) => void
}) {
  return (
    <div className="eq-menu eq-drop eq-cell-menu" style={{ left: x, top: y }} role="menu" onMouseDown={(event) => event.stopPropagation()}>
      <MenuList items={CELL_MENU} readOnly={readOnly} onCommand={onCommand} />
    </div>
  )
}

function withViews(items: MenuItem[], savedViews: string[]): MenuItem[] {
  if (!savedViews.length) return items
  return [
    ...items,
    {
      label: 'Filter views',
      children: savedViews.map((name) => ({ label: name, command: `filter-view:${name}` })),
    },
  ]
}

function withMergeState(items: MenuItem[], canMerge: boolean, canUnmerge: boolean): MenuItem[] {
  return items.map((item) => {
    const next = item.children ? { ...item, children: withMergeState(item.children, canMerge, canUnmerge) } : item
    if (next.command === 'merge') return { ...next, disabled: !canMerge }
    if (next.command === 'unmerge') return { ...next, disabled: !canUnmerge }
    return next
  })
}

function MenuList({ items, readOnly, onCommand }: { items: MenuItem[]; readOnly: boolean; onCommand: (command: string) => void }) {
  return (
    <>
      {items.map((item) => {
        const locked = Boolean(readOnly && item.command && item.command !== 'copy' && item.command !== 'find' && item.command !== 'export-csv' && item.command !== 'column-stats' && item.command !== 'link-range' && item.command !== 'undo' && item.command !== 'redo')
        const disabled = Boolean(item.disabled || locked)
        return (
          <div key={item.label} className="eq-drop-item">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (item.command && !disabled) onCommand(item.command)
              }}
            >
              <span>{item.label}</span>
              {item.children ? <span aria-hidden="true">›</span> : null}
            </button>
            {item.children ? (
              <div className="eq-drop eq-sub" role="menu">
                <MenuList items={item.children} readOnly={readOnly} onCommand={onCommand} />
              </div>
            ) : null}
          </div>
        )
      })}
    </>
  )
}
