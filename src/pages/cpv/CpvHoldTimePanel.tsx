import { useState } from 'react'
import { Button, Card, Input, Modal, Select } from 'antd'

import { CpvEmpty, CpvError, CpvLoading } from '../../components/cpv/CpvComponents'
import { useToast } from '../../components/feedback/ToastProvider'
import { listCpvBatches } from '../../features/cpv/cpvService'
import { listHoldRecords, listHoldRequirements, saveHoldRecord, saveHoldRequirement } from '../../features/cpv/cpvPhaseService'
import { CPV_DEFAULT_HOLD_TRANSITIONS, CPV_HOLD_UNITS } from '../../features/cpv/phaseTypes'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import { useCpvProductRecord } from './useCpvProductRecord'
import { useMenuPermission } from '../../hooks/useMenuPermission'

export function CpvHoldTimePanel() {
  const product = useCpvProductRecord()
  const batches = useCpvLoad(() => listCpvBatches(product.id), [product.id])
  const reqs = useCpvLoad(() => listHoldRequirements(product.id), [product.id])
  const recs = useCpvLoad(() => listHoldRecords(product.id), [product.id])
  const { canCreate } = useMenuPermission('cpv-products')
  const { notify } = useToast()
  const [reqOpen, setReqOpen] = useState(false)
  const [recOpen, setRecOpen] = useState(false)
  const [req, setReq] = useState({ transition: CPV_DEFAULT_HOLD_TRANSITIONS[0], max_duration: '', unit: 'hours' as (typeof CPV_HOLD_UNITS)[number], study_ref: '' })
  const [rec, setRec] = useState({ requirement_id: '', batch_id: '', study_batch: '', start_at: '', end_at: '' })

  async function addReq() {
    try {
      await saveHoldRequirement(product.id, {
        transition: req.transition,
        min_duration: null,
        max_duration: req.max_duration,
        unit: req.unit,
        study_ref: req.study_ref,
        effective_from: null,
      })
      notify('Hold-time requirement saved')
      setReqOpen(false)
      await reqs.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save requirement')
    }
  }

  async function addRec() {
    try {
      await saveHoldRecord({
        product_id: product.id,
        requirement_id: rec.requirement_id,
        batch_id: rec.batch_id || null,
        study_batch: rec.study_batch || null,
        start_at: rec.start_at,
        end_at: rec.end_at,
      })
      notify('Hold-time record saved')
      setRecOpen(false)
      await recs.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save record')
    }
  }

  if (batches.loading || reqs.loading || recs.loading) return <CpvLoading />
  if (batches.error || reqs.error || recs.error) return <CpvError message={batches.error ?? reqs.error ?? recs.error ?? 'Error'} />

  return (
    <Card
      className="panel"
      title="Hold-Time Monitoring"
      extra={
        canCreate ? (
          <>
            <Button onClick={() => setReqOpen(true)}>Add requirement</Button>
            <Button type="primary" onClick={() => setRecOpen(true)} style={{ marginLeft: 8 }}>
              Add monitoring record
            </Button>
          </>
        ) : null
      }
    >
      <p className="cpv-empty-hint">Requirements need a study/SOP reference. Duration is calculated from the start and end timestamps. Records are not created just because a batch exists.</p>
      <h3>Requirements</h3>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Transition</th>
              <th>Max</th>
              <th>Study/SOP</th>
            </tr>
          </thead>
          <tbody>
            {(reqs.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.transition}</td>
                <td>
                  {row.max_duration} {row.unit}
                </td>
                <td>{row.study_ref}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Monitoring records</h3>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Transition</th>
              <th>Duration (h)</th>
              <th>Evaluation</th>
            </tr>
          </thead>
          <tbody>
            {(recs.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{(reqs.data ?? []).find((item) => item.id === row.requirement_id)?.transition ?? row.requirement_id}</td>
                <td>{row.duration_hours ?? '—'}</td>
                <td>{row.evaluation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(reqs.data ?? []).length === 0 && (recs.data ?? []).length === 0 ? <CpvEmpty title="No hold-time records" hint="Configure an applicable transition, then encode actual start/end times." /> : null}

      <Modal title="Add hold-time requirement" open={reqOpen} onCancel={() => setReqOpen(false)} onOk={() => void addReq()}>
        <label className="cpv-field">
          Transition
          <Select value={req.transition} onChange={(value) => setReq({ ...req, transition: value })} options={CPV_DEFAULT_HOLD_TRANSITIONS.map((value) => ({ value, label: value }))} />
        </label>
        <label className="cpv-field">
          Maximum duration
          <Input value={req.max_duration} onChange={(event) => setReq({ ...req, max_duration: event.target.value })} />
        </label>
        <label className="cpv-field">
          Unit
          <Select value={req.unit} onChange={(value) => setReq({ ...req, unit: value })} options={CPV_HOLD_UNITS.map((value) => ({ value, label: value }))} />
        </label>
        <label className="cpv-field">
          Study/protocol/SOP reference
          <Input value={req.study_ref} onChange={(event) => setReq({ ...req, study_ref: event.target.value })} />
        </label>
      </Modal>

      <Modal title="Add hold-time record" open={recOpen} onCancel={() => setRecOpen(false)} onOk={() => void addRec()}>
        <label className="cpv-field">
          Requirement
          <Select value={rec.requirement_id || undefined} onChange={(value) => setRec({ ...rec, requirement_id: value })} options={(reqs.data ?? []).map((row) => ({ value: row.id, label: row.transition }))} />
        </label>
        <label className="cpv-field">
          Product batch
          <Select allowClear value={rec.batch_id || undefined} onChange={(value) => setRec({ ...rec, batch_id: value ?? '' })} options={(batches.data ?? []).map((batch) => ({ value: batch.id, label: batch.batch_number }))} />
        </label>
        <label className="cpv-field">
          Study batch identifier
          <Input value={rec.study_batch} onChange={(event) => setRec({ ...rec, study_batch: event.target.value })} />
        </label>
        <label className="cpv-field">
          Start
          <Input type="datetime-local" value={rec.start_at} onChange={(event) => setRec({ ...rec, start_at: event.target.value })} />
        </label>
        <label className="cpv-field">
          End
          <Input type="datetime-local" value={rec.end_at} onChange={(event) => setRec({ ...rec, end_at: event.target.value })} />
        </label>
      </Modal>
    </Card>
  )
}
