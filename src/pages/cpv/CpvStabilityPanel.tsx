import { useState } from 'react'
import { Button, Card, Input, Modal, Select, Tabs } from 'antd'

import { CpvEmpty, CpvError, CpvLoading } from '../../components/cpv/CpvComponents'
import { useToast } from '../../components/feedback/ToastProvider'
import { listCpvBatches } from '../../features/cpv/cpvService'
import { addStabilityTimePoint, listStabilityStudies, listStabilityTimePoints, saveStabilityResult, saveStabilityStudy } from '../../features/cpv/cpvPhaseService'
import { CPV_STABILITY_DEFAULT_CONDITIONS } from '../../features/cpv/phaseTypes'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import { useCpvProductRecord } from './useCpvProductRecord'
import { useMenuPermission } from '../../hooks/useMenuPermission'

export function CpvStabilityPanel() {
  const product = useCpvProductRecord()
  const batches = useCpvLoad(() => listCpvBatches(product.id), [product.id])
  const studies = useCpvLoad(() => listStabilityStudies(product.id), [product.id])
  const { canCreate, canEdit } = useMenuPermission('cpv-products')
  const { notify } = useToast()
  const [studyId, setStudyId] = useState<string | null>(null)
  const selected = (studies.data ?? []).find((row) => row.id === studyId) ?? (studies.data ?? [])[0]
  const activeStudyId = studyId ?? selected?.id ?? null
  const points = useCpvLoad(() => (activeStudyId ? listStabilityTimePoints(activeStudyId) : Promise.resolve([])), [activeStudyId])
  const [open, setOpen] = useState(false)
  const [pointOpen, setPointOpen] = useState(false)
  const [resultId, setResultId] = useState<string | null>(null)
  const [condition, setCondition] = useState<(typeof CPV_STABILITY_DEFAULT_CONDITIONS)[number] | string>(CPV_STABILITY_DEFAULT_CONDITIONS[0])
  const [form, setForm] = useState({ protocol_ref: '', stability_batch: '', product_batch_id: '', packaging: '', market: '', start_date: '' })
  const [point, setPoint] = useState({ months: '0', due_date: '', parameter: '', lsl: '', usl: '', unit: '', copyFromId: '' })
  const [result, setResult] = useState({ result: '', pull_date: '', test_date: '' })

  async function addStudy() {
    try {
      const created = await saveStabilityStudy(product.id, {
        protocol_ref: form.protocol_ref,
        stability_batch: form.stability_batch,
        product_batch_id: form.product_batch_id || null,
        packaging: form.packaging || null,
        market: form.market || null,
        start_date: form.start_date || null,
        status: 'Open',
      })
      notify('Stability study saved')
      setOpen(false)
      setStudyId(created.id)
      await studies.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save study')
    }
  }

  async function addPoint() {
    if (!activeStudyId) return
    try {
      await addStabilityTimePoint({
        study_id: activeStudyId,
        condition_label: condition,
        months: Number(point.months),
        due_date: point.due_date || null,
        parameter: point.parameter || null,
        lsl: point.lsl || null,
        usl: point.usl || null,
        unit: point.unit || null,
        result: null,
        pull_date: null,
        test_date: null,
        method_version: null,
        copyFromId: point.copyFromId || undefined,
      })
      notify('Time point added')
      setPointOpen(false)
      await points.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to add time point')
    }
  }

  async function saveResult() {
    if (!resultId) return
    try {
      const current = (points.data ?? []).find((row) => row.id === resultId)
      await saveStabilityResult(resultId, {
        result: result.result,
        pull_date: result.pull_date || null,
        test_date: result.test_date || null,
        parameter: current?.parameter ?? null,
        lsl: current?.lsl ?? null,
        usl: current?.usl ?? null,
        unit: current?.unit ?? null,
        method_version: current?.method_version ?? null,
      })
      notify('Result saved')
      setResultId(null)
      await points.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save result')
    }
  }

  if (batches.loading || studies.loading) return <CpvLoading />
  if (batches.error || studies.error) return <CpvError message={batches.error ?? studies.error ?? 'Error'} />

  const filtered = (points.data ?? []).filter((row) => row.condition_label === condition)

  return (
    <Card
      className="panel"
      title="Stability"
      extra={
        canCreate ? (
          <Button type="primary" onClick={() => setOpen(true)}>
            Add Stability Study
          </Button>
        ) : null
      }
    >
      <p className="cpv-empty-hint">Stability studies are created independently. Linking a product batch is optional. Copying a time point copies the parameter template, not results.</p>
      <label className="cpv-field">
        Study
        <Select
          value={activeStudyId ?? undefined}
          onChange={setStudyId}
          options={(studies.data ?? []).map((row) => ({ value: row.id, label: `${row.stability_batch} · ${row.protocol_ref}` }))}
          placeholder="Select a study"
        />
      </label>
      <Tabs
        activeKey={condition}
        onChange={setCondition}
        items={[...CPV_STABILITY_DEFAULT_CONDITIONS, 'Other'].map((value) => ({ key: value, label: value }))}
      />
      {canEdit && activeStudyId ? (
        <Button style={{ marginBottom: 12 }} onClick={() => setPointOpen(true)}>
          Add time point
        </Button>
      ) : null}
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Months</th>
              <th>Due</th>
              <th>Parameter</th>
              <th>Result</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td>{row.months}</td>
                <td>{row.due_date ?? '—'}</td>
                <td>{row.parameter ?? '—'}</td>
                <td>{row.result ?? '—'}</td>
                <td>{row.status}</td>
                <td>
                  {canEdit ? (
                    <Button size="small" onClick={() => setResultId(row.id)}>
                      Encode result
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!activeStudyId ? <CpvEmpty title="No stability study" hint="Create a study, then add sequential time points such as 0, 3, 6, 9, 12 months." /> : null}

      <Modal title="Add Stability Study" open={open} onCancel={() => setOpen(false)} onOk={() => void addStudy()}>
        <div className="cpv-form-grid">
          <label>
            Protocol/reference
            <Input value={form.protocol_ref} onChange={(event) => setForm({ ...form, protocol_ref: event.target.value })} />
          </label>
          <label>
            Stability batch number
            <Input value={form.stability_batch} onChange={(event) => setForm({ ...form, stability_batch: event.target.value })} />
          </label>
          <label>
            Linked product batch
            <Select
              allowClear
              value={form.product_batch_id || undefined}
              onChange={(value) => setForm({ ...form, product_batch_id: value ?? '' })}
              options={(batches.data ?? []).map((batch) => ({ value: batch.id, label: batch.batch_number }))}
            />
          </label>
          <label>
            Packaging
            <Input value={form.packaging} onChange={(event) => setForm({ ...form, packaging: event.target.value })} />
          </label>
          <label>
            Market/purpose
            <Input value={form.market} onChange={(event) => setForm({ ...form, market: event.target.value })} />
          </label>
          <label>
            Study start
            <Input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} />
          </label>
        </div>
      </Modal>

      <Modal title="Add time point" open={pointOpen} onCancel={() => setPointOpen(false)} onOk={() => void addPoint()}>
        <label className="cpv-field">
          Months
          <Input value={point.months} onChange={(event) => setPoint({ ...point, months: event.target.value })} />
        </label>
        <label className="cpv-field">
          Due date
          <Input type="date" value={point.due_date} onChange={(event) => setPoint({ ...point, due_date: event.target.value })} />
        </label>
        <label className="cpv-field">
          Parameter template
          <Input value={point.parameter} onChange={(event) => setPoint({ ...point, parameter: event.target.value })} />
        </label>
        <label className="cpv-field">
          Copy template from
          <Select
            allowClear
            value={point.copyFromId || undefined}
            onChange={(value) => setPoint({ ...point, copyFromId: value ?? '' })}
            options={(points.data ?? []).map((row) => ({ value: row.id, label: `${row.months} mo · ${row.parameter ?? 'template'}` }))}
          />
        </label>
      </Modal>

      <Modal title="Encode stability result" open={Boolean(resultId)} onCancel={() => setResultId(null)} onOk={() => void saveResult()}>
        <label className="cpv-field">
          Result
          <Input value={result.result} onChange={(event) => setResult({ ...result, result: event.target.value })} />
        </label>
        <label className="cpv-field">
          Actual pull date
          <Input type="date" value={result.pull_date} onChange={(event) => setResult({ ...result, pull_date: event.target.value })} />
        </label>
        <label className="cpv-field">
          Actual test date
          <Input type="date" value={result.test_date} onChange={(event) => setResult({ ...result, test_date: event.target.value })} />
        </label>
      </Modal>
    </Card>
  )
}
