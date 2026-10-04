import { useMemo, useState } from 'react'
import { Button, Card, Input, Modal, Select } from 'antd'

import { CpvEmpty, CpvError, CpvLoading, CpvPage, CpvPostureBadge } from '../../components/cpv/CpvComponents'
import { useToast } from '../../components/feedback/ToastProvider'
import {
  approveCpvReport,
  generateCpvReport,
  listCpvProducts,
  listCpvProtocols,
  listCpvReports,
  submitCpvReport,
} from '../../features/cpv/cpvService'
import type { CpvReport } from '../../features/cpv/types'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { formatAppDate } from '../../utils/dateUtils'

export function CpvReportsPage() {
  const products = useCpvLoad(() => listCpvProducts())
  const protocols = useCpvLoad(() => listCpvProtocols())
  const list = useCpvLoad(() => listCpvReports())
  const { canCreate, canEdit, canApprove } = useMenuPermission('cpv-reports')
  const { notify } = useToast()
  const [search, setSearch] = useState('')
  const [generateOpen, setGenerateOpen] = useState(false)
  const [protocolId, setProtocolId] = useState('')
  const [signoffOpen, setSignoffOpen] = useState<CpvReport | null>(null)
  const [printedName, setPrintedName] = useState('')
  const [meaning, setMeaning] = useState('Approval of this CPV report version and frozen snapshot')

  const productName = useMemo(() => {
    const map = new Map((products.data ?? []).map((product) => [product.id, `${product.product_code} · ${product.product_name}`]))
    return (id: string) => map.get(id) ?? id
  }, [products.data])

  const approvedProtocols = (protocols.data ?? []).filter((row) => row.status === 'Approved/Effective')
  const filtered = (list.data ?? []).filter((row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return `${row.report_number} ${productName(row.product_id)} ${row.status}`.toLowerCase().includes(q)
  })

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
      <CpvPage title="Report" description="Generate CPV reports from approved protocols.">
        <CpvLoading />
      </CpvPage>
    )
  }

  return (
    <CpvPage
      title="Report"
      description="Draft reports freeze included batch IDs at generation. Approved reports do not change when later batches are added."
      action={
        canCreate ? (
          <Button type="primary" onClick={() => setGenerateOpen(true)}>
            Generate Report
          </Button>
        ) : null
      }
    >
      {list.error ? <CpvError message={list.error} /> : null}
      <Card className="panel">
        <div className="cpv-toolbar">
          <Input.Search allowClear placeholder="Search report, product, status…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <span>{filtered.length} reports</span>
        </div>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Report</th>
                <th>Product</th>
                <th>Protocol</th>
                <th>Review period</th>
                <th>Included / excluded</th>
                <th>Proposed posture</th>
                <th>Status</th>
                <th>Author</th>
                <th>Approver</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.report_number} v{row.version}
                  </td>
                  <td>{productName(row.product_id)}</td>
                  <td>{row.protocol_id ? 'Linked approved protocol' : '—'}</td>
                  <td>
                    {row.review_period_start || row.review_period_end
                      ? `${formatAppDate(row.review_period_start)} – ${formatAppDate(row.review_period_end)}`
                      : '—'}
                  </td>
                  <td>
                    {row.included_batch_count} / {row.excluded_batch_count}
                  </td>
                  <td>
                    <CpvPostureBadge posture={row.proposed_posture} />
                  </td>
                  <td>{row.status}</td>
                  <td>{row.author_name ?? '—'}</td>
                  <td>{row.approver_name ?? '—'}</td>
                  <td>
                    <div className="cpv-row-actions">
                      {canEdit && (row.status === 'Draft' || row.status === 'Rejected') ? (
                        <Button size="small" onClick={() => void run(() => submitCpvReport(row.id), 'Report submitted')}>
                          Submit
                        </Button>
                      ) : null}
                      {canApprove && (row.status === 'Pending Approval' || row.status === 'In Review') ? (
                        <Button size="small" type="primary" onClick={() => setSignoffOpen(row)}>
                          Approve
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <CpvEmpty title="No reports" hint="Generate a draft from an approved protocol. The snapshot freezes included batch IDs." />
          ) : null}
        </div>
      </Card>

      <Modal
        title="Generate report from approved protocol"
        open={generateOpen}
        onCancel={() => setGenerateOpen(false)}
        onOk={() => {
          void run(() => generateCpvReport(protocolId), 'Report generated')
          setGenerateOpen(false)
        }}
      >
        <Select
          style={{ width: '100%' }}
          placeholder="Approved protocol"
          value={protocolId || undefined}
          onChange={setProtocolId}
          options={approvedProtocols.map((row) => ({
            value: row.id,
            label: `${row.protocol_number} v${row.version} — ${productName(row.product_id)}`,
          }))}
        />
      </Modal>

      <Modal
        title="Approve report"
        open={Boolean(signoffOpen)}
        onCancel={() => setSignoffOpen(null)}
        onOk={() => {
          if (!signoffOpen) return
          void run(() => approveCpvReport(signoffOpen.id, { printedName, meaning }), 'Report approved')
          setSignoffOpen(null)
        }}
      >
        <p>Approving freezes the existing snapshot. Later batch changes will not alter this report.</p>
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
