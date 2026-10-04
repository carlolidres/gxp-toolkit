import { useMemo, useState } from 'react'
import { Button, Card, Input, Modal, Select } from 'antd'

import { CpvEmpty, CpvError, CpvLoading, CpvPage } from '../../components/cpv/CpvComponents'
import { useToast } from '../../components/feedback/ToastProvider'
import {
  approveCpvProtocol,
  listCpvProducts,
  listCpvProtocols,
  rejectCpvProtocol,
  reviseCpvProtocol,
  saveCpvProtocol,
  submitCpvProtocol,
} from '../../features/cpv/cpvService'
import type { CpvProtocol, CpvProtocolInput } from '../../features/cpv/types'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { formatAppDate } from '../../utils/dateUtils'

const emptyProtocol: CpvProtocolInput = {
  product_id: '',
  title: '',
  batch_selection_rule: 'FG release date within the review period',
}

export function CpvProtocolsPage() {
  const products = useCpvLoad(() => listCpvProducts())
  const list = useCpvLoad(() => listCpvProtocols())
  const { canCreate, canEdit, canApprove } = useMenuPermission('cpv-protocols')
  const { notify } = useToast()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<CpvProtocolInput>(emptyProtocol)
  const [signoffOpen, setSignoffOpen] = useState<CpvProtocol | null>(null)
  const [printedName, setPrintedName] = useState('')
  const [meaning, setMeaning] = useState('Approval of this CPV protocol version')

  const productName = useMemo(() => {
    const map = new Map((products.data ?? []).map((product) => [product.id, `${product.product_code} · ${product.product_name}`]))
    return (id: string) => map.get(id) ?? id
  }, [products.data])

  const filtered = (list.data ?? []).filter((row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return `${row.protocol_number} ${row.title} ${productName(row.product_id)} ${row.status}`.toLowerCase().includes(q)
  })

  async function handleSave() {
    try {
      await saveCpvProtocol(form)
      notify('Protocol saved')
      setFormOpen(false)
      setForm(emptyProtocol)
      await list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save protocol')
    }
  }

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action()
      notify(success)
      await list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : success)
    }
  }

  if (list.loading) {
    return (
      <CpvPage title="Protocol" description="Manage CPV protocols across products.">
        <CpvLoading />
      </CpvPage>
    )
  }

  return (
    <CpvPage
      title="Protocol"
      description="Create, review, and approve versioned CPV protocols. Approved versions are immutable."
      action={
        canCreate ? (
          <Button type="primary" onClick={() => setFormOpen(true)}>
            Create Protocol
          </Button>
        ) : null
      }
    >
      {list.error ? <CpvError message={list.error} /> : null}
      <Card className="panel">
        <div className="cpv-toolbar">
          <Input.Search allowClear placeholder="Search protocol, product, status…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <span>{filtered.length} protocols</span>
        </div>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Protocol</th>
                <th>Product</th>
                <th>Title</th>
                <th>Review period</th>
                <th>Status</th>
                <th>Author</th>
                <th>Approver</th>
                <th>Effective date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.protocol_number} v{row.version}
                  </td>
                  <td>{productName(row.product_id)}</td>
                  <td>{row.title}</td>
                  <td>
                    {row.review_period_start || row.review_period_end
                      ? `${formatAppDate(row.review_period_start)} – ${formatAppDate(row.review_period_end)}`
                      : '—'}
                  </td>
                  <td>{row.status}</td>
                  <td>{row.author_name ?? '—'}</td>
                  <td>{row.approver_name ?? '—'}</td>
                  <td>{formatAppDate(row.effective_date)}</td>
                  <td>
                    <div className="cpv-row-actions">
                      {canEdit && (row.status === 'Draft' || row.status === 'Rejected') ? (
                        <Button size="small" onClick={() => void run(() => submitCpvProtocol(row.id), 'Protocol submitted')}>
                          Submit
                        </Button>
                      ) : null}
                      {canApprove && (row.status === 'Pending Approval' || row.status === 'In Review') ? (
                        <Button size="small" type="primary" onClick={() => setSignoffOpen(row)}>
                          Approve
                        </Button>
                      ) : null}
                      {canEdit && row.status !== 'Approved/Effective' && row.status !== 'Superseded' ? (
                        <Button
                          size="small"
                          onClick={() => {
                            const comment = window.prompt('Reject / return comment')
                            if (comment) void run(() => rejectCpvProtocol(row.id, comment), 'Protocol rejected')
                          }}
                        >
                          Reject
                        </Button>
                      ) : null}
                      {canCreate && row.status === 'Approved/Effective' ? (
                        <Button size="small" onClick={() => void run(() => reviseCpvProtocol(row.id), 'Revision created')}>
                          Revise
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? <CpvEmpty title="No protocols" hint="Create a protocol from an existing product." /> : null}
        </div>
      </Card>

      <Modal title="Create Protocol" open={formOpen} onCancel={() => setFormOpen(false)} onOk={() => void handleSave()}>
        <div className="cpv-form-grid">
          <label>
            Product
            <Select
              value={form.product_id || undefined}
              onChange={(value) => setForm({ ...form, product_id: value })}
              options={(products.data ?? []).map((product) => ({ value: product.id, label: `${product.product_code} · ${product.product_name}` }))}
            />
          </label>
          <label>
            Title
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label>
            Review period start
            <Input type="date" value={form.review_period_start ?? ''} onChange={(event) => setForm({ ...form, review_period_start: event.target.value })} />
          </label>
          <label>
            Review period end
            <Input type="date" value={form.review_period_end ?? ''} onChange={(event) => setForm({ ...form, review_period_end: event.target.value })} />
          </label>
          <label>
            Objective
            <Input value={form.objective ?? ''} onChange={(event) => setForm({ ...form, objective: event.target.value })} />
          </label>
          <label>
            Scope
            <Input value={form.scope ?? ''} onChange={(event) => setForm({ ...form, scope: event.target.value })} />
          </label>
        </div>
      </Modal>

      <Modal
        title="Approve protocol"
        open={Boolean(signoffOpen)}
        onCancel={() => setSignoffOpen(null)}
        onOk={() => {
          if (!signoffOpen) return
          void run(() => approveCpvProtocol(signoffOpen.id, { printedName, meaning }), 'Protocol approved')
          setSignoffOpen(null)
        }}
      >
        <p>Reauthentication: type your name and the meaning of this signature.</p>
        <label className="cpv-field">
          Typed name
          <Input value={printedName} onChange={(event) => setPrintedName(event.target.value)} />
        </label>
        <label className="cpv-field">
          Meaning
          <Input value={meaning} onChange={(event) => setMeaning(event.target.value)} />
        </label>
      </Modal>
    </CpvPage>
  )
}
