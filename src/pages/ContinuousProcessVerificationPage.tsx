import { useMemo, useState, type FormEvent } from 'react'

import { BellCurve, ControlChart, Histogram, TrendChart } from '../components/charts/Charts'
import { useToast } from '../components/feedback/ToastProvider'
import { FormField, SelectInput, TextInput } from '../components/forms/FormControls'
import { StatisticalAlertPanel, StatisticalSummaryGrid } from '../components/statistics/StatisticalComponents'
import { initialProcessPoints, processSpecifications } from '../data/mockProcessData'
import { useStatistics } from '../hooks/useStatistics'
import { exportService } from '../services/exportService'
import type { ProcessParameter, ProcessPoint } from '../types/statistics'

export function ContinuousProcessVerificationPage() {
  const [parameter, setParameter] = useState<ProcessParameter>('Assay')
  const [points, setPoints] = useState<ProcessPoint[]>(initialProcessPoints)
  const { notify } = useToast()
  const specification = processSpecifications.find((item) => item.parameter === parameter) ?? processSpecifications[0]
  const parameterPoints = useMemo(() => points.filter((point) => point.parameter === parameter), [parameter, points])
  const values = parameterPoints.map((point) => point.value)
  const { summary, limits, alerts } = useStatistics(values, specification)
  const chartData = parameterPoints.map((point) => ({ label: point.batch, value: point.value }))

  function addPoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPoints((current) => [...current, { id: crypto.randomUUID(), parameter, batch: String(form.get('batch')), timestamp: new Date().toISOString(), value: Number(form.get('value')) }])
    event.currentTarget.reset()
    notify('Process reading added to mock state')
  }

  function exportReadings() {
    exportService.toSpreadsheet(parameterPoints, `${parameter.toLowerCase()}-readings`)
    notify('Process readings exported')
  }

  return <div className="page"><div className="page-header"><div><span className="eyebrow">Continuous process verification</span><h1>{parameter} monitoring</h1><p>Explore specifications, calculated control limits, capability, and statistical alerts.</p></div><div className="header-actions"><FormField label="Critical process parameter"><SelectInput value={parameter} onChange={(event) => setParameter(event.target.value as ProcessParameter)}>{processSpecifications.map((item) => <option key={item.parameter}>{item.parameter}</option>)}</SelectInput></FormField><button className="button secondary" onClick={exportReadings}>Export readings</button></div></div><div className="cpv-layout"><aside className="panel sticky-panel"><div className="panel-heading"><h2>New process reading</h2></div><form onSubmit={addPoint}><FormField label="Batch / lot"><TextInput name="batch" placeholder="B-2413" required /></FormField><FormField label={`Value (${specification.unit})`}><TextInput name="value" type="number" step="any" placeholder={String(specification.target)} required /></FormField><div className="spec-band"><span>Specification</span><strong>{specification.lsl} - {specification.usl} {specification.unit}</strong><small>Target {specification.target}</small></div><button className="button primary wide">Add reading</button></form><div className="panel-divider" /><h3>Statistical alerts</h3><StatisticalAlertPanel alerts={alerts} /></aside><div className="cpv-main"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">SPC overview</span><h2>Control chart</h2></div><span className="status-badge info">I chart</span></div><ControlChart data={chartData} center={limits.center} ucl={limits.ucl} lcl={limits.lcl} usl={specification.usl} lsl={specification.lsl} /></section><section className="panel"><div className="panel-heading"><h2>Process capability summary</h2></div><StatisticalSummaryGrid summary={summary} /></section><div className="two-column"><section className="panel"><div className="panel-heading"><h2>Trend / run chart</h2></div><TrendChart data={chartData} /></section><section className="panel"><div className="panel-heading"><h2>Distribution histogram</h2></div><Histogram values={values.length ? values : [0]} /></section><section className="panel span-2"><div className="panel-heading"><h2>Normal distribution model</h2></div><BellCurve mean={summary.mean} sigma={summary.standardDeviation} /></section></div></div></div></div>
}

