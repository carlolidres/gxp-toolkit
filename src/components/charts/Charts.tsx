import type { ReactNode } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { linearRegression, mean as calculateMean, subgroupMeans, subgroupRanges } from '../../utils/statistics'
import { useChartPalette } from './chartTheme'

function chartTooltipStyle(palette: ReturnType<typeof useChartPalette>) {
  return {
    background: palette.tooltipBg,
    border: `1px solid ${palette.tooltipBorder}`,
    borderRadius: 8,
    color: palette.tooltipText,
    fontSize: 12,
  }
}

export function TrendChart({ data, dataKey = 'value' }: { data: Array<Record<string, string | number>>; dataKey?: string }) {
  const palette = useChartPalette()
  return (
    <div className="chart">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <Tooltip contentStyle={chartTooltipStyle(palette)} />
          <Line type="monotone" dataKey={dataKey} stroke={palette.secondary} strokeWidth={2.5} dot={{ r: 3, fill: palette.secondary }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SimpleBarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const palette = useChartPalette()
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <YAxis tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <Tooltip contentStyle={chartTooltipStyle(palette)} />
          <Bar dataKey="value" fill={palette.primary} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DonutChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const palette = useChartPalette()
  return (
    <div className="chart">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
            {data.map((item, index) => <Cell key={item.name} fill={palette.series[index % palette.series.length]} stroke="none" />)}
          </Pie>
          <Tooltip contentStyle={chartTooltipStyle(palette)} />
          <Legend wrapperStyle={{ color: palette.axis, fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ScatterPlot({ data }: { data: Array<{ x: number; y: number }> }) {
  const palette = useChartPalette()
  return (
    <div className="chart">
      <ResponsiveContainer>
        <ScatterChart>
          <CartesianGrid stroke={palette.grid} />
          <XAxis dataKey="x" type="number" tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <YAxis dataKey="y" type="number" tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={chartTooltipStyle(palette)} />
          <Scatter data={data} fill={palette.accent} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ControlChart({ data, center, ucl, lcl, usl, lsl }: { data: Array<Record<string, string | number>>; center: number; ucl: number; lcl: number; usl?: number; lsl?: number }) {
  const palette = useChartPalette()
  return (
    <div className="chart chart-large">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <Tooltip contentStyle={chartTooltipStyle(palette)} />
          <Line type="monotone" dataKey="value" stroke={palette.primary} strokeWidth={2} dot={{ r: 3, fill: palette.primary }} />
          <ReferenceLine y={center} stroke={palette.secondary} strokeDasharray="4 4" label={{ value: 'CL', fill: palette.axis, fontSize: 10 }} />
          <ReferenceLine y={ucl} stroke={palette.limit} strokeDasharray="5 5" label={{ value: 'UCL', fill: palette.limit, fontSize: 10 }} />
          <ReferenceLine y={lcl} stroke={palette.limit} strokeDasharray="5 5" label={{ value: 'LCL', fill: palette.limit, fontSize: 10 }} />
          {usl !== undefined && <ReferenceLine y={usl} stroke={palette.spec} strokeDasharray="5 5" label={{ value: 'USL', fill: palette.spec, fontSize: 10 }} />}
          {lsl !== undefined && <ReferenceLine y={lsl} stroke={palette.spec} strokeDasharray="5 5" label={{ value: 'LSL', fill: palette.spec, fontSize: 10 }} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Histogram({ values }: { values: number[] }) {
  const minimum = Math.min(...values)
  const width = (Math.max(...values) - minimum || 1) / 6
  const bins = Array.from({ length: 6 }, (_, index) => ({ label: (minimum + index * width).toFixed(1), value: 0 }))
  values.forEach((value) => { bins[Math.min(5, Math.floor((value - minimum) / width))].value += 1 })
  return <SimpleBarChart data={bins} />
}

export function DistributionPlot({ values, mean, sigma }: { values: number[]; mean: number; sigma: number }) {
  const palette = useChartPalette()
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = maximum - minimum || 1
  const binWidth = span / 8
  const bins = Array.from({ length: 8 }, (_, index) => {
    const start = minimum + index * binWidth
    return { label: start.toFixed(1), count: 0, x: start + binWidth / 2 }
  })
  values.forEach((value) => {
    const index = Math.min(7, Math.floor((value - minimum) / binWidth))
    bins[index].count += 1
  })
  const curve = bins.map((bin) => {
    const y = sigma ? Math.exp(-0.5 * ((bin.x - mean) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI)) : 0
    return { ...bin, normal: y * values.length * binWidth }
  })
  return (
    <div className="chart">
      <ResponsiveContainer>
        <ComposedChart data={curve}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: palette.axis, fontSize: 10 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <YAxis tick={{ fill: palette.axis, fontSize: 10 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <Tooltip contentStyle={chartTooltipStyle(palette)} />
          <Bar dataKey="count" fill={palette.primary} radius={[2, 2, 0, 0]} />
          <Line type="monotone" dataKey="normal" stroke={palette.limit} strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CapabilityPlot({ values, mean, sigma, lsl, usl }: { values: number[]; mean: number; sigma: number; lsl: number; usl: number }) {
  const palette = useChartPalette()
  const minimum = Math.min(...values, lsl)
  const maximum = Math.max(...values, usl)
  const span = maximum - minimum || 1
  const binWidth = span / 10
  const bins = Array.from({ length: 10 }, (_, index) => {
    const start = minimum + index * binWidth
    return { label: start.toFixed(1), count: 0, x: start + binWidth / 2 }
  })
  values.forEach((value) => {
    const index = Math.min(9, Math.floor((value - minimum) / binWidth))
    bins[index].count += 1
  })
  const curve = bins.map((bin) => {
    const y = sigma ? Math.exp(-0.5 * ((bin.x - mean) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI)) : 0
    return { ...bin, normal: y * values.length * binWidth }
  })
  return (
    <div className="chart chart-large">
      <ResponsiveContainer>
        <ComposedChart data={curve}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: palette.axis, fontSize: 10 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} interval={1} />
          <YAxis tick={{ fill: palette.axis, fontSize: 10 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <Tooltip contentStyle={chartTooltipStyle(palette)} />
          <Bar dataKey="count" fill={palette.primary} radius={[2, 2, 0, 0]} />
          <Line type="monotone" dataKey="normal" stroke={palette.limit} strokeWidth={2.5} dot={false} />
          <ReferenceLine x={bins.find((b) => b.x >= lsl)?.label ?? bins[0].label} stroke={palette.spec} strokeDasharray="4 4" />
          <ReferenceLine x={bins.find((b) => b.x >= usl)?.label ?? bins[bins.length - 1].label} stroke={palette.spec} strokeDasharray="4 4" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BellCurve({ mean, sigma }: { mean: number; sigma: number }) {
  const palette = useChartPalette()
  const data = Array.from({ length: 41 }, (_, index) => {
    const x = mean - 4 * sigma + (index * 8 * sigma) / 40
    const y = sigma ? Math.exp(-0.5 * ((x - mean) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI)) : 0
    return { label: x.toFixed(2), value: y }
  })
  return (
    <div className="chart">
      <ResponsiveContainer>
        <ComposedChart data={data}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" interval={7} tick={{ fill: palette.axis, fontSize: 10 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <YAxis hide />
          <Tooltip contentStyle={chartTooltipStyle(palette)} />
          <Area type="monotone" dataKey="value" fill={palette.fillSoft} stroke={palette.secondary} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ParetoChart({ data }: { data: Array<{ label: string; value: number; cumulative: number }> }) {
  const palette = useChartPalette()
  return (
    <div className="chart">
      <ResponsiveContainer>
        <ComposedChart data={data}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <YAxis yAxisId="left" tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <Tooltip contentStyle={chartTooltipStyle(palette)} />
          <Bar yAxisId="left" dataKey="value" fill={palette.primary} radius={[3, 3, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke={palette.paretoLine} strokeWidth={2.5} dot={{ r: 3, fill: palette.paretoLine }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function mixColor(from: string, to: string, amount: number): string {
  const parse = (hex: string) => {
    const value = hex.replace('#', '')
    return [
      Number.parseInt(value.slice(0, 2), 16),
      Number.parseInt(value.slice(2, 4), 16),
      Number.parseInt(value.slice(4, 6), 16),
    ]
  }
  const [r1, g1, b1] = parse(from)
  const [r2, g2, b2] = parse(to)
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount)
  const channel = (value: number) => value.toString(16).padStart(2, '0')
  return `#${channel(mix(r1, r2))}${channel(mix(g1, g2))}${channel(mix(b1, b2))}`
}

function heatmapColor(ratio: number, palette: ReturnType<typeof useChartPalette>): string {
  if (ratio <= 0.5) return mixColor(palette.heatmapLow, palette.heatmapMid, ratio * 2)
  return mixColor(palette.heatmapMid, palette.heatmapHigh, (ratio - 0.5) * 2)
}

function buildContourGrid(size = 18): number[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const x = (col / (size - 1)) * 4 - 2
      const y = (row / (size - 1)) * 4 - 2
      return Math.sin(x * 1.1) * Math.cos(y * 0.9) * 0.85 + Math.sin(x * 0.4 + y * 0.6) * 0.35
    }),
  )
}

function contourSegments(grid: number[][], level: number, width: number, height: number): string {
  const rows = grid.length
  const cols = grid[0].length
  const cellW = width / (cols - 1)
  const cellH = height / (rows - 1)
  const segments: string[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const left = grid[row][col]
      const right = grid[row][col + 1]
      if ((left - level) * (right - level) < 0) {
        const t = (level - left) / (right - left)
        const x = (col + t) * cellW
        const y = row * cellH
        segments.push(`${x},${y}`)
      }
    }
  }

  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows - 1; row += 1) {
      const top = grid[row][col]
      const bottom = grid[row + 1][col]
      if ((top - level) * (bottom - level) < 0) {
        const t = (level - top) / (bottom - top)
        const x = col * cellW
        const y = (row + t) * cellH
        segments.push(`${x},${y}`)
      }
    }
  }

  if (segments.length < 2) return ''
  return `M ${segments.join(' L ')}`
}

function localStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const average = calculateMean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1))
}

export function ScatterWithRegression({ data }: { data: Array<{ x: number; y: number }> }) {
  const palette = useChartPalette()
  const { slope, intercept, rSquared } = linearRegression(data)
  const enriched = data.map((point) => ({
    ...point,
    fitY: slope * point.x + intercept,
  }))
  const residual = localStandardDeviation(data.map((point) => point.y - (slope * point.x + intercept)))

  return (
    <div className="chart">
      <ResponsiveContainer>
        <ComposedChart data={enriched}>
          <CartesianGrid stroke={palette.grid} />
          <XAxis dataKey="x" type="number" tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <YAxis dataKey="y" type="number" tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={chartTooltipStyle(palette)} />
          <Scatter dataKey="y" fill={palette.primary} />
          <Line dataKey="fitY" stroke={palette.limit} strokeWidth={2} dot={false} type="linear" />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="chart-annotation">S = {residual.toFixed(2)} · R-Sq = {(rSquared * 100).toFixed(1)}%</p>
    </div>
  )
}

export function ResidualPlot({ data }: { data: Array<{ x: number; y: number }> }) {
  const palette = useChartPalette()
  const { slope, intercept } = linearRegression(data)
  const residuals = data.map((point) => ({
    x: point.x,
    y: point.y - (slope * point.x + intercept),
  }))

  return (
    <div className="chart">
      <ResponsiveContainer>
        <ScatterChart>
          <CartesianGrid stroke={palette.grid} />
          <XAxis dataKey="x" type="number" tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <YAxis dataKey="y" type="number" tick={{ fill: palette.axis, fontSize: 11 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={chartTooltipStyle(palette)} />
          <ReferenceLine y={0} stroke={palette.limit} strokeDasharray="4 4" />
          <Scatter data={residuals} fill={palette.accent} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

export function HeatMapChart({
  matrix,
  rowLabels,
  colLabels,
}: {
  matrix: number[][]
  rowLabels: string[]
  colLabels: string[]
}) {
  const palette = useChartPalette()
  const flat = matrix.flat()
  const minValue = Math.min(...flat)
  const maxValue = Math.max(...flat)

  return (
    <div className="heatmap-layout">
      <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${colLabels.length}, 1fr)` }}>
        {matrix.flatMap((row, rowIndex) =>
          row.map((value, colIndex) => {
            const ratio = maxValue === minValue ? 0.5 : (value - minValue) / (maxValue - minValue)
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="heatmap-cell"
                style={{ background: heatmapColor(ratio, palette) }}
                title={`${rowLabels[rowIndex]} / ${colLabels[colIndex]}: ${value.toFixed(2)}`}
              />
            )
          }),
        )}
      </div>
      <div className="heatmap-legend">
        <span>{maxValue.toFixed(1)}</span>
        <div className="heatmap-legend-bar" style={{ background: `linear-gradient(to bottom, ${palette.heatmapHigh}, ${palette.heatmapMid}, ${palette.heatmapLow})` }} />
        <span>{minValue.toFixed(1)}</span>
      </div>
      <div className="heatmap-row-labels">
        {rowLabels.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="heatmap-col-labels" style={{ gridTemplateColumns: `repeat(${colLabels.length}, 1fr)` }}>
        {colLabels.map((label) => <span key={label}>{label}</span>)}
      </div>
    </div>
  )
}

export function ContourPlot() {
  const palette = useChartPalette()
  const grid = buildContourGrid(20)
  const flat = grid.flat()
  const minValue = Math.min(...flat)
  const maxValue = Math.max(...flat)
  const width = 280
  const height = 200
  const levels = [-0.6, -0.3, 0, 0.3, 0.6]

  return (
    <div className="contour-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="contour-svg" role="img" aria-label="Contour plot">
        {grid.map((row, rowIndex) =>
          row.map((value, colIndex) => {
            const ratio = (value - minValue) / (maxValue - minValue || 1)
            const cellW = width / (grid[0].length - 1)
            const cellH = height / (grid.length - 1)
            return (
              <rect
                key={`${rowIndex}-${colIndex}`}
                x={colIndex * cellW - cellW / 2}
                y={rowIndex * cellH - cellH / 2}
                width={cellW}
                height={cellH}
                fill={heatmapColor(ratio, palette)}
                opacity={0.35}
              />
            )
          }),
        )}
        {levels.map((level) => (
          <path
            key={level}
            d={contourSegments(grid, level, width, height)}
            fill="none"
            stroke={palette.primary}
            strokeWidth={1.5}
          />
        ))}
      </svg>
      <div className="contour-legend">
        <span>Low</span>
        <div style={{ background: `linear-gradient(to right, ${palette.heatmapLow}, ${palette.heatmapMid}, ${palette.heatmapHigh})` }} />
        <span>High</span>
      </div>
    </div>
  )
}

function marginalBins(values: number[], count = 8): number[] {
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const span = maxValue - minValue || 1
  const bins = Array.from({ length: count }, () => 0)
  values.forEach((value) => {
    const index = Math.min(count - 1, Math.floor(((value - minValue) / span) * count))
    bins[index] += 1
  })
  return bins
}

export function MarginalPlot({ data }: { data: Array<{ x: number; y: number }> }) {
  const palette = useChartPalette()
  const xBins = marginalBins(data.map((point) => point.x))
  const yBins = marginalBins(data.map((point) => point.y))
  const xMax = Math.max(...xBins, 1)
  const yMax = Math.max(...yBins, 1)

  return (
    <div className="marginal-plot">
      <div className="marginal-top">
        {xBins.map((count, index) => (
          <div
            key={index}
            className="marginal-bar-x"
            style={{ height: `${(count / xMax) * 100}%`, background: palette.primary }}
          />
        ))}
      </div>
      <div className="marginal-main">
        <ResponsiveContainer>
          <ScatterChart>
            <CartesianGrid stroke={palette.grid} />
            <XAxis dataKey="x" type="number" tick={{ fill: palette.axis, fontSize: 10 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
            <YAxis dataKey="y" type="number" tick={{ fill: palette.axis, fontSize: 10 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={chartTooltipStyle(palette)} />
            <Scatter data={data} fill={palette.secondary} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="marginal-side">
        {yBins.map((count, index) => (
          <div
            key={index}
            className="marginal-bar-y"
            style={{ width: `${(count / yMax) * 100}%`, background: palette.secondary }}
          />
        ))}
      </div>
    </div>
  )
}

export function NormalProbabilityPlot({ values }: { values: number[] }) {
  const palette = useChartPalette()
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const points = sorted.map((value, index) => {
    const percentile = (index + 0.5) / n
    const z = Math.sqrt(2) * inverseErf(2 * percentile - 1)
    return { z, value }
  })

  return (
    <div className="chart chart-mini">
      <ResponsiveContainer>
        <LineChart data={points}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="z" type="number" tick={{ fill: palette.axis, fontSize: 9 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <YAxis dataKey="value" type="number" tick={{ fill: palette.axis, fontSize: 9 }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <Tooltip contentStyle={chartTooltipStyle(palette)} />
          <Line type="monotone" dataKey="value" stroke={palette.primary} strokeWidth={2} dot={{ r: 2, fill: palette.primary }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function inverseErf(value: number): number {
  const sign = value < 0 ? -1 : 1
  const x = Math.abs(value)
  const t = Math.sqrt(Math.log(1 - x * x) * -2)
  const c0 = 2.515517
  const c1 = 0.802853
  const c2 = 0.010328
  const d1 = 1.432788
  const d2 = 0.189269
  const d3 = 0.001308
  return sign * (t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t))
}

export function MiniControlChart({
  data,
  center,
  ucl,
  lcl,
}: {
  data: Array<Record<string, string | number>>
  center: number
  ucl: number
  lcl: number
}) {
  const palette = useChartPalette()
  return (
    <div className="chart chart-mini">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: palette.axis, fontSize: 8 }} interval="preserveStartEnd" axisLine={{ stroke: palette.grid }} tickLine={false} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: palette.axis, fontSize: 8 }} width={28} axisLine={false} tickLine={false} />
          <Line type="monotone" dataKey="value" stroke={palette.primary} strokeWidth={1.5} dot={{ r: 2, fill: palette.primary }} />
          <ReferenceLine y={center} stroke={palette.secondary} strokeDasharray="3 3" />
          <ReferenceLine y={ucl} stroke={palette.limit} strokeDasharray="4 4" />
          <ReferenceLine y={lcl} stroke={palette.limit} strokeDasharray="4 4" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MiniHistogram({ values }: { values: number[] }) {
  const minimum = Math.min(...values)
  const width = (Math.max(...values) - minimum || 1) / 6
  const bins = Array.from({ length: 6 }, (_, index) => ({ label: String(index), value: 0 }))
  values.forEach((value) => { bins[Math.min(5, Math.floor((value - minimum) / width))].value += 1 })
  const palette = useChartPalette()
  return (
    <div className="chart chart-mini">
      <ResponsiveContainer>
        <BarChart data={bins}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" hide />
          <YAxis tick={{ fill: palette.axis, fontSize: 8 }} width={24} axisLine={false} tickLine={false} />
          <Bar dataKey="value" fill={palette.primary} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MiniCapabilityPlot({
  values,
  mean,
  sigma,
  lsl,
  usl,
}: {
  values: number[]
  mean: number
  sigma: number
  lsl: number
  usl: number
}) {
  const palette = useChartPalette()
  const minimum = Math.min(...values, lsl)
  const maximum = Math.max(...values, usl)
  const span = maximum - minimum || 1
  const binWidth = span / 8
  const bins = Array.from({ length: 8 }, (_, index) => {
    const start = minimum + index * binWidth
    return { label: String(index), count: 0, x: start + binWidth / 2 }
  })
  values.forEach((value) => {
    const index = Math.min(7, Math.floor((value - minimum) / binWidth))
    bins[index].count += 1
  })
  const curve = bins.map((bin) => {
    const y = sigma ? Math.exp(-0.5 * ((bin.x - mean) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI)) : 0
    return { ...bin, normal: y * values.length * binWidth }
  })

  return (
    <div className="chart chart-mini">
      <ResponsiveContainer>
        <ComposedChart data={curve}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" hide />
          <YAxis tick={{ fill: palette.axis, fontSize: 8 }} width={24} axisLine={false} tickLine={false} />
          <Bar dataKey="count" fill={palette.primary} radius={[2, 2, 0, 0]} />
          <Line type="monotone" dataKey="normal" stroke={palette.limit} strokeWidth={1.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MiniBarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const palette = useChartPalette()
  return (
    <div className="chart chart-mini">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: palette.axis, fontSize: 8 }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: palette.axis, fontSize: 8 }} width={28} axisLine={false} tickLine={false} />
          <Bar dataKey="value" fill={palette.secondary} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CapabilitySixpack({
  values,
  mean,
  sigma,
  lsl,
  usl,
  subgroupSize = 3,
}: {
  values: number[]
  mean: number
  sigma: number
  lsl: number
  usl: number
  subgroupSize?: number
}) {
  const xbarData = subgroupMeans(values, subgroupSize)
  const rData = subgroupRanges(values, subgroupSize)
  const xbarCenter = calculateMean(xbarData.map((point) => point.value))
  const xbarSigma = localStandardDeviation(xbarData.map((point) => point.value))
  const rCenter = calculateMean(rData.map((point) => point.value))
  const rSigma = localStandardDeviation(rData.map((point) => point.value))
  const recent = values.slice(-Math.min(12, values.length)).map((value, index) => ({
    label: `R${index + 1}`,
    value,
  }))

  const cells: Array<{ title: string; content: ReactNode }> = [
    {
      title: 'Xbar chart',
      content: (
        <MiniControlChart
          data={xbarData}
          center={xbarCenter}
          ucl={xbarCenter + 3 * xbarSigma}
          lcl={xbarCenter - 3 * xbarSigma}
        />
      ),
    },
    {
      title: 'R chart',
      content: (
        <MiniControlChart
          data={rData}
          center={rCenter}
          ucl={rCenter + 3 * rSigma}
          lcl={Math.max(0, rCenter - 3 * rSigma)}
        />
      ),
    },
    {
      title: 'Last 25 subgroups',
      content: <MiniBarChart data={recent} />,
    },
    { title: 'Histogram', content: <MiniHistogram values={values} /> },
    { title: 'Probability plot', content: <NormalProbabilityPlot values={values} /> },
    { title: 'Capability plot', content: <MiniCapabilityPlot values={values} mean={mean} sigma={sigma} lsl={lsl} usl={usl} /> },
  ]

  return (
    <div className="capability-sixpack">
      {cells.map((cell) => (
        <div key={cell.title} className="sixpack-cell">
          <h4 className="sixpack-cell-title">{cell.title}</h4>
          {cell.content}
        </div>
      ))}
    </div>
  )
}

export function BoxPlot({ values }: { values: number[] }) {
  const sorted = [...values].sort((a, b) => a - b)
  const at = (ratio: number) => sorted[Math.floor((sorted.length - 1) * ratio)] ?? 0
  const [min, q1, med, q3, max] = [at(0), at(0.25), at(0.5), at(0.75), at(1)]
  const range = max - min || 1
  const position = (value: number) => `${((value - min) / range) * 90 + 5}%`
  return (
    <div className="box-plot">
      <div className="whisker" style={{ left: position(min), right: `${100 - Number.parseFloat(position(max))}%` }} />
      <div className="box" style={{ left: position(q1), width: `${((q3 - q1) / range) * 90}%` }}>
        <span style={{ left: `${((med - q1) / (q3 - q1 || 1)) * 100}%` }} />
      </div>
      <small>{min.toFixed(2)}</small>
      <small>{max.toFixed(2)}</small>
    </div>
  )
}
