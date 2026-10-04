import { useState } from 'react'
import { Button, Card, Input, Modal, Select } from 'antd'

import { CpvEmpty, CpvError, CpvLoading } from '../../components/cpv/CpvComponents'
import { useToast } from '../../components/feedback/ToastProvider'
import { listCpvBatches } from '../../features/cpv/cpvService'
import { listLinkedEvents, saveLinkedEvent } from '../../features/cpv/cpvPhaseService'
import { CPV_CNF_STATUSES, CPV_COMPLAINT_STATUSES, CPV_DEVIATION_STATUSES, type CpvLinkedEvent } from '../../features/cpv/phaseTypes'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import { useCpvProductRecord } from './useCpvProductRecord'
import { useMenuPermission } from '../../hooks/useMenuPermission'

const COPY: Record<CpvLinkedEvent['kind'], { title: string; number: string; statuses: readonly string[] }> = {
  cnf: { title: 'Change Notification Forms', number: 'CNF number', statuses: CPV_CNF_STATUSES },
  complaint: { title: 'Product Complaints', number: 'Complaint number', statuses: CPV_COMPLAINT_STATUSES },
  deviation: { title: 'Deviation Reports', number: 'DR number', statuses: CPV_DEVIATION_STATUSES },
}

export function CpvEventPanel({ kind }: { kind: CpvLinkedEvent['kind'] }) {
  const product = useCpvProductRecord()
  const batches = useCpvLoad(() => listCpvBatches(product.id), [product.id])
  const list = useCpvLoad(() => listLinkedEvents(product.id, kind), [product.id, kind])
  const { canCreate } = useMenuPermission('cpv-products')
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    number: '',
    title: '',
    description: '',
    category: '',
    risk: '',
    status: COPY[kind].statuses[0],
    initiated_at: '',
    cancel_or_nfa_reason: '',
    capa_ref: '',
    owner: '',
    batch_ids: [] as string[],
  })
  const copy = COPY[kind]

  async function save() {
    try {
      await saveLinkedEvent(product.id, {
        kind,
        number: form.number,
        title: form.title,
        description: form.description,
        category: form.category || null,
        risk: form.risk || null,
        status: form.status,
        initiated_at: form.initiated_at || null,
        target_at: null,
        closed_at: null,
        conclusion: null,
        cancel_or_nfa_reason: form.cancel_or_nfa_reason || null,
        capa_ref: form.capa_ref || null,
        owner: form.owner || null,
        batch_ids: form.batch_ids,
      })
      notify(`${copy.title.slice(0, -1)} saved`)
      setOpen(false)
      await list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save record')
    }
  }

  if (batches.loading || list.loading) return <CpvLoading />
  if (batches.error || list.error) return <CpvError message={batches.error ?? list.error ?? 'Error'} />

  return (
    <Card
      className="panel"
      title={copy.title}
      extra={
        canCreate ? (
          <Button type="primary" onClick={() => setOpen(true)}>
            Add {kind === 'cnf' ? 'CNF' : kind === 'complaint' ? 'Complaint' : 'Deviation Report'}
          </Button>
        ) : null
      }
    >
      <p className="cpv-empty-hint">These records are created independently and may optionally link affected product batches. Cancelled and No Further Action require a reason.</p>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Number</th>
              <th>Title</th>
              <th>Status</th>
              <th>Linked batches</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.number}</td>
                <td>{row.title}</td>
                <td>{row.status}</td>
                <td>{row.batch_ids.length ? row.batch_ids.length : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(list.data ?? []).length === 0 ? <CpvEmpty title={`No ${copy.title.toLowerCase()}`} hint="Add a record, then link affected batches if known." /> : null}

      <Modal title={`Add ${copy.title.slice(0, -1)}`} open={open} onCancel={() => setOpen(false)} onOk={() => void save()} width={720}>
        <div className="cpv-form-grid">
          <label>
            {copy.number}
            <Input value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} />
          </label>
          <label>
            Title
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label>
            Description
            <Input.TextArea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
          </label>
          <label>
            Category
            <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
          </label>
          <label>
            Risk/severity
            <Input value={form.risk} onChange={(event) => setForm({ ...form, risk: event.target.value })} />
          </label>
          <label>
            Status
            <Select value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={copy.statuses.map((value) => ({ value, label: value }))} />
          </label>
          <label>
            Date initiated/received
            <Input type="date" value={form.initiated_at} onChange={(event) => setForm({ ...form, initiated_at: event.target.value })} />
          </label>
          <label>
            CAPA/reference
            <Input value={form.capa_ref} onChange={(event) => setForm({ ...form, capa_ref: event.target.value })} />
          </label>
          <label>
            Cancel / No Further Action reason
            <Input value={form.cancel_or_nfa_reason} onChange={(event) => setForm({ ...form, cancel_or_nfa_reason: event.target.value })} />
          </label>
          <label>
            Affected batches
            <Select
              mode="multiple"
              value={form.batch_ids}
              onChange={(value) => setForm({ ...form, batch_ids: value })}
              options={(batches.data ?? []).map((batch) => ({ value: batch.id, label: batch.batch_number }))}
            />
          </label>
        </div>
      </Modal>
    </Card>
  )
}
