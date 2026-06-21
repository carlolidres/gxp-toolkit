import type { ReactNode } from 'react'

import {
  BoxPlot,
  CapabilityPlot,
  CapabilitySixpack,
  ContourPlot,
  ControlChart,
  DistributionPlot,
  DonutChart,
  HeatMapChart,
  Histogram,
  MarginalPlot,
  ParetoChart,
  ResidualPlot,
  ScatterPlot,
  ScatterWithRegression,
  SimpleBarChart,
  TrendChart,
} from '../components/charts/Charts'
import { CapabilityStatsPanel } from '../components/statistics/StatisticalComponents'
import {
  assayCorrelationLabels,
  buildMockCorrelationMatrix,
  initialProcessPoints,
  processSpecifications,
} from '../data/mockProcessData'
import { calculateSummary } from '../utils/statistics'
import { useScrollToHash } from '../hooks/useScrollToHash'

function MinitabChartCard({ title, children, large = false }: { title: string; children: ReactNode; large?: boolean }) {
  return (
    <article className={`minitab-chart-card${large ? ' minitab-chart-card-large' : ''}`}>
      <h3 className="minitab-chart-title">{title}</h3>
      <div className="minitab-chart-body">{children}</div>
    </article>
  )
}

function MinitabCategory({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="minitab-category page-section" id={id}>
      <h2 className="minitab-category-title">{title}</h2>
      <div className="minitab-chart-gallery">{children}</div>
    </section>
  )
}

export function StatisticsDashboardPage() {
  useScrollToHash()
  const specification = processSpecifications[0]
  const values = initialProcessPoints.map((point) => point.value)
  const summary = calculateSummary(values, specification)
  const trend = initialProcessPoints.map((point) => ({ label: point.batch, value: point.value }))
  const scatter = values.map((value, index) => ({ x: index + 1, y: value }))
  const marginalData = scatter.map((point) => ({
    x: point.x,
    y: point.y + (point.x % 3 === 0 ? 0.4 : -0.2) + (point.x * 0.02),
  }))
  const correlationMatrix = buildMockCorrelationMatrix()
  const pareto = [
    { label: 'Label', value: 18, cumulative: 42 },
    { label: 'Seal', value: 11, cumulative: 68 },
    { label: 'Fill', value: 8, cumulative: 87 },
    { label: 'Other', value: 5, cumulative: 100 },
  ]

  return (
    <div className="page statistics-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Statistical component library</span>
          <h1>Minitab-style analytics</h1>
          <p>Reference chart gallery and capability views for quality, SPC, and continuous verification dashboards.</p>
        </div>
      </div>

      <section className="panel capability-panel page-section" id="capability">
        <div className="panel-heading">
          <h2>Capability / Six Sigma</h2>
        </div>
        <div className="capability-layout">
          <CapabilityStatsPanel summary={summary} specification={specification} />
          <MinitabChartCard title="Normal capability plot" large>
            <CapabilityPlot values={values} mean={summary.mean} sigma={summary.standardDeviation} lsl={specification.lsl} usl={specification.usl} />
          </MinitabChartCard>
        </div>
        <MinitabChartCard title="Capability sixpack" large>
          <CapabilitySixpack
            values={values}
            mean={summary.mean}
            sigma={summary.standardDeviation}
            lsl={specification.lsl}
            usl={specification.usl}
          />
        </MinitabChartCard>
      </section>

      <MinitabCategory title="Basic charts" id="basic-charts">
        <MinitabChartCard title="Scatterplot">
          <ScatterPlot data={scatter} />
        </MinitabChartCard>
        <MinitabChartCard title="Line plot">
          <TrendChart data={trend} />
        </MinitabChartCard>
        <MinitabChartCard title="Bar chart">
          <SimpleBarChart data={[{ label: 'Open', value: 14 }, { label: 'Review', value: 9 }, { label: 'Closed', value: 28 }]} />
        </MinitabChartCard>
        <MinitabChartCard title="Pareto chart">
          <ParetoChart data={pareto} />
        </MinitabChartCard>
        <MinitabChartCard title="Pie chart">
          <DonutChart data={[{ name: 'Pass', value: 82 }, { name: 'Monitor', value: 13 }, { name: 'Action', value: 5 }]} />
        </MinitabChartCard>
      </MinitabCategory>

      <MinitabCategory title="Distribution charts" id="distribution-charts">
        <MinitabChartCard title="Histogram">
          <Histogram values={values} />
        </MinitabChartCard>
        <MinitabChartCard title="Distribution plot">
          <DistributionPlot values={values} mean={summary.mean} sigma={summary.standardDeviation} />
        </MinitabChartCard>
        <MinitabChartCard title="Boxplot">
          <BoxPlot values={values} />
        </MinitabChartCard>
      </MinitabCategory>

      <MinitabCategory title="Relationship charts" id="relationship-charts">
        <MinitabChartCard title="Scatterplot with regression">
          <ScatterWithRegression data={scatter} />
        </MinitabChartCard>
        <MinitabChartCard title="Residual plot">
          <ResidualPlot data={scatter} />
        </MinitabChartCard>
        <MinitabChartCard title="Heat map">
          <HeatMapChart matrix={correlationMatrix} rowLabels={assayCorrelationLabels} colLabels={assayCorrelationLabels} />
        </MinitabChartCard>
        <MinitabChartCard title="Contour plot">
          <ContourPlot />
        </MinitabChartCard>
        <MinitabChartCard title="Marginal plot" large>
          <MarginalPlot data={marginalData} />
        </MinitabChartCard>
      </MinitabCategory>

      <MinitabCategory title="Control charts" id="control-charts">
        <MinitabChartCard title="Individuals chart" large>
          <ControlChart
            data={trend}
            center={summary.mean}
            ucl={summary.mean + 3 * summary.standardDeviation}
            lcl={summary.mean - 3 * summary.standardDeviation}
            usl={specification.usl}
            lsl={specification.lsl}
          />
        </MinitabChartCard>
      </MinitabCategory>
    </div>
  )
}
