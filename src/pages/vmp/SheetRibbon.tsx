import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  Bold,
  ChevronDown,
  DollarSign,
  Filter,
  Grid2x2,
  Italic,
  Link2,
  Minus,
  Paintbrush,
  PaintBucket,
  Percent,
  Plus,
  Printer,
  Redo2,
  RotateCw,
  Search,
  Strikethrough,
  TableCellsMerge,
  Undo2,
  WrapText,
} from 'lucide-react'
import type { CellStyle } from '../../features/vmp/equipmentWorkbook'

export const TOOL_COMMANDS: Array<{ id: string; label: string; keys?: string }> = [
  { id: 'undo', label: 'Undo', keys: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo', keys: 'Ctrl+Y' },
  { id: 'print', label: 'Print' },
  { id: 'paint', label: 'Paint format' },
  { id: 'zoom-100', label: 'Zoom 100%' },
  { id: 'format-currency', label: 'Currency' },
  { id: 'format-percent', label: 'Percent' },
  { id: 'decimals-dec', label: 'Decrease decimals' },
  { id: 'decimals-inc', label: 'Increase decimals' },
  { id: 'format-general', label: 'Number format General' },
  { id: 'format-number', label: 'Number' },
  { id: 'format-text', label: 'Plain text' },
  { id: 'format-date', label: 'Date' },
  { id: 'format-time', label: 'Time' },
  { id: 'format-scientific', label: 'Scientific' },
  { id: 'bold', label: 'Bold', keys: 'Ctrl+B' },
  { id: 'italic', label: 'Italic', keys: 'Ctrl+I' },
  { id: 'strike', label: 'Strikethrough' },
  { id: 'font-dec', label: 'Decrease font size' },
  { id: 'font-inc', label: 'Increase font size' },
  { id: 'border-all', label: 'All borders' },
  { id: 'border-outer', label: 'Outer borders' },
  { id: 'border-none', label: 'No borders' },
  { id: 'merge-all', label: 'Merge all' },
  { id: 'unmerge', label: 'Unmerge' },
  { id: 'align-left', label: 'Align left' },
  { id: 'align-center', label: 'Align center' },
  { id: 'align-right', label: 'Align right' },
  { id: 'valign-top', label: 'Align top' },
  { id: 'valign-middle', label: 'Align middle' },
  { id: 'valign-bottom', label: 'Align bottom' },
  { id: 'wrap-wrap', label: 'Wrap' },
  { id: 'wrap-clip', label: 'Clip' },
  { id: 'wrap-overflow', label: 'Overflow' },
  { id: 'rotate-up', label: 'Rotate up' },
  { id: 'rotate-down', label: 'Rotate down' },
  { id: 'link', label: 'Insert link' },
  { id: 'comment', label: 'Add comment' },
  { id: 'chart', label: 'Insert chart' },
  { id: 'filter-create', label: 'Create a filter' },
  { id: 'fn-SUM', label: 'SUM' },
  { id: 'fn-AVERAGE', label: 'AVERAGE' },
  { id: 'fn-COUNT', label: 'COUNT' },
  { id: 'fn-MIN', label: 'MIN' },
  { id: 'fn-MAX', label: 'MAX' },
  { id: 'fn-ROUND', label: 'ROUND' },
  { id: 'fn-STDEV.S', label: 'STDEV.S' },
]

const FONTS = ['Arial', 'Calibri', 'Verdana', 'Tahoma', 'Times New Roman', 'Georgia', 'Courier New']
const SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 36]
const ZOOMS = [50, 75, 90, 100, 125, 150, 200]
const COLORS = ['#000000', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#ffffff', '#f4f6f8', '#fff2cc']

export function SheetRibbon({
  readOnly,
  zoom,
  active,
  canMerge,
  canMergeHorizontal,
  canMergeVertical,
  canUnmerge,
  onCommand,
}: {
  readOnly: boolean
  zoom: number
  active?: CellStyle
  canMerge: boolean
  canMergeHorizontal: boolean
  canMergeVertical: boolean
  canUnmerge: boolean
  onCommand: (command: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [fontQuery, setFontQuery] = useState('')
  const [textColor, setTextColor] = useState('#000000')
  const [fillColor, setFillColor] = useState('#fff2cc')
  const root = useRef<HTMLDivElement>(null)
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return TOOL_COMMANDS
    return TOOL_COMMANDS.filter((item) => item.label.toLowerCase().includes(needle))
  }, [query])

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      const target = event.target
      if (target instanceof Element && root.current?.contains(target)) return
      setOpen(null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function run(command: string) {
    if (command.startsWith('color-')) setTextColor(command.slice(6))
    if (command.startsWith('fill-') && command !== 'fill-none') setFillColor(command.slice(5))
    setOpen(null)
    onCommand(command)
  }

  if (collapsed) {
    return (
      <div className="eq-gtoolbar is-collapsed">
        <button type="button" title="Show toolbar" onClick={() => setCollapsed(false)}>Show toolbar</button>
      </div>
    )
  }

  return (
    <div className="eq-gtoolbar" ref={root} role="toolbar" aria-label="Formatting toolbar">
      <div className="eq-gsearch">
        <Search size={14} />
        <input
          aria-label="Search menus"
          placeholder="Menus"
          value={query}
          onFocus={() => setOpen('search')}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen('search')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && matches[0]) run(matches[0].id)
          }}
        />
        {open === 'search' ? (
          <div className="eq-gpop" role="listbox">
            {matches.map((item) => (
              <button key={item.id} type="button" onClick={() => { setQuery(''); run(item.id) }}>
                {item.label}{item.keys ? <small>{item.keys}</small> : null}
              </button>
            ))}
            {matches.length === 0 ? <p>No matching commands</p> : null}
          </div>
        ) : null}
      </div>
      <ToolButton title="Undo (Ctrl+Z)" disabled={readOnly} onClick={() => run('undo')}><Undo2 size={16} /></ToolButton>
      <ToolButton title="Redo (Ctrl+Y)" disabled={readOnly} onClick={() => run('redo')}><Redo2 size={16} /></ToolButton>
      <ToolButton title="Print" onClick={() => run('print')}><Printer size={16} /></ToolButton>
      <ToolButton title="Paint format. Double-click to keep painting." disabled={readOnly} onClick={() => run('paint')} onDoubleClick={() => run('paint-lock')}><Paintbrush size={16} /></ToolButton>
      <Drop title="Zoom" label={`${zoom}%`} open={open === 'zoom'} onOpen={() => setOpen(open === 'zoom' ? null : 'zoom')}>
        {ZOOMS.map((level) => <button key={level} type="button" onClick={() => run(`zoom-${level}`)}>{level}%</button>)}
        <button type="button" onClick={() => run('zoom-custom')}>Custom</button>
      </Drop>
      <span className="eq-gsep" />
      <ToolButton title="Currency" disabled={readOnly} onClick={() => run('format-currency')}><DollarSign size={16} /></ToolButton>
      <ToolButton title="Percent" disabled={readOnly} onClick={() => run('format-percent')}><Percent size={16} /></ToolButton>
      <ToolButton title="Decrease decimal places" disabled={readOnly} onClick={() => run('decimals-dec')}><Minus size={14} /></ToolButton>
      <ToolButton title="Increase decimal places" disabled={readOnly} onClick={() => run('decimals-inc')}><Plus size={14} /></ToolButton>
      <Drop title="Number format" label="123" open={open === 'number'} onOpen={() => setOpen(open === 'number' ? null : 'number')}>
        {['general', 'number', 'text', 'currency', 'percent', 'date', 'time', 'scientific'].map((format) => (
          <button key={format} type="button" onClick={() => run(`format-${format}`)}>{format}</button>
        ))}
        <button type="button" onClick={() => run('currency-ask')}>Currency symbol</button>
      </Drop>
      <span className="eq-gsep" />
      <Drop title="Font" label={active?.fontFamily ?? 'Arial'} open={open === 'font'} onOpen={() => setOpen(open === 'font' ? null : 'font')}>
        <input aria-label="Search fonts" value={fontQuery} onChange={(event) => setFontQuery(event.target.value)} />
        {FONTS.filter((font) => font.toLowerCase().includes(fontQuery.toLowerCase())).map((font) => (
          <button key={font} type="button" style={{ fontFamily: font }} onClick={() => run(`family-${font}`)}>{font}</button>
        ))}
      </Drop>
      <ToolButton title="Decrease font size" disabled={readOnly} onClick={() => run('font-dec')}><Minus size={12} /></ToolButton>
      <select
        aria-label="Font size"
        disabled={readOnly}
        value={active?.fontSize ?? 12}
        onChange={(event) => run(`font-${event.target.value}`)}
      >
        {SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
      <ToolButton title="Increase font size" disabled={readOnly} onClick={() => run('font-inc')}><Plus size={12} /></ToolButton>
      <ToolButton title="Bold (Ctrl+B)" disabled={readOnly} pressed={Boolean(active?.bold)} onClick={() => run('bold')}><Bold size={16} /></ToolButton>
      <ToolButton title="Italic (Ctrl+I)" disabled={readOnly} pressed={Boolean(active?.italic)} onClick={() => run('italic')}><Italic size={16} /></ToolButton>
      <ToolButton title="Strikethrough" disabled={readOnly} pressed={Boolean(active?.strike)} onClick={() => run('strike')}><Strikethrough size={16} /></ToolButton>
      <Drop title="Text color" action={`color-${textColor}`} disabled={readOnly} icon={<span className="eq-gtext" style={{ borderBottomColor: textColor }}>A</span>} open={open === 'color'} onOpen={() => setOpen(open === 'color' ? null : 'color')} onRun={run}>
        <div className="eq-swatches">
          {COLORS.map((color) => <button key={color} type="button" style={{ background: color }} aria-label={color} onClick={() => run(`color-${color}`)} />)}
        </div>
        <input aria-label="Custom text color" type="color" onChange={(event) => run(`color-${event.target.value}`)} />
      </Drop>
      <span className="eq-gsep" />
      <Drop title="Fill color" action={`fill-${fillColor}`} disabled={readOnly} icon={<PaintBucket size={16} />} open={open === 'fill'} onOpen={() => setOpen(open === 'fill' ? null : 'fill')} onRun={run}>
        <div className="eq-swatches">
          {COLORS.map((color) => <button key={color} type="button" style={{ background: color }} aria-label={color} onClick={() => run(`fill-${color}`)} />)}
        </div>
        <button type="button" onClick={() => run('fill-none')}>No fill</button>
        <input aria-label="Custom fill color" type="color" onChange={(event) => run(`fill-${event.target.value}`)} />
      </Drop>
      <Drop title="Borders" action="border-all" disabled={readOnly} icon={<Grid2x2 size={16} />} open={open === 'border'} onOpen={() => setOpen(open === 'border' ? null : 'border')} onRun={run}>
        {['all', 'outer', 'inner', 'top', 'bottom', 'left', 'right', 'none'].map((mode) => (
          <button key={mode} type="button" onClick={() => run(`border-${mode}`)}>{mode} borders</button>
        ))}
        <button type="button" onClick={() => run('border-dashed')}>Dashed</button>
        <button type="button" onClick={() => run('border-dotted')}>Dotted</button>
      </Drop>
      <Drop title="Merge cells" action="merge" disabled={readOnly || !canMerge} menuDisabled={readOnly} icon={<TableCellsMerge size={16} />} open={open === 'merge'} onOpen={() => setOpen(open === 'merge' ? null : 'merge')} onRun={run}>
        <button type="button" disabled={readOnly || !canMerge} onClick={() => run('merge')}>Merge cells</button>
        <button type="button" disabled={readOnly || !canMergeHorizontal} onClick={() => run('merge-h')}>Merge horizontally</button>
        <button type="button" disabled={readOnly || !canMergeVertical} onClick={() => run('merge-v')}>Merge vertically</button>
        <button type="button" disabled={readOnly || !canUnmerge} onClick={() => run('unmerge')}>Unmerge cells</button>
      </Drop>
      <Drop title="Horizontal alignment" action="align-left" disabled={readOnly} icon={<AlignLeft size={16} />} open={open === 'align'} onOpen={() => setOpen(open === 'align' ? null : 'align')} onRun={run}>
        <button type="button" onClick={() => run('align-left')}><AlignLeft size={14} /> Left</button>
        <button type="button" onClick={() => run('align-center')}><AlignCenter size={14} /> Center</button>
        <button type="button" onClick={() => run('align-right')}><AlignRight size={14} /> Right</button>
      </Drop>
      <Drop title="Vertical alignment" action="valign-middle" disabled={readOnly} icon={<AlignVerticalJustifyCenter size={16} />} open={open === 'valign'} onOpen={() => setOpen(open === 'valign' ? null : 'valign')} onRun={run}>
        <button type="button" onClick={() => run('valign-top')}>Top</button>
        <button type="button" onClick={() => run('valign-middle')}>Middle</button>
        <button type="button" onClick={() => run('valign-bottom')}>Bottom</button>
      </Drop>
      <Drop title="Text wrapping" action="wrap-wrap" disabled={readOnly} icon={<WrapText size={16} />} open={open === 'wrap'} onOpen={() => setOpen(open === 'wrap' ? null : 'wrap')} onRun={run}>
        <button type="button" onClick={() => run('wrap-overflow')}><WrapText size={14} /> Overflow</button>
        <button type="button" onClick={() => run('wrap-wrap')}>Wrap</button>
        <button type="button" onClick={() => run('wrap-clip')}>Clip</button>
      </Drop>
      <Drop title="Text rotation" action="rotate-up" disabled={readOnly} icon={<RotateCw size={16} />} open={open === 'rotate'} onOpen={() => setOpen(open === 'rotate' ? null : 'rotate')} onRun={run}>
        <button type="button" onClick={() => run('rotate-up')}>Rotate up</button>
        <button type="button" onClick={() => run('rotate-down')}>Rotate down</button>
        <button type="button" onClick={() => run('rotate-vert')}>Vertical</button>
        <button type="button" onClick={() => run('rotate-0')}>None</button>
        <button type="button" onClick={() => run('rotate-ask')}>Custom angle</button>
      </Drop>
      <span className="eq-gsep" />
      <ToolButton title="Insert link" disabled={readOnly} onClick={() => run('link')}><Link2 size={16} /></ToolButton>
      <ToolButton title="Add comment" disabled={readOnly} onClick={() => run('comment')}>💬</ToolButton>
      <ToolButton title="Insert chart" onClick={() => run('chart')}>▦</ToolButton>
      <ToolButton title="Create a filter" disabled={readOnly} onClick={() => run('filter-create')}><Filter size={16} /></ToolButton>
      <Drop title="Functions" label="Σ" action="fn-SUM" disabled={readOnly} open={open === 'fn'} onOpen={() => setOpen(open === 'fn' ? null : 'fn')} onRun={run}>
        {['SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'MIN', 'MAX', 'ROUND', 'STDEV.S', 'VAR.S'].map((name) => (
          <button key={name} type="button" onClick={() => run(`fn-${name}`)}>{name}</button>
        ))}
      </Drop>
      <button type="button" className="eq-gmore" title="Hide toolbar" onClick={() => setCollapsed(true)}><ChevronDown size={16} /></button>
    </div>
  )
}

function ToolButton({
  title,
  disabled,
  pressed,
  onClick,
  onDoubleClick,
  children,
}: {
  title: string
  disabled?: boolean
  pressed?: boolean
  onClick: () => void
  onDoubleClick?: () => void
  children: ReactNode
}) {
  return (
    <button type="button" title={title} aria-pressed={pressed} className={pressed ? 'is-on' : ''} disabled={disabled} onClick={onClick} onDoubleClick={onDoubleClick}>
      {children}
    </button>
  )
}

function Drop({
  title,
  label,
  icon,
  action,
  disabled,
  menuDisabled,
  open,
  onOpen,
  onRun,
  children,
}: {
  title: string
  label?: string
  icon?: ReactNode
  action?: string
  disabled?: boolean
  menuDisabled?: boolean
  open: boolean
  onOpen: () => void
  onRun?: (command: string) => void
  children: ReactNode
}) {
  return (
    <div className="eq-gdrop">
      <button
        type="button"
        title={title}
        disabled={disabled}
        aria-expanded={action ? undefined : open}
        onClick={() => (action && onRun ? onRun(action) : onOpen())}
      >
        {icon}
        {label ? <span>{label}</span> : null}
        {action ? null : <ChevronDown size={12} />}
      </button>
      {action ? (
        <button type="button" className="eq-gcaret" title={`${title} menu`} aria-label={`${title} menu`} aria-expanded={open} disabled={menuDisabled ?? disabled} onClick={onOpen}>
          <ChevronDown size={12} />
        </button>
      ) : null}
      {open ? <div className="eq-gpop" onMouseDown={(event) => event.stopPropagation()}>{children}</div> : null}
    </div>
  )
}
