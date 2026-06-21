import type {
  ProcessSpecification,
  StatisticalAlert,
  StatisticalSummary,
} from '../types/statistics'

export function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function standardDeviation(values: number[], sample = true): number {
  if (values.length < (sample ? 2 : 1)) return 0
  const average = mean(values)
  const divisor = sample ? values.length - 1 : values.length
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / divisor)
}

export function movingRange(values: number[]): number[] {
  return values.slice(1).map((value, index) => Math.abs(value - values[index]))
}

export function minimum(values: number[]): number {
  return values.length ? Math.min(...values) : 0
}

export function maximum(values: number[]): number {
  return values.length ? Math.max(...values) : 0
}

export function controlLimits(values: number[]): { center: number; ucl: number; lcl: number } {
  const center = mean(values)
  const sigma = standardDeviation(values)
  return { center, ucl: center + 3 * sigma, lcl: center - 3 * sigma }
}

export function cp(values: number[], lsl: number, usl: number): number {
  const sigma = standardDeviation(values)
  return sigma ? (usl - lsl) / (6 * sigma) : 0
}

export function cpk(values: number[], lsl: number, usl: number): number {
  const sigma = standardDeviation(values)
  if (!sigma) return 0
  const average = mean(values)
  return Math.min((usl - average) / (3 * sigma), (average - lsl) / (3 * sigma))
}

export function outOfSpec(values: number[], lsl: number, usl: number): number[] {
  return values.reduce<number[]>((indexes, value, index) => {
    if (value < lsl || value > usl) indexes.push(index)
    return indexes
  }, [])
}

export function outOfControl(values: number[]): number[] {
  const { lcl, ucl } = controlLimits(values)
  return values.reduce<number[]>((indexes, value, index) => {
    if (value < lcl || value > ucl) indexes.push(index)
    return indexes
  }, [])
}

export function detectConsecutiveTrend(values: number[], length = 6): 'upward' | 'downward' | null {
  if (values.length < length) return null
  const recent = values.slice(-length)
  if (recent.every((value, index) => index === 0 || value > recent[index - 1])) return 'upward'
  if (recent.every((value, index) => index === 0 || value < recent[index - 1])) return 'downward'
  return null
}

export function calculateSummary(
  values: number[],
  specification: Pick<ProcessSpecification, 'lsl' | 'usl'>,
): StatisticalSummary {
  const trends = detectConsecutiveTrend(values) ? 1 : 0
  const capability = cp(values, specification.lsl, specification.usl)
  const performance = cpk(values, specification.lsl, specification.usl)
  return {
    mean: mean(values),
    median: median(values),
    standardDeviation: standardDeviation(values),
    minimum: minimum(values),
    maximum: maximum(values),
    cp: capability,
    cpk: performance,
    pp: capability,
    ppk: performance,
    outOfSpec: outOfSpec(values, specification.lsl, specification.usl).length,
    outOfControl: outOfControl(values).length,
    outOfTrend: trends,
  }
}

export function linearRegression(points: Array<{ x: number; y: number }>): { slope: number; intercept: number; rSquared: number } {
  if (points.length < 2) return { slope: 0, intercept: 0, rSquared: 0 }
  const n = points.length
  const sumX = points.reduce((sum, point) => sum + point.x, 0)
  const sumY = points.reduce((sum, point) => sum + point.y, 0)
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0)
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0)
  const denominator = n * sumXX - sumX * sumX
  const slope = denominator ? (n * sumXY - sumX * sumY) / denominator : 0
  const intercept = (sumY - slope * sumX) / n
  const meanY = sumY / n
  const ssTot = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0)
  const ssRes = points.reduce((sum, point) => sum + (point.y - (slope * point.x + intercept)) ** 2, 0)
  const rSquared = ssTot ? 1 - ssRes / ssTot : 0
  return { slope, intercept, rSquared }
}

export function subgroupMeans(values: number[], size: number): Array<{ label: string; value: number }> {
  const groups: number[][] = []
  for (let index = 0; index < values.length; index += size) {
    const group = values.slice(index, index + size)
    if (group.length === size) groups.push(group)
  }
  return groups.map((group, index) => ({
    label: `S${index + 1}`,
    value: mean(group),
  }))
}

export function subgroupRanges(values: number[], size: number): Array<{ label: string; value: number }> {
  const groups: number[][] = []
  for (let index = 0; index < values.length; index += size) {
    const group = values.slice(index, index + size)
    if (group.length === size) groups.push(group)
  }
  return groups.map((group, index) => ({
    label: `S${index + 1}`,
    value: maximum(group) - minimum(group),
  }))
}
export function buildStatisticalAlerts(
  values: number[],
  specification: ProcessSpecification,
): StatisticalAlert[] {
  if (!values.length) {
    return [{ id: 'missing', severity: 'warning', title: 'Missing data', message: 'Add process readings to calculate performance.' }]
  }

  const alerts: StatisticalAlert[] = []
  const specIndexes = outOfSpec(values, specification.lsl, specification.usl)
  const controlIndexes = outOfControl(values)
  const trend = detectConsecutiveTrend(values)
  const capability = cpk(values, specification.lsl, specification.usl)

  if (specIndexes.length) alerts.push({ id: 'spec', severity: 'critical', title: 'Specification excursion', message: `${specIndexes.length} reading(s) are outside ${specification.lsl}-${specification.usl} ${specification.unit}.` })
  if (controlIndexes.length) alerts.push({ id: 'control', severity: 'critical', title: 'Control limit signal', message: `${controlIndexes.length} reading(s) require investigation against calculated control limits.` })
  if (trend) alerts.push({ id: 'trend', severity: 'warning', title: `${trend[0].toUpperCase()}${trend.slice(1)} trend`, message: `The last six readings show a consecutive ${trend} pattern.` })
  if (capability < 1.33) alerts.push({ id: 'cpk', severity: 'warning', title: 'Capability below target', message: `Cpk is ${capability.toFixed(2)}; the example acceptance target is 1.33.` })
  if (!alerts.length) alerts.push({ id: 'stable', severity: 'info', title: 'Process appears stable', message: 'No specification, control, trend, or capability alerts were detected.' })
  return alerts
}

