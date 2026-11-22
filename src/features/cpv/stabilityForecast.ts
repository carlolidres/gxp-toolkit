import type { EquipmentSheet } from '../vmp/equipmentWorkbook'

export type StabilityPoint = { months: number; label: string; value: number }

export type StabilityCurvePoint = { months: number; mean: number; lower: number; upper: number }

export type StabilityForecast = {
  batch: string
  status: 'insufficient_data' | 'exploratory' | 'monitoring'
  model: 'none' | 'zero-order' | 'first-order' | 'indeterminate'
  inference: string
  horizon: number
  interval: 'mean' | 'none'
  curve: StabilityCurvePoint[]
  rows: Array<{ label: string; mean: number; lower: number; upper: number; extrapolated: boolean }>
}

export type StabilitySeries = {
  column: number
  name: string
  ucl: number
  lcl: number
  points: StabilityPoint[]
}

export type StabilityTrend = {
  title: string
  unit: string
  usl: number | null
  lsl: number | null
  median: number
  series: StabilitySeries[]
  forecasts: StabilityForecast[]
}

const T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042]

function tCritical(df: number): number {
  if (df < 1) return Number.NaN
  if (df <= T975.length) return T975[df - 1]
  return 1.96
}

export function stabilityMonths(label: string): number | null {
  const text = label.trim()
  if (/^initial$/i.test(text)) return 0
  const match = /^(\d+)\s*months?$/i.exec(text)
  return match ? Number(match[1]) : null
}

function fitLine(points: StabilityPoint[]): { b0: number; b1: number; s: number; meanT: number; sxx: number } | null {
  const n = points.length
  if (n < 2) return null
  const meanT = points.reduce((sum, point) => sum + point.months, 0) / n
  const meanY = points.reduce((sum, point) => sum + point.value, 0) / n
  let sxx = 0
  let sxy = 0
  for (const point of points) {
    sxx += (point.months - meanT) ** 2
    sxy += (point.months - meanT) * (point.value - meanY)
  }
  if (sxx === 0) return null
  const b1 = sxy / sxx
  const b0 = meanY - b1 * meanT
  if (n < 3) return { b0, b1, s: Number.NaN, meanT, sxx }
  let residual = 0
  for (const point of points) residual += (point.value - (b0 + b1 * point.months)) ** 2
  return { b0, b1, s: Math.sqrt(residual / (n - 2)), meanT, sxx }
}

function rmse(points: StabilityPoint[], predict: (months: number) => number): number {
  const total = points.reduce((sum, point) => sum + (point.value - predict(point.months)) ** 2, 0)
  return Math.sqrt(total / points.length)
}

function fitLog(points: StabilityPoint[]): { a: number; k: number } | null {
  if (points.some((point) => point.value <= 0)) return null
  const logged = points.map((point) => ({ ...point, value: Math.log(point.value) }))
  const line = fitLine(logged)
  if (!line) return null
  return { a: line.b0, k: -line.b1 }
}

function movingBand(values: number[]): { ucl: number; lcl: number } {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  if (values.length < 2) return { ucl: mean, lcl: mean }
  let range = 0
  for (let index = 1; index < values.length; index += 1) range += Math.abs(values[index] - values[index - 1])
  const band = (range / (values.length - 1)) * 2.66
  return { ucl: mean + band, lcl: mean - band }
}

function ticks(low: number, high: number): { yMin: number; yMax: number; ticks: number[] } {
  const span = Math.max(high - low, 1e-6)
  const rough = span / 6
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  const step = nice * power
  const yMin = Math.floor((low + step * 1e-8) / step) * step
  const yMax = Math.ceil((high - step * 1e-8) / step) * step
  const marks: number[] = []
  for (let value = yMin; value <= yMax + step * 0.5; value += step) marks.push(Math.round(value * 1e8) / 1e8)
  return { yMin, yMax: Math.max(yMax, yMin + step), ticks: marks }
}

function boundText(months: number | null): string {
  if (months == null) return 'The 95% confidence limit for the mean cannot reliably be estimated to intersect a specification.'
  return `The two-sided 95% confidence limit for the mean meets a specification at about ${months.toFixed(1)} months. That crossing is a statistical estimate, not an approved expiry.`
}

export function forecastStabilitySeries(batch: string, attribute: string, unit: string, points: StabilityPoint[], limits: { usl: number | null; lsl: number | null }): StabilityForecast {
  const distinct = new Set(points.map((point) => point.months)).size
  const last = points.at(-1)?.months ?? 0
  const observed = `Results through ${last} months for ${batch || 'this batch'} on ${attribute || 'this attribute'}`
  if (distinct < 3) {
    return {
      batch,
      status: 'insufficient_data',
      model: 'none',
      horizon: last,
      interval: 'none',
      curve: [],
      rows: [],
      inference: `${observed} include ${distinct} distinct time point${distinct === 1 ? '' : 's'}. There is insufficient evidence to estimate a reliable degradation rate or an inferential shelf life. The readings can be monitored, and the forecast does not change the approved shelf life.`,
    }
  }
  const line = fitLine(points)
  const log = fitLog(points)
  if (!line) {
    return {
      batch,
      status: 'insufficient_data',
      model: 'none',
      horizon: last,
      interval: 'none',
      curve: [],
      rows: [],
      inference: `${observed} do not support a slope because the time points do not vary. No shelf-life change is implied.`,
    }
  }
  const linearError = rmse(points, (months) => line.b0 + line.b1 * months)
  const logError = log ? rmse(points, (months) => Math.exp(log.a - log.k * months)) : Number.POSITIVE_INFINITY
  const preferLog = log != null && logError < linearError * 0.9
  const model = preferLog ? 'first-order' : Math.abs(linearError - logError) / Math.max(linearError, 1e-9) < 0.1 && log ? 'indeterminate' : 'zero-order'
  const predict = (months: number) => preferLog && log ? Math.exp(log.a - log.k * months) : line.b0 + line.b1 * months
  const df = points.length - 2
  const t = tCritical(df)
  const rate = preferLog && log
    ? `${log.k.toFixed(4)} per month on the log scale`
    : `${line.b1.toFixed(4)} ${unit || 'units'} per month`
  const rows = points.map((point) => {
    const mean = predict(point.months)
    const se = Number.isFinite(line.s) ? line.s * Math.sqrt(1 / points.length + (point.months - line.meanT) ** 2 / line.sxx) : Number.NaN
    const half = Number.isFinite(se) ? t * se : Number.NaN
    return { label: point.label, mean, lower: mean - half, upper: mean + half, extrapolated: false }
  })
  const future = last + 3
  const futureMean = predict(future)
  const futureSe = Number.isFinite(line.s) ? line.s * Math.sqrt(1 / points.length + (future - line.meanT) ** 2 / line.sxx) : Number.NaN
  const futureHalf = Number.isFinite(futureSe) ? t * futureSe : Number.NaN
  rows.push({ label: `${future} Months`, mean: futureMean, lower: futureMean - futureHalf, upper: futureMean + futureHalf, extrapolated: true })
  const interval = preferLog || !Number.isFinite(line.s) ? 'none' : 'mean'
  const samples = new Set<number>([0, last, future, ...points.map((point) => point.months)])
  for (let month = 0; month <= future; month += 1) samples.add(month)
  const curve = [...samples].sort((left, right) => left - right).map((months) => {
    const mean = predict(months)
    const se = interval === 'mean' ? line.s * Math.sqrt(1 / points.length + (months - line.meanT) ** 2 / line.sxx) : Number.NaN
    const half = Number.isFinite(se) ? t * se : 0
    return { months, mean, lower: mean - half, upper: mean + half }
  })
  let crossing: number | null = null
  if (Number.isFinite(line.s) && (limits.lsl != null || limits.usl != null)) {
    for (let month = 0; month <= Math.max(last * 2, last + 12); month += 0.05) {
      const mean = predict(month)
      const se = line.s * Math.sqrt(1 / points.length + (month - line.meanT) ** 2 / line.sxx)
      const lower = mean - t * se
      const upper = mean + t * se
      if ((limits.lsl != null && lower <= limits.lsl) || (limits.usl != null && upper >= limits.usl)) {
        crossing = month
        break
      }
    }
  }
  const status = points.length < 4 ? 'exploratory' : 'monitoring'
  const hasLimits = limits.lsl != null || limits.usl != null
  const conformance = !hasLimits
    ? 'No USL or LSL has been entered, so conformance to a specification was not assessed.'
    : points.every((point) => (limits.lsl == null || point.value >= limits.lsl) && (limits.usl == null || point.value <= limits.usl))
      ? 'The results stayed inside the entered USL and LSL.'
      : 'A result is outside the entered USL or LSL.'
  const adequacy = model === 'indeterminate'
    ? 'Zero-order and first-order fits are too close to confirm a mechanism, so the operational forecast keeps the zero-order line.'
    : model === 'first-order'
      ? 'A first-order curve fitted the original-scale results more closely than a straight line. The back-transformed value is an operational estimate, not a confirmed mean on the original scale.'
      : 'A zero-order line was used because the series does not justify a more complex mechanism.'
  return {
    batch,
    status,
    model: preferLog ? 'first-order' : model,
    horizon: last,
    interval,
    curve,
    rows,
    inference: `${observed}. ${conformance} ${adequacy} The fitted change is ${rate}. The ${future} month value is an extrapolated operational forecast, not an observation. ${boundText(crossing)} ${status === 'exploratory' ? 'Three time points make this forecast exploratory.' : 'The series is long enough to monitor, and it is still not a formal shelf-life assessment.'} No change to the approved shelf life is implied.`,
  }
}

function studyColumns(sheet: EquipmentSheet): number[] {
  return Object.keys(sheet.snippets ?? {})
    .map((key) => /^stability-study:(\d+)$/.exec(key)?.[1])
    .map((value) => Number(value))
    .filter((column) => column >= 1)
    .sort((left, right) => left - right)
}

export function stabilityScale(values: number[]): { yMin: number; yMax: number; ticks: number[] } {
  const finite = values.filter((value) => Number.isFinite(value))
  if (!finite.length) return { yMin: 0, yMax: 1, ticks: [0, 1] }
  return ticks(Math.min(...finite), Math.max(...finite))
}

export function stabilityTimeTicks(min: number, max: number): number[] {
  const span = Math.max(max - min, 1)
  const steps = [1, 3, 6, 12, 24, 36, 48, 60]
  const step = steps.find((item) => span / item <= 6) ?? Math.ceil(span / 6)
  const marks: number[] = []
  const start = Math.ceil((min - 1e-9) / step) * step
  for (let month = start; month <= max + 1e-9; month += step) {
    const normalized = Math.round(month * 1000) / 1000
    marks.push(normalized === 0 ? 0 : normalized)
  }
  if (!marks.length || marks[0] - min > 1e-9) marks.unshift(min)
  if (max - marks[marks.length - 1] > step * 0.45) marks.push(max)
  return marks
}

export function stabilityTrend(sheet: EquipmentSheet): StabilityTrend {
  const parameter = String(sheet.snippets?.['stability-parameter'] ?? '').trim()
  const unit = String(sheet.snippets?.['stability-unit'] ?? '').trim()
  const title = parameter && unit ? `${parameter} (${unit})` : 'Parameter'
  const usl = Number(sheet.snippets?.['stability-usl'])
  const lsl = Number(sheet.snippets?.['stability-lsl'])
  const limits = { usl: Number.isFinite(usl) ? usl : null, lsl: Number.isFinite(lsl) ? lsl : null }
  const timepoints = Object.entries(sheet.cells)
    .map(([key, value]) => {
      const [row, column] = key.split(':').map(Number)
      return { row, column, label: String(value ?? '').trim() }
    })
    .filter((cell) => cell.column === 0 && cell.row >= 2 && cell.label && stabilityMonths(cell.label) != null)
    .sort((left, right) => left.row - right.row)
  const columns = studyColumns(sheet)
  const series = columns.map((column) => {
    const raw = sheet.snippets?.[`stability-study:${column}`]
    let batch = String(sheet.cells[`1:${column}`] ?? '').trim() || `Column ${column}`
    try {
      const parsed = raw ? JSON.parse(raw) as { poControlNo?: string } : null
      if (parsed?.poControlNo?.trim()) batch = parsed.poControlNo.trim()
    } catch {
      // Keep the column label when the stored study is not JSON.
    }
    const points = timepoints.flatMap((timepoint) => {
      const value = Number(String(sheet.cells[`${timepoint.row}:${column}`] ?? '').trim())
      const months = stabilityMonths(timepoint.label)
      return Number.isFinite(value) && months != null ? [{ months, label: timepoint.label, value }] : []
    })
    return { column, batch, points }
  }).filter((item) => item.points.length)
  const forecasts = series.map((item) => forecastStabilitySeries(item.batch, title, unit, item.points, limits))
  const plotted = series.map((item) => {
    const values = item.points.map((point) => point.value)
    const band = movingBand(values)
    return { column: item.column, name: item.batch, ucl: band.ucl, lcl: band.lcl, points: item.points }
  })
  const values = plotted.flatMap((item) => item.points.map((point) => point.value))
  const ordered = values.slice().sort((left, right) => left - right)
  const median = limits.usl != null && limits.lsl != null ? (limits.usl + limits.lsl) / 2 : ordered[Math.floor(ordered.length / 2)] ?? 0
  return { title, unit, usl: limits.usl, lsl: limits.lsl, median, series: plotted, forecasts }
}
