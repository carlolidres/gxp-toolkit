import { analyticalParameters, loadProductSectionWorkbook } from './productProfileWorkbook'

const ANALYTICAL_HEADER_ROWS = 3

export type CapabilityStats = {
  n: number
  mean: number
  stdev: number
  min: number
  max: number
  q1: number
  median: number
  q3: number
  movingRanges: number[]
  movingRangeBar: number
  individualUcl: number
  individualLcl: number
  movingRangeUcl: number
  withinSigma: number
  cp: number
  cpk: number
  pp: number
  ppk: number
  cpm: number
  ppmWithin: number
  ppmOverall: number
  andersonDarling: number
  andersonDarlingP: number
}

export type ProcessCapabilityReport = {
  id: string
  title: string
  parameter: string
  stage: string
  unit: string
  specification: string
  usl: number
  lsl: number
  target: number
  values: number[]
  stats: CapabilityStats | null
}

function meanOf(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function sampleStdev(values: number[], mean: number): number {
  if (values.length < 2) return 0
  const square = values.reduce((sum, value) => sum + (value - mean) ** 2, 0)
  return Math.sqrt(square / (values.length - 1))
}

function quantile(sorted: number[], fraction: number): number {
  if (sorted.length === 1) return sorted[0]
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] * (upper - position) + sorted[upper] * (position - lower)
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1
  const absolute = Math.abs(value)
  const t = 1 / (1 + 0.3275911 * absolute)
  const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
  return sign * (1 - polynomial * Math.exp(-absolute * absolute))
}

function normalCdf(value: number): number {
  return 0.5 * (1 + erf(value / Math.SQRT2))
}

function ppmBeyond(mean: number, sigma: number, lsl: number, usl: number): number {
  if (sigma <= 0) return 0
  const below = normalCdf((lsl - mean) / sigma)
  const above = 1 - normalCdf((usl - mean) / sigma)
  return (below + above) * 1_000_000
}

function andersonDarling(values: number[], mean: number, sigma: number): { statistic: number; p: number } {
  const sorted = [...values].sort((left, right) => left - right)
  const count = sorted.length
  let sum = 0
  for (let index = 0; index < count; index += 1) {
    const lower = Math.min(1 - 1e-12, Math.max(1e-12, normalCdf((sorted[index] - mean) / sigma)))
    const upper = Math.min(1 - 1e-12, Math.max(1e-12, normalCdf((sorted[count - 1 - index] - mean) / sigma)))
    sum += (2 * index + 1) * (Math.log(lower) + Math.log(1 - upper))
  }
  const statistic = -count - sum / count
  const adjusted = statistic * (1 + 0.75 / count + 2.25 / (count * count))
  const p = adjusted < 0.2
    ? 1 - Math.exp(-13.436 + 101.14 * adjusted - 223.73 * adjusted * adjusted)
    : adjusted < 0.34
      ? 1 - Math.exp(-8.318 + 42.796 * adjusted - 59.938 * adjusted * adjusted)
      : adjusted < 0.6
        ? Math.exp(0.9177 - 4.279 * adjusted - 1.38 * adjusted * adjusted)
        : Math.exp(1.2937 - 5.709 * adjusted + 0.0186 * adjusted * adjusted)
  return { statistic, p: Math.min(1, Math.max(0, p)) }
}

export function capabilityStats(values: number[], lsl: number, usl: number): CapabilityStats | null {
  if (values.length < 2 || !Number.isFinite(lsl) || !Number.isFinite(usl) || usl <= lsl) return null
  const mean = meanOf(values)
  const stdev = sampleStdev(values, mean)
  const sorted = [...values].sort((left, right) => left - right)
  const movingRanges = values.slice(1).map((value, index) => Math.abs(value - values[index]))
  const movingRangeBar = meanOf(movingRanges)
  const withinSigma = movingRangeBar / 1.128
  const target = (usl + lsl) / 2
  const spread = usl - lsl
  const distance = Math.min(usl - mean, mean - lsl)
  const goodness = andersonDarling(values, mean, stdev || withinSigma)
  return {
    n: values.length,
    mean,
    stdev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    movingRanges,
    movingRangeBar,
    individualUcl: mean + movingRangeBar * 2.66,
    individualLcl: mean - movingRangeBar * 2.66,
    movingRangeUcl: movingRangeBar * 3.267,
    withinSigma,
    cp: withinSigma > 0 ? spread / (6 * withinSigma) : 0,
    cpk: withinSigma > 0 ? distance / (3 * withinSigma) : 0,
    pp: stdev > 0 ? spread / (6 * stdev) : 0,
    ppk: stdev > 0 ? distance / (3 * stdev) : 0,
    cpm: stdev > 0 ? spread / (6 * Math.sqrt(stdev ** 2 + (mean - target) ** 2)) : 0,
    ppmWithin: ppmBeyond(mean, withinSigma, lsl, usl),
    ppmOverall: ppmBeyond(mean, stdev, lsl, usl),
    andersonDarling: goodness.statistic,
    andersonDarlingP: goodness.p,
  }
}

function numericResults(sheet: { cells?: Record<string, string> }, column: number): number[] {
  const rows = Object.keys(sheet.cells ?? {}).flatMap((key) => {
    const [row, cellColumn] = key.split(':').map(Number)
    return cellColumn === 1 && row >= ANALYTICAL_HEADER_ROWS && String(sheet.cells?.[key] ?? '').trim() ? [row] : []
  }).sort((left, right) => left - right)
  return rows.flatMap((row) => {
    const text = String(sheet.cells?.[`${row}:${column}`] ?? '').trim().replace(/,/g, '')
    const value = Number(text)
    return text && Number.isFinite(value) ? [value] : []
  })
}

export const CAPABILITY_RECENT_COUNT = 30

export type CapabilityScope = 'all' | 'latest-30'

export type CapabilityInference = {
  boxplot: string[]
  sixpack: string[]
}

export function scopedCapabilityValues(values: number[], scope: CapabilityScope): number[] {
  return scope === 'latest-30' ? values.slice(-30) : values
}

function formatStat(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const absolute = Math.abs(value)
  if (absolute >= 100) return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (absolute >= 1) return value.toFixed(2)
  return value.toFixed(4)
}

function withUnit(value: string, unit: string): string {
  return unit ? `${value} ${unit}` : value
}

export function capabilityInference(
  report: Pick<ProcessCapabilityReport, 'parameter' | 'stage' | 'unit' | 'lsl' | 'usl' | 'target'>,
  values: number[],
  stats: CapabilityStats | null,
  scope: CapabilityScope,
  total: number,
): CapabilityInference {
  const unit = report.unit
  const windowText = scope === 'latest-30'
    ? total > 30
      ? `the latest 30 of ${total} numeric results, taken in Analytical Report row order`
      : `all ${total} numeric results, because fewer than 30 are stored`
    : `all ${total} numeric results stored for this parameter`
  if (!stats) {
    const waiting = `${report.parameter} on ${report.stage} has ${values.length} numeric result${values.length === 1 ? '' : 's'} in ${windowText}. At least two numeric results are needed before a boxplot or sixpack inference can be made.`
    return { boxplot: [waiting], sixpack: [waiting] }
  }
  const below = values.filter((value) => value < report.lsl).length
  const above = values.filter((value) => value > report.usl).length
  const within = values.length - below - above
  const onLimit = values.filter((value) => value === report.lsl || value === report.usl).length
  const nearer = report.usl - stats.mean < stats.mean - report.lsl ? 'USL' : report.usl - stats.mean > stats.mean - report.lsl ? 'LSL' : 'both specification limits equally'
  const iOutside = values.filter((value) => value > stats.individualUcl || value < stats.individualLcl).length
  const mrOutside = stats.movingRanges.filter((value) => value > stats.movingRangeUcl).length
  const recent = values.slice(-CAPABILITY_RECENT_COUNT)
  const conformance = within === values.length
    ? `All ${values.length} analyzed results are inside ${withUnit(formatStat(report.lsl), unit)} to ${withUnit(formatStat(report.usl), unit)} inclusive${onLimit ? `, and ${onLimit} of them ${onLimit === 1 ? 'equals' : 'equal'} a specification limit` : ''}.`
    : `${within} of ${values.length} analyzed results are inside the numeric limits. ${below} ${below === 1 ? 'is' : 'are'} below the LSL and ${above} ${above === 1 ? 'is' : 'are'} above the USL.`
  const boxplot = [
    `This boxplot summarizes ${windowText} for ${report.parameter} on the ${report.stage} stage. The box runs from the first quartile, ${withUnit(formatStat(stats.q1), unit)}, to the third quartile, ${withUnit(formatStat(stats.q3), unit)}. The center line is the median, ${withUnit(formatStat(stats.median), unit)}. The whiskers are the minimum, ${withUnit(formatStat(stats.min), unit)}, and the maximum, ${withUnit(formatStat(stats.max), unit)}. This plot draws the whiskers to those extremes and does not apply a separate outlier rule.`,
    `The median is ${stats.median === report.target ? 'at' : stats.median > report.target ? 'above' : 'below'} the specification midpoint of ${withUnit(formatStat(report.target), unit)}. That midpoint is calculated from the LSL and USL; it is not a separately approved process target. The mean, ${withUnit(formatStat(stats.mean), unit)}, is nearer the ${nearer}. ${conformance} The boxplot does not assess statistical stability, normality, or process capability, and it does not show whether an unplotted batch would conform.`,
  ]
  const limitSentence = iOutside === 0
    ? `No analyzed result fell outside the Individuals limits of ${withUnit(formatStat(stats.individualLcl), unit)} to ${withUnit(formatStat(stats.individualUcl), unit)}.`
    : `${iOutside} analyzed result${iOutside === 1 ? '' : 's'} fell outside the Individuals limits of ${withUnit(formatStat(stats.individualLcl), unit)} to ${withUnit(formatStat(stats.individualUcl), unit)}.`
  const mrSentence = mrOutside === 0
    ? `No moving range exceeded the moving-range upper limit of ${withUnit(formatStat(stats.movingRangeUcl), unit)}. The moving-range lower limit is 0.`
    : `${mrOutside} moving range${mrOutside === 1 ? '' : 's'} exceeded the moving-range upper limit of ${withUnit(formatStat(stats.movingRangeUcl), unit)}. A moving-range signal is an unusually large change between successive results in sheet order. It is not, by itself, a result outside the specification, and the chart does not identify the cause.`
  const controlSentence = iOutside === 0 && mrOutside === 0
    ? 'Only the comparison with these calculated limits was assessed. Runs on one side of the centerline and steady trends were not tested. The absence of a limit exceedance does not demonstrate that the process is stable.'
    : 'A limit signal was detected, so statistical control is not demonstrated for this sequence. The capability indices below remain descriptive estimates while that signal is unresolved.'
  const normality = stats.andersonDarlingP > 0.05
    ? `The Anderson–Darling statistic is ${formatStat(stats.andersonDarling)} and the approximate p-value is ${formatStat(stats.andersonDarlingP)}. At the conventional 5% level this is a failure to reject a normal model. It is not evidence that the results are normally distributed.`
    : `The Anderson–Darling statistic is ${formatStat(stats.andersonDarling)} and the approximate p-value is ${formatStat(stats.andersonDarlingP)}. At the conventional 5% level this is evidence against a normal model under the test assumptions. The probability plot should be read with the sample size and the sheet order in mind.`
  const sixpack = [
    `The sixpack uses ${windowText}. The sequence is Analytical Report row order, not a confirmed manufacturing time. Each point is one numeric result for ${report.parameter}${unit ? ` (${unit})` : ''}. With ${stats.n} result${stats.n === 1 ? '' : 's'}, the indices are provisional estimates. No confidence interval was calculated.`,
    `Individuals chart: the centerline is the mean, ${withUnit(formatStat(stats.mean), unit)}. ${limitSentence} These limits are statistical monitoring limits, calculated as the mean plus or minus 2.66 times the average moving range. They are not the specification limits.`,
    `Moving range chart: the centerline is ${withUnit(formatStat(stats.movingRangeBar), unit)}. ${mrSentence} ${controlSentence}`,
    `Last ${CAPABILITY_RECENT_COUNT} observations: the panel shows ${recent.length} result${recent.length === 1 ? '' : 's'}${values.length > CAPABILITY_RECENT_COUNT ? `, the latest ${CAPABILITY_RECENT_COUNT} in the selected window` : ', which is the full selected window'}. The earliest value in that panel is ${withUnit(formatStat(recent[0]), unit)} and the latest is ${withUnit(formatStat(recent[recent.length - 1]), unit)}. No separate run test was applied to this panel.`,
    `Capability histogram: the bars are the observed results across the specification range. The curves are fitted normal models, one from the within standard deviation and one from the overall standard deviation. The curves are not additional measurements. The solid red lines are the LSL and USL, and the dashed line is the specification midpoint.`,
    `Normal probability plot: ${normality} A normality result does not overrule a control-chart signal, and ${stats.n} results give limited information about the extreme tails.`,
    `Capability: Cp ${formatStat(stats.cp)} describes the specification width against the within standard deviation, ${withUnit(formatStat(stats.withinSigma), unit)}, and does not penalize where the mean sits. Cpk ${formatStat(stats.cpk)} uses the nearer specification limit. Pp ${formatStat(stats.pp)} and Ppk ${formatStat(stats.ppk)} use the overall sample standard deviation, ${withUnit(formatStat(stats.stdev), unit)}. Cpm ${formatStat(stats.cpm)} also uses the specification midpoint. The difference between the within and overall standard deviations is not attributed to a specific cause. The modeled PPM figures, ${formatStat(stats.ppmWithin)} within and ${formatStat(stats.ppmOverall)} overall, are normal-tail estimates. They are not observed out-of-specification counts. ${conformance}`,
    'No approved Cpk or Ppk acceptance criterion is stored for this parameter. The value 1.33 is only an illustrative industry reference. It is not a regulatory requirement and it is not a site acceptance limit. Results inside the specification do not establish process capability.',
  ]
  return { boxplot, sixpack }
}

export function processCapabilityReports(productId: string): ProcessCapabilityReport[] {
  const workbook = loadProductSectionWorkbook(productId, 'analytical-report')
  const found: ProcessCapabilityReport[] = []
  for (const sheet of workbook.sheets) {
    const stage = sheet.name.trim() || 'Sheet'
    for (const parameter of analyticalParameters(sheet)) {
      if (parameter.kind !== 'quantitative') continue
      const name = parameter.name.trim()
      if (!name || name === '[Parameter]') continue
      const usl = Number(parameter.usl)
      const lsl = Number(parameter.lsl)
      if (!Number.isFinite(usl) || !Number.isFinite(lsl) || usl <= lsl) continue
      const unit = parameter.unit === '[Unit of Measurement]' ? '' : parameter.unit
      const specification = parameter.specification === '[Specification]' ? '' : parameter.specification
      const values = numericResults(sheet, parameter.column)
      found.push({
        id: `${sheet.id}:${parameter.column}`,
        title: name,
        parameter: name,
        stage,
        unit,
        specification,
        usl,
        lsl,
        target: (usl + lsl) / 2,
        values,
        stats: capabilityStats(values, lsl, usl),
      })
    }
  }
  const counts = new Map<string, number>()
  for (const report of found) {
    const key = report.parameter.toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return found.map((report) => {
    const shared = (counts.get(report.parameter.toLowerCase()) ?? 0) > 1
    const title = shared ? `${report.parameter} (${report.stage})` : report.parameter
    return { ...report, title: title.length > 31 ? `${title.slice(0, 31).trim()}` : title }
  })
}
