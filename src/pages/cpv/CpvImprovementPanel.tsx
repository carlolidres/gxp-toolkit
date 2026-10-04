import { useState } from 'react'
import { Button, Card, Input, Modal, Select } from 'antd'

import { CpvEmpty, CpvError, CpvLoading } from '../../components/cpv/CpvComponents'
import { useToast } from '../../components/feedback/ToastProvider'
import { listImprovements, listRecommendations, saveImprovement, saveRecommendation } from '../../features/cpv/cpvPhaseService'
import { CPV_RECOMMENDATION_STATUSES } from '../../features/cpv/phaseTypes'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import { useCpvProductRecord } from './useCpvProductRecord'
import { useMenuPermission } from '../../hooks/useMenuPermission'

export function CpvImprovementPanel() {
  const product = useCpvProductRecord()
  const list = useCpvLoad(() => listImprovements(product.id), [product.id])
  const { canCreate } = useMenuPermission('cpv-products')
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [recoFor, setRecoFor] = useState<string | null>(null)
  const recos = useCpvLoad(() => (recoFor ? listRecommendations(recoFor) : Promise.resolve([])), [recoFor])
  const [form, setForm] = useState({ number: '', source_ref: '', endorsed_at: '', summary: '', owner: '' })
  const [reco, setReco] = useState({ text: '', category: '', priority: '', owner: '', target_at: '', status: 'Open' })

  async function addImprovement() {
    try {
      await saveImprovement(product.id, {
        number: form.number,
        source_ref: form.source_ref || null,
        endorsed_at: form.endorsed_at || null,
        summary: form.summary,
        owner: form.owner || null,
        status: 'Open',
      })
      notify('Endorsement saved')
      setOpen(false)
      await list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save endorsement')
    }
  }

  async function addReco() {
    if (!recoFor) return
    try {
      await saveRecommendation({
        improvement_id: recoFor,
        sequence: (recos.data?.length ?? 0) + 1,
        text: reco.text,
        category: reco.category || null,
        priority: reco.priority || null,
        owner: reco.owner || null,
        target_at: reco.target_at || null,
        status: reco.status,
      })
      notify('Recommendation saved')
      setReco({ text: '', category: '', priority: '', owner: '', target_at: '', status: 'Open' })
      await recos.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save recommendation')
    }
  }

  if (list.loading) return <CpvLoading />
  if (list.error) return <CpvError message={list.error} />

  return (
    <Card
      className="panel"
      title="Process Improvement Monitoring"
      extra={
        canCreate ? (
          <Button type="primary" onClick={() => setOpen(true)}>
            Add endorsement report
          </Button>
        ) : null
      }
    >
      <p className="cpv-empty-hint">One endorsement report can hold multiple recommendations.</p>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Number</th>
              <th>Summary</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.number}</td>
                <td>{row.summary}</td>
                <td>{row.status}</td>
                <td>
                  <Button size="small" onClick={() => setRecoFor(row.id)}>
                    Recommendations
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(list.data ?? []).length === 0 ? <CpvEmpty title="No endorsement reports" hint="Add an endorsement, then record each recommendation as a child row." /> : null}

      <Modal title="Add endorsement report" open={open} onCancel={() => setOpen(false)} onOk={() => void addImprovement()}>
        <div className="cpv-form-grid">
          <label>
            Endorsement number
            <Input value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} />
          </label>
          <label>
            Source CPV report/protocol
            <Input value={form.source_ref} onChange={(event) => setForm({ ...form, source_ref: event.target.value })} />
          </label>
          <label>
            Date endorsed
            <Input type="date" value={form.endorsed_at} onChange={(event) => setForm({ ...form, endorsed_at: event.target.value })} />
          </label>
          <label>
            Summary
            <Input.TextArea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} rows={3} />
          </label>
        </div>
      </Modal>

      <Modal title="Recommendations" open={Boolean(recoFor)} onCancel={() => setRecoFor(null)} footer={null} width={720}>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>#</th>
                <th>Recommendation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(recos.data ?? []).map((row) => (
                <tr key={row.id}>
                  <td>{row.sequence}</td>
                  <td>{row.text}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canCreate ? (
          <div className="cpv-form-grid" style={{ marginTop: 12 }}>
            <label>
              Recommendation
              <Input.TextArea value={reco.text} onChange={(event) => setReco({ ...reco, text: event.target.value })} rows={2} />
            </label>
            <label>
              Status
              <Select value={reco.status} onChange={(value) => setReco({ ...reco, status: value })} options={CPV_RECOMMENDATION_STATUSES.map((value) => ({ value, label: value }))} />
            </label>
            <Button type="primary" onClick={() => void addReco()}>
              Add recommendation
            </Button>
          </div>
        ) : null}
      </Modal>
    </Card>
  )
}
