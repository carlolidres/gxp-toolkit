import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Button, Card, Checkbox, Input, Modal, Select } from 'antd'

import { CpvEmpty, CpvError, CpvLoading } from '../../components/cpv/CpvComponents'
import { useToast } from '../../components/feedback/ToastProvider'
import {
  addCpvPackagingOrder,
  copyCpvBatch,
  listCpvBatches,
  saveCpvBatch,
} from '../../features/cpv/cpvService'
import {
  COPY_FORWARD_RESTRICTED_FIELDS,
  COPY_FORWARD_SAFE_FIELDS,
  CPV_BATCH_STATUSES,
  type CpvBatchInput,
  type CpvCopyForwardField,
  type CpvProduct,
} from '../../features/cpv/types'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { formatAppDate } from '../../utils/dateUtils'

const emptyBatch: CpvBatchInput = { batch_number: '', status: 'Planned' }

export function CpvBatchesPanel() {
  const { product } = useOutletContext<{ product: CpvProduct }>()
  const list = useCpvLoad(() => listCpvBatches(product.id), [product.id])
  const { canCreate, canEdit } = useMenuPermission('cpv-products')
  const { notify } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [form, setForm] = useState<CpvBatchInput>(emptyBatch)
  const [sourceId, setSourceId] = useState('')
  const [selectedFields, setSelectedFields] = useState<CpvCopyForwardField[]>(['comments'])
  const [poFor, setPoFor] = useState<string | null>(null)
  const [poNumber, setPoNumber] = useState('')

  async function handleSave() {
    try {
      await saveCpvBatch(product.id, form)
      notify('Batch saved')
      setFormOpen(false)
      setForm(emptyBatch)
      await list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save batch')
    }
  }

  async function handleCopy() {
    try {
      await copyCpvBatch(product.id, {
        sourceBatchId: sourceId,
        target: form,
        confirmed: true,
        selectedFields,
      })
      notify('Batch copied')
      setCopyOpen(false)
      setFormOpen(false)
      await list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to copy batch')
    }
  }

  async function handlePo() {
    if (!poFor) return
    try {
      await addCpvPackagingOrder(poFor, poNumber)
      notify('Packaging order added')
      setPoFor(null)
      setPoNumber('')
      await list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to add PO')
    }
  }

  if (list.loading) return <CpvLoading label="Loading batches…" />
  if (list.error) return <CpvError message={list.error} />

  const rows = list.data ?? []

  return (
    <Card
      className="panel"
      title="Product Batches"
      extra={
        canCreate ? (
          <Button type="primary" onClick={() => setFormOpen(true)}>
            Add Batch
          </Button>
        ) : null
      }
    >
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Unique Batch No.</th>
              <th>MO Control No.</th>
              <th>FG Release Date</th>
              <th>Status</th>
              <th>PO Control Numbers</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((batch) => (
              <tr key={batch.id}>
                <td>{batch.batch_number}</td>
                <td>{batch.mo_control_number ?? '—'}</td>
                <td>{formatAppDate(batch.fg_release_date)}</td>
                <td>{batch.status}</td>
                <td>
                  {batch.packaging_orders.length ? (
                    <ul className="cpv-po-list">
                      {batch.packaging_orders.map((po) => (
                        <li key={po.id}>{po.po_control_number}</li>
                      ))}
                    </ul>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {canEdit ? (
                    <Button size="small" onClick={() => setPoFor(batch.id)}>
                      Add PO
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <CpvEmpty title="No batches" hint="Add a batch here. Raw Materials, Packaging Materials, Equipment, IPC, and Analytical Reports will use this same batch ID." />
        ) : null}
      </div>

      <Modal
        title="Add Batch"
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={() => void handleSave()}
        okText="Save batch"
        width={640}
      >
        <div className="cpv-form-grid">
          <label>
            Unique batch number
            <Input value={form.batch_number} onChange={(event) => setForm({ ...form, batch_number: event.target.value })} />
          </label>
          <label>
            MO control number
            <Input value={form.mo_control_number ?? ''} onChange={(event) => setForm({ ...form, mo_control_number: event.target.value })} />
          </label>
          <label>
            Manufacturing start
            <Input type="datetime-local" value={form.manufacturing_start_at ?? ''} onChange={(event) => setForm({ ...form, manufacturing_start_at: event.target.value })} />
          </label>
          <label>
            Manufacturing end
            <Input type="datetime-local" value={form.manufacturing_end_at ?? ''} onChange={(event) => setForm({ ...form, manufacturing_end_at: event.target.value })} />
          </label>
          <label>
            Packaging start
            <Input type="datetime-local" value={form.packaging_start_at ?? ''} onChange={(event) => setForm({ ...form, packaging_start_at: event.target.value })} />
          </label>
          <label>
            Packaging end
            <Input type="datetime-local" value={form.packaging_end_at ?? ''} onChange={(event) => setForm({ ...form, packaging_end_at: event.target.value })} />
          </label>
          <label>
            FG release date
            <Input type="date" value={form.fg_release_date ?? ''} onChange={(event) => setForm({ ...form, fg_release_date: event.target.value })} />
          </label>
          <label>
            Batch status
            <Select value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={CPV_BATCH_STATUSES.map((value) => ({ value, label: value }))} />
          </label>
          <label>
            Comments
            <Input value={form.comments ?? ''} onChange={(event) => setForm({ ...form, comments: event.target.value })} />
          </label>
          <label>
            Date exception reason
            <Input value={form.date_exception_reason ?? ''} onChange={(event) => setForm({ ...form, date_exception_reason: event.target.value })} />
          </label>
        </div>
        {rows.length > 0 ? (
          <Button style={{ marginTop: 12 }} onClick={() => setCopyOpen(true)}>
            Copy from previous batch
          </Button>
        ) : null}
      </Modal>

      <Modal title="Copy from previous batch" open={copyOpen} onCancel={() => setCopyOpen(false)} onOk={() => void handleCopy()} okText="Confirm copy">
        <p>Identify the source batch, confirm the fields to copy, then save. Dates, MO numbers, and results are off unless you select them.</p>
        <label className="cpv-field">
          Source batch
          <Select value={sourceId || undefined} onChange={setSourceId} options={rows.map((batch) => ({ value: batch.id, label: batch.batch_number }))} />
        </label>
        <fieldset>
          <legend>Fields to copy</legend>
          {[...COPY_FORWARD_SAFE_FIELDS, ...COPY_FORWARD_RESTRICTED_FIELDS].map((field) => (
            <div key={field}>
              <Checkbox
                checked={selectedFields.includes(field)}
                onChange={(event) => {
                  setSelectedFields((current) => (event.target.checked ? [...current, field] : current.filter((item) => item !== field)))
                }}
              >
                {field}
                {COPY_FORWARD_RESTRICTED_FIELDS.includes(field as (typeof COPY_FORWARD_RESTRICTED_FIELDS)[number])
                  ? ' (restricted)'
                  : ''}
              </Checkbox>
            </div>
          ))}
        </fieldset>
      </Modal>

      <Modal title="Add packaging order" open={Boolean(poFor)} onCancel={() => setPoFor(null)} onOk={() => void handlePo()}>
        <p>PO records are children of one batch. Do not duplicate the batch master.</p>
        <Input placeholder="PO control number" value={poNumber} onChange={(event) => setPoNumber(event.target.value)} />
      </Modal>
    </Card>
  )
}
