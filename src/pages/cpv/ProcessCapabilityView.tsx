import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Gauge } from 'lucide-react'

import { CAPABILITY_RECENT_COUNT, capabilityInference, capabilityStats, processCapabilityReports, scopedCapabilityValues, type CapabilityScope, type CapabilityStats, type ProcessCapabilityReport } from '../../features/cpv/processCapability'

const PLOT = { left: 46, right: 14, top: 16, bottom: 24, width: 320, height: 168 }

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const absolute = Math.abs(value)
  if (absolute >= 100) return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (absolute >= 1) return value.toFixed(2)
  return value.toFixed(4)
}

function parameterLabel(report: ProcessCapabilityReport): string {
  return report.unit ? `${report.parameter} (${report.unit})` : report.parameter
}

function yScale(samples: number[]) {
  const low = Math.min(...samples)
  const high = Math.max(...samples)
  const span = high - low || Math.abs(high) || 1
  const yMin = low - span * 0.12
  const yMax = high + span * 0.12
  const plotHeight = PLOT.height - PLOT.top - PLOT.bottom
  return {
    yMin,
    yMax,
    yAt(value: number) {
      return PLOT.top + ((yMax - value) / (yMax - yMin)) * plotHeight
    },
  }
}

function axisTicks(yMin: number, yMax: number): number[] {
  const count = 4
  return Array.from({ length: count + 1 }, (_, index) => yMin + ((yMax - yMin) * index) / count)
}

function ChartFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="capability-chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${PLOT.width} ${PLOT.height}`} role="img" aria-label={title}>
        {children}
      </svg>
    </figure>
  )
}

function YAxis({ yMin, yMax, yAt }: { yMin: number; yMax: number; yAt: (value: number) => number }) {
  return (
    <>
      <line x1={PLOT.left} y1={PLOT.top} x2={PLOT.left} y2={PLOT.height - PLOT.bottom} stroke="#cbd5e1" />
      <line x1={PLOT.left} y1={PLOT.height - PLOT.bottom} x2={PLOT.width - PLOT.right} y2={PLOT.height - PLOT.bottom} stroke="#cbd5e1" />
      {axisTicks(yMin, yMax).map((tick) => (
        <g key={tick}>
          <line x1={PLOT.left - 3} y1={yAt(tick)} x2={PLOT.left} y2={yAt(tick)} stroke="#94a3b8" />
          <text x={PLOT.left - 6} y={yAt(tick) + 3} textAnchor="end" fontSize="9" fill="#64748b">{formatValue(tick)}</text>
        </g>
      ))}
    </>
  )
}

function specLines(yAt: (value: number) => number, report: ProcessCapabilityReport, withTarget = false) {
  const lines = [
    { name: 'LSL', value: report.lsl, color: '#dc2626' },
    { name: 'USL', value: report.usl, color: '#dc2626' },
    ...(withTarget ? [{ name: 'Target', value: report.target, color: '#0f766e' }] : []),
  ]
  return lines.map((line) => (
    <line key={line.name} x1={PLOT.left} y1={yAt(line.value)} x2={PLOT.width - PLOT.right} y2={yAt(line.value)} stroke={line.color} strokeWidth={line.name === 'Target' ? 1 : 1.4} strokeDasharray={line.name === 'Target' ? '3 3' : undefined} />
  ))
}

function Boxplot({ report }: { report: ProcessCapabilityReport }) {
  const stats = report.stats
  if (!stats) return null
  const scale = yScale([stats.min, stats.max, report.lsl, report.usl])
  const x = (PLOT.left + PLOT.width - PLOT.right) / 2
  return (
    <ChartFrame title={`Boxplot of ${parameterLabel(report)}`}>
      <YAxis {...scale} />
      {specLines(scale.yAt, report)}
      <line x1={x} y1={scale.yAt(stats.min)} x2={x} y2={scale.yAt(stats.q1)} stroke="#0f172a" />
      <line x1={x} y1={scale.yAt(stats.q3)} x2={x} y2={scale.yAt(stats.max)} stroke="#0f172a" />
      <line x1={x - 16} y1={scale.yAt(stats.min)} x2={x + 16} y2={scale.yAt(stats.min)} stroke="#0f172a" />
      <line x1={x - 16} y1={scale.yAt(stats.max)} x2={x + 16} y2={scale.yAt(stats.max)} stroke="#0f172a" />
      <rect x={x - 22} y={scale.yAt(stats.q3)} width={44} height={Math.max(1, scale.yAt(stats.q1) - scale.yAt(stats.q3))} fill="#e6f4f1" stroke="#0f766e" />
      <line x1={x - 22} y1={scale.yAt(stats.median)} x2={x + 22} y2={scale.yAt(stats.median)} stroke="#0f766e" strokeWidth="2" />
      <text x={PLOT.width / 2} y={PLOT.height - 6} textAnchor="middle" fontSize="10" fill="#475569">{report.stage}</text>
    </ChartFrame>
  )
}

function RunChart({ title, values, center, upper, lower, report, showSpecs = true }: { title: string; values: number[]; center: number; upper: number; lower: number; report: ProcessCapabilityReport; showSpecs?: boolean }) {
  const scale = yScale(showSpecs ? [...values, center, upper, lower, report.lsl, report.usl] : [...values, center, upper, lower, 0])
  const plotWidth = PLOT.width - PLOT.left - PLOT.right
  const xAt = (index: number) => PLOT.left + (values.length === 1 ? plotWidth / 2 : (index / (values.length - 1)) * plotWidth)
  const path = values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${scale.yAt(value)}`).join(' ')
  return (
    <ChartFrame title={title}>
      <YAxis {...scale} />
      {showSpecs ? specLines(scale.yAt, report) : null}
      <line x1={PLOT.left} y1={scale.yAt(center)} x2={PLOT.width - PLOT.right} y2={scale.yAt(center)} stroke="#0f172a" />
      <line x1={PLOT.left} y1={scale.yAt(upper)} x2={PLOT.width - PLOT.right} y2={scale.yAt(upper)} stroke="#e37400" strokeDasharray="4 3" />
      <line x1={PLOT.left} y1={scale.yAt(lower)} x2={PLOT.width - PLOT.right} y2={scale.yAt(lower)} stroke="#e37400" strokeDasharray="4 3" />
      <path d={path} fill="none" stroke="#1d4ed8" strokeWidth="1.4" />
      {values.map((value, index) => <circle key={`${index}:${value}`} cx={xAt(index)} cy={scale.yAt(value)} r="2.4" fill="#1d4ed8" />)}
    </ChartFrame>
  )
}

function inverseNormal(probability: number): number {
  const clamped = Math.min(1 - 1e-10, Math.max(1e-10, probability))
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const plow = 0.02425
  if (clamped < plow) {
    const q = Math.sqrt(-2 * Math.log(clamped))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (clamped > 1 - plow) {
    const q = Math.sqrt(-2 * Math.log(1 - clamped))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  const q = clamped - 0.5
  const r = q * q
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

function ProbabilityPlot({ values, stats }: { values: number[]; stats: CapabilityStats }) {
  const sorted = [...values].sort((left, right) => left - right)
  const points = sorted.map((value, index) => ({ value, z: inverseNormal((index + 0.5) / sorted.length) }))
  const zMin = Math.min(...points.map((point) => point.z), -2)
  const zMax = Math.max(...points.map((point) => point.z), 2)
  const scale = yScale([zMin, zMax])
  const plotWidth = PLOT.width - PLOT.left - PLOT.right
  const xMin = Math.min(...sorted)
  const xMax = Math.max(...sorted)
  const xAt = (value: number) => PLOT.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth
  const fitted = [xMin, xMax].map((value) => {
    const z = stats.stdev > 0 ? (value - stats.mean) / stats.stdev : 0
    return `${value === xMin ? 'M' : 'L'} ${xAt(value)} ${scale.yAt(z)}`
  }).join(' ')
  return (
    <ChartFrame title="Normal Probability Plot">
      <YAxis {...scale} />
      <path d={fitted} fill="none" stroke="#94a3b8" />
      {points.map((point) => <circle key={`${point.value}:${point.z}`} cx={xAt(point.value)} cy={scale.yAt(point.z)} r="2.4" fill="#1d4ed8" />)}
      <text x={PLOT.left + 6} y={PLOT.top + 12} fontSize="10" fill="#334155">AD {formatValue(stats.andersonDarling)}</text>
      <text x={PLOT.left + 6} y={PLOT.top + 24} fontSize="10" fill="#334155">P {formatValue(stats.andersonDarlingP)}</text>
    </ChartFrame>
  )
}

function Histogram({ report }: { report: ProcessCapabilityReport }) {
  const stats = report.stats
  if (!stats) return null
  const current = stats
  const low = Math.min(stats.min, report.lsl)
  const high = Math.max(stats.max, report.usl)
  const bins = Math.max(4, Math.round(Math.sqrt(stats.n)))
  const width = (high - low) / bins || 1
  const counts = Array.from({ length: bins }, (_, index) => {
    const start = low + index * width
    const end = start + width
    return report.values.filter((value) => value >= start && (index === bins - 1 ? value <= end : value < end)).length
  })
  const densityCount = (sigma: number) => {
    if (sigma <= 0) return 0
    return (stats.n * width) / (sigma * Math.sqrt(2 * Math.PI))
  }
  const scale = yScale([0, Math.max(...counts, densityCount(stats.withinSigma), densityCount(stats.stdev), 1)])
  const plotWidth = PLOT.width - PLOT.left - PLOT.right
  const barWidth = plotWidth / bins
  function curve(sigma: number) {
    if (sigma <= 0) return ''
    return Array.from({ length: 40 }, (_, index) => {
      const value = low + ((high - low) * index) / 39
      const z = (value - current.mean) / sigma
      const density = Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI))
      const count = density * current.n * width
      const x = PLOT.left + ((value - low) / (high - low || 1)) * plotWidth
      return `${index === 0 ? 'M' : 'L'} ${x} ${scale.yAt(count)}`
    }).join(' ')
  }
  return (
    <ChartFrame title="Capability Histogram">
      <YAxis {...scale} />
      {counts.map((count, index) => (
        <rect key={index} x={PLOT.left + index * barWidth + 1} y={scale.yAt(count)} width={Math.max(1, barWidth - 2)} height={Math.max(0, scale.yAt(0) - scale.yAt(count))} fill="#dbeafe" stroke="#1d4ed8" />
      ))}
      <path d={curve(stats.withinSigma)} fill="none" stroke="#0f766e" strokeWidth="1.4" />
      <path d={curve(stats.stdev)} fill="none" stroke="#1d4ed8" strokeDasharray="4 3" />
      <line x1={PLOT.left + ((report.lsl - low) / (high - low || 1)) * plotWidth} y1={PLOT.top} x2={PLOT.left + ((report.lsl - low) / (high - low || 1)) * plotWidth} y2={PLOT.height - PLOT.bottom} stroke="#dc2626" />
      <line x1={PLOT.left + ((report.usl - low) / (high - low || 1)) * plotWidth} y1={PLOT.top} x2={PLOT.left + ((report.usl - low) / (high - low || 1)) * plotWidth} y2={PLOT.height - PLOT.bottom} stroke="#dc2626" />
      <line x1={PLOT.left + ((report.target - low) / (high - low || 1)) * plotWidth} y1={PLOT.top} x2={PLOT.left + ((report.target - low) / (high - low || 1)) * plotWidth} y2={PLOT.height - PLOT.bottom} stroke="#0f766e" strokeDasharray="3 3" />
    </ChartFrame>
  )
}

function CapabilityPanel({ stats, report }: { stats: CapabilityStats; report: ProcessCapabilityReport }) {
  const rows = [
    ['Within StDev', formatValue(stats.withinSigma)],
    ['Cp', formatValue(stats.cp)],
    ['Cpk', formatValue(stats.cpk)],
    ['PPM (within)', formatValue(stats.ppmWithin)],
    ['Overall StDev', formatValue(stats.stdev)],
    ['Pp', formatValue(stats.pp)],
    ['Ppk', formatValue(stats.ppk)],
    ['Cpm', formatValue(stats.cpm)],
    ['PPM (overall)', formatValue(stats.ppmOverall)],
  ]
  return (
    <figure className="capability-chart">
      <figcaption>Capability of {report.parameter}</figcaption>
      <dl className="pcv-stats">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div><dt>LSL</dt><dd>{formatValue(report.lsl)}</dd></div>
        <div><dt>Target</dt><dd>{formatValue(report.target)}</dd></div>
        <div><dt>USL</dt><dd>{formatValue(report.usl)}</dd></div>
      </dl>
    </figure>
  )
}

function Inference({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  return (
    <section className="pcv-inference" aria-label={title}>
      <h3>{title}</h3>
      {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    </section>
  )
}

function ReportBody({ report, total, scope, onScope }: { report: ProcessCapabilityReport; total: number; scope: CapabilityScope; onScope: (scope: CapabilityScope) => void }) {
  const stats = report.stats
  const label = parameterLabel(report)
  const inference = capabilityInference(report, report.values, stats, scope, total)
  return (
    <div className="capability-sheet">
      <section className="capability-block">
        <div className="pcv-block-head">
          <h2>Descriptive Statistics: {label}</h2>
          <div className="pcv-scope" role="group" aria-label="Results included">
            <button type="button" aria-pressed={scope === 'all'} onClick={() => onScope('all')}>All entries</button>
            <button type="button" aria-pressed={scope === 'latest-30'} onClick={() => onScope('latest-30')}>Latest 30</button>
          </div>
        </div>
        <table className="capability-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>N</th>
              <th>Mean</th>
              <th>StDev</th>
              <th>Minimum{report.unit ? ` (${report.unit})` : ''}</th>
              <th>Maximum{report.unit ? ` (${report.unit})` : ''}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{report.parameter}</td>
              <td>{report.values.length}</td>
              <td>{stats ? formatValue(stats.mean) : '—'}</td>
              <td>{stats ? formatValue(stats.stdev) : '—'}</td>
              <td>{report.values.length ? formatValue(Math.min(...report.values)) : '—'}</td>
              <td>{report.values.length ? formatValue(Math.max(...report.values)) : '—'}</td>
            </tr>
          </tbody>
        </table>
        {report.specification ? <p className="capability-note">Specification: {report.specification}. Stage: {report.stage}.</p> : <p className="capability-note">Stage: {report.stage}.</p>}
        {stats ? <Boxplot report={report} /> : <p className="capability-note">At least two numeric results are needed before the charts can be drawn.</p>}
        <Inference title="Boxplot inference" paragraphs={inference.boxplot} />
      </section>
      {stats ? (
        <section className="capability-block">
          <h2>Process Capability Sixpack Report for {report.parameter}</h2>
          <div className="pcv-sixpack">
            <RunChart title="I Chart" values={report.values} center={stats.mean} upper={stats.individualUcl} lower={stats.individualLcl} report={report} />
            <Histogram report={report} />
            <RunChart title={`Last ${CAPABILITY_RECENT_COUNT} Observations`} values={report.values.slice(-CAPABILITY_RECENT_COUNT)} center={stats.mean} upper={stats.individualUcl} lower={stats.individualLcl} report={report} />
            <RunChart title="Moving Range Chart" values={stats.movingRanges} center={stats.movingRangeBar} upper={stats.movingRangeUcl} lower={0} report={report} showSpecs={false} />
            <ProbabilityPlot values={report.values} stats={stats} />
            <CapabilityPanel stats={stats} report={report} />
          </div>
          <Inference title="Sixpack inference" paragraphs={inference.sixpack} />
        </section>
      ) : null}
    </div>
  )
}

export function ProcessCapabilityView({ productCode }: { productCode: string }) {
  const reports = useMemo(() => processCapabilityReports(productCode), [productCode])
  const [activeId, setActiveId] = useState(reports[0]?.id ?? '')
  const [scope, setScope] = useState<CapabilityScope>('all')
  useEffect(() => {
    if (!reports.some((report) => report.id === activeId)) setActiveId(reports[0]?.id ?? '')
  }, [reports, activeId])
  const active = reports.find((report) => report.id === activeId) ?? null
  const shown = useMemo(() => {
    if (!active) return null
    const values = scopedCapabilityValues(active.values, scope)
    return { ...active, values, stats: capabilityStats(values, active.lsl, active.usl) }
  }, [active, scope])

  return (
    <section className="capability-report" aria-label="Process capability">
      <div className="capability-body">
        {shown && active ? <ReportBody report={shown} total={active.values.length} scope={scope} onScope={setScope} /> : (
          <div className="capability-empty">
            <Gauge aria-hidden="true" size={28} />
            <h2>No quantitative parameters yet</h2>
            <p>On Analytical Report, choose Quantitative and enter a USL above the LSL. Each of those parameters opens as a tab here.</p>
          </div>
        )}
      </div>
      {reports.length ? (
        <div className="eq-footer" role="tablist" aria-label="Quantitative parameters">
          <div className="eq-tabs">
            {reports.map((report) => (
              <button
                key={report.id}
                type="button"
                role="tab"
                aria-selected={report.id === active?.id}
                className={report.id === active?.id ? 'eq-tab is-active is-selected' : 'eq-tab'}
                onClick={() => setActiveId(report.id)}
              >
                {report.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
