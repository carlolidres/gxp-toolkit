import type { ProcessSpecification, StatisticalAlert, StatisticalSummary } from '../../types/statistics'

function formatMetric(value: number): string {
  return value.toFixed(value % 1 ? 2 : 0)
}

export function StatisticalSummaryGrid({ summary }: { summary: StatisticalSummary }) {
  const metrics: Array<[string, string]> = [
    ['Mean', formatMetric(summary.mean)],
    ['Median', formatMetric(summary.median)],
    ['Std. deviation', formatMetric(summary.standardDeviation)],
    ['Minimum', formatMetric(summary.minimum)],
    ['Maximum', formatMetric(summary.maximum)],
    ['Cp', formatMetric(summary.cp)],
    ['Cpk', formatMetric(summary.cpk)],
    ['Pp', formatMetric(summary.pp)],
    ['Ppk', formatMetric(summary.ppk)],
    ['Out of spec', String(summary.outOfSpec)],
    ['Out of control', String(summary.outOfControl)],
    ['Trend signals', String(summary.outOfTrend)],
  ]

  return (
    <div className="stat-grid">
      {metrics.map(([label, value]) => (
        <div key={label} className="stat-cell">
          <span className="stat-label">{label}</span>
          <strong className="stat-value">{value}</strong>
        </div>
      ))}
    </div>
  )
}

export function CapabilityStatsPanel({
  summary,
  specification,
}: {
  summary: StatisticalSummary
  specification: ProcessSpecification
}) {
  const rows: Array<{ label: string; within: string; overall: string }> = [
    { label: 'StDev', within: formatMetric(summary.standardDeviation), overall: formatMetric(summary.standardDeviation) },
    { label: 'Cp', within: formatMetric(summary.cp), overall: formatMetric(summary.pp) },
    { label: 'Cpk', within: formatMetric(summary.cpk), overall: formatMetric(summary.ppk) },
  ]

  return (
    <div className="capability-stats">
      <div className="capability-stats-header">
        <span>Process capability</span>
        <small>{specification.parameter} ({specification.unit})</small>
      </div>
      <table className="capability-stats-table">
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Within</th>
            <th scope="col">Overall</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.within}</td>
              <td>{row.overall}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="capability-stats-grid">
        <div className="stat-cell"><span className="stat-label">Mean</span><strong className="stat-value">{formatMetric(summary.mean)}</strong></div>
        <div className="stat-cell"><span className="stat-label">Median</span><strong className="stat-value">{formatMetric(summary.median)}</strong></div>
        <div className="stat-cell"><span className="stat-label">Minimum</span><strong className="stat-value">{formatMetric(summary.minimum)}</strong></div>
        <div className="stat-cell"><span className="stat-label">Maximum</span><strong className="stat-value">{formatMetric(summary.maximum)}</strong></div>
        <div className="stat-cell"><span className="stat-label">LSL</span><strong className="stat-value">{formatMetric(specification.lsl)}</strong></div>
        <div className="stat-cell"><span className="stat-label">USL</span><strong className="stat-value">{formatMetric(specification.usl)}</strong></div>
        <div className="stat-cell"><span className="stat-label">Out of spec</span><strong className="stat-value">{summary.outOfSpec}</strong></div>
        <div className="stat-cell"><span className="stat-label">Out of control</span><strong className="stat-value">{summary.outOfControl}</strong></div>
      </div>
    </div>
  )
}

export function StatisticalAlertPanel({ alerts }: { alerts: StatisticalAlert[] }) {
  return (
    <div className="alert-list">
      {alerts.map((alert) => (
        <article className={`alert ${alert.severity}`} key={alert.id}>
          <span>{alert.severity === 'critical' ? '!' : alert.severity === 'warning' ? '△' : 'i'}</span>
          <div>
            <strong>{alert.title}</strong>
            <p>{alert.message}</p>
          </div>
        </article>
      ))}
    </div>
  )
}
