import { useState } from 'react'
import { Button, Card, Input, Modal, Select, Tabs } from 'antd'

import { CpvEmpty, CpvError, CpvLoading } from '../../components/cpv/CpvComponents'
import { useToast } from '../../components/feedback/ToastProvider'
import { listCpvBatches } from '../../features/cpv/cpvService'
import { listTestDefinitions, listTestResults, saveTestDefinition, saveTestResult } from '../../features/cpv/cpvPhaseService'
import { CPV_DATA_TYPES, CPV_INSTRUMENT_TYPES, CPV_TEST_CLASSES, type CpvTestDefinition } from '../../features/cpv/phaseTypes'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import { useCpvProductRecord } from './useCpvProductRecord'
import { useMenuPermission } from '../../hooks/useMenuPermission'

export function CpvTestPanel({ kind }: { kind: 'ipc' | 'analytical' }) {
  const product = useCpvProductRecord()
  const batches = useCpvLoad(() => listCpvBatches(product.id), [product.id])
  const defs = useCpvLoad(() => listTestDefinitions(product.id, kind), [product.id, kind])
  const rows = useCpvLoad(() => listTestResults(product.id, kind), [product.id, kind])
  const { canCreate, canEdit } = useMenuPermission('cpv-products')
  const { notify } = useToast()
  const [tab, setTab] = useState('All')
  const [open, setOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState<{ batchId: string; test: CpvTestDefinition } | null>(null)
  const [form, setForm] = useState({
    name: '',
    classification: 'Bulk' as (typeof CPV_TEST_CLASSES)[number],
    data_type: 'Numeric' as (typeof CPV_DATA_TYPES)[number],
    lsl: '',
    usl: '',
    target: '',
    warning_low: '',
    warning_high: '',
    unit: '',
    method_ref: '',
    method_version: '',
    instrument_type: 'Other',
  })
  const [result, setResult] = useState({
    value: '',
    test_at: '',
    sample_id: '',
    report_ref: '',
    instrument: '',
    official_event: '' as '' | 'OOS' | 'OOT',
    investigation_link: '',
    not_applicable: false,
    na_justification: '',
  })

  const title = kind === 'ipc' ? 'In-Process Controls' : 'Analytical Reports'

  async function addDefinition() {
    try {
      await saveTestDefinition(product.id, {
        kind,
        name: form.name,
        classification: form.classification,
        data_type: form.data_type,
        lsl: form.lsl || null,
        usl: form.usl || null,
        target: form.target || null,
        warning_low: form.warning_low || null,
        warning_high: form.warning_high || null,
        unit: form.unit || null,
        method_ref: form.method_ref || null,
        method_version: form.method_version || null,
        criticality: kind === 'analytical' ? 'CQA' : 'CPP',
        instrument_type: form.instrument_type,
        effective_from: null,
        effective_to: null,
      })
      notify('Parameter saved')
      setOpen(false)
      await defs.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save parameter')
    }
  }

  async function addResult() {
    if (!resultOpen) return
    try {
      await saveTestResult({
        definition_id: resultOpen.test.id,
        batch_id: resultOpen.batchId,
        result: result.value || null,
        test_at: result.test_at || null,
        sample_id: result.sample_id || null,
        report_ref: result.report_ref || null,
        instrument: result.instrument || null,
        csv_ref: null,
        investigation_link: result.investigation_link || null,
        official_event: result.official_event || null,
        not_applicable: result.not_applicable,
        na_justification: result.na_justification || null,
        comments: null,
      })
      notify('Result saved')
      setResultOpen(null)
      await rows.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save result')
    }
  }

  if (batches.loading || defs.loading || rows.loading) return <CpvLoading />
  if (batches.error || defs.error || rows.error) return <CpvError message={batches.error ?? defs.error ?? rows.error ?? 'Error'} />

  const tests = (defs.data ?? []).filter((test) => tab === 'All' || test.classification === tab)

  return (
    <Card
      className="panel"
      title={title}
      extra={
        canCreate ? (
          <Button type="primary" onClick={() => setOpen(true)}>
            Add {kind === 'ipc' ? 'IPC Parameter' : 'Analytical Test'}
          </Button>
        ) : null
      }
    >
      <Tabs activeKey={tab} onChange={setTab} items={['Bulk', 'Finished Product', 'All'].map((value) => ({ key: value, label: value }))} />
      <p className="cpv-empty-hint">
        Missing numeric results stay blank and are Not Evaluated. Official OOS/OOT needs an investigation link. Process capability indices are not auto-calculated.
      </p>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Unique Batch No.</th>
              {tests.map((test) => (
                <th key={test.id}>
                  {test.name} ({test.classification})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(batches.data ?? []).map((batch) => (
              <tr key={batch.id}>
                <td>{batch.batch_number}</td>
                {tests.map((test) => {
                  const recorded = (rows.data ?? []).filter((row) => row.batch_id === batch.id && row.definition_id === test.id)
                  return (
                    <td key={test.id}>
                      {recorded.map((row) => (
                        <div key={row.id}>
                          {row.result ?? '—'} · {row.evaluation}
                        </div>
                      ))}
                      {canEdit ? (
                        <Button type="link" size="small" onClick={() => setResultOpen({ batchId: batch.id, test })}>
                          Encode result
                        </Button>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(batches.data ?? []).length === 0 ? <CpvEmpty title="No batches" hint="Add Product Batches first." /> : null}

      <Modal title={`Add ${title} parameter`} open={open} onCancel={() => setOpen(false)} onOk={() => void addDefinition()} width={760}>
        <div className="cpv-form-grid">
          <label>
            Testing parameter
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Classification
            <Select value={form.classification} onChange={(value) => setForm({ ...form, classification: value })} options={CPV_TEST_CLASSES.map((value) => ({ value, label: value }))} />
          </label>
          <label>
            Data type
            <Select value={form.data_type} onChange={(value) => setForm({ ...form, data_type: value })} options={CPV_DATA_TYPES.map((value) => ({ value, label: value }))} />
          </label>
          <label>
            LSL
            <Input value={form.lsl} onChange={(event) => setForm({ ...form, lsl: event.target.value })} />
          </label>
          <label>
            USL
            <Input value={form.usl} onChange={(event) => setForm({ ...form, usl: event.target.value })} />
          </label>
          <label>
            Unit
            <Input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
          </label>
          <label>
            Method/spec version
            <Input value={form.method_version} onChange={(event) => setForm({ ...form, method_version: event.target.value })} />
          </label>
          <label>
            Default instrument
            <Select value={form.instrument_type} onChange={(value) => setForm({ ...form, instrument_type: value })} options={CPV_INSTRUMENT_TYPES.map((value) => ({ value, label: value }))} />
          </label>
        </div>
      </Modal>

      <Modal title="Encode result" open={Boolean(resultOpen)} onCancel={() => setResultOpen(null)} onOk={() => void addResult()}>
        <label className="cpv-field">
          Result
          <Input value={result.value} onChange={(event) => setResult({ ...result, value: event.target.value })} />
        </label>
        <label className="cpv-field">
          Test date
          <Input type="datetime-local" value={result.test_at} onChange={(event) => setResult({ ...result, test_at: event.target.value })} />
        </label>
        <label className="cpv-field">
          Sample / report reference
          <Input value={result.report_ref} onChange={(event) => setResult({ ...result, report_ref: event.target.value })} />
        </label>
        <label className="cpv-field">
          Official quality event
          <Select
            allowClear
            value={result.official_event || undefined}
            onChange={(value) => setResult({ ...result, official_event: value ?? '' })}
            options={[
              { value: 'OOS', label: 'OOS' },
              { value: 'OOT', label: 'OOT' },
            ]}
          />
        </label>
        <label className="cpv-field">
          Investigation link
          <Input value={result.investigation_link} onChange={(event) => setResult({ ...result, investigation_link: event.target.value })} />
        </label>
      </Modal>
    </Card>
  )
}
