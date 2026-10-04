import { Link, useOutletContext } from 'react-router-dom'
import { Alert, Button, Card, Input, Modal, Select } from 'antd'
import { useState } from 'react'

import { CpvEmpty, CpvPostureBadge } from '../../components/cpv/CpvComponents'
import { useToast } from '../../components/feedback/ToastProvider'
import { listPhaseCounts } from '../../features/cpv/cpvPhaseService'
import { approveOfficialPosture, listCpvBatches, listCpvProtocols, listCpvReports } from '../../features/cpv/cpvService'
import { CPV_POSTURES, CPV_WORKSPACE_SECTIONS, type CpvProduct } from '../../features/cpv/types'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { formatAppDate } from '../../utils/dateUtils'

export function CpvProductDashboardPanel() {
  const { product, reload } = useOutletContext<{ product: CpvProduct; reload: () => Promise<void> }>()
  const batches = useCpvLoad(() => listCpvBatches(product.id), [product.id])
  const protocols = useCpvLoad(() => listCpvProtocols(), [product.id])
  const reports = useCpvLoad(() => listCpvReports(), [product.id])
  const phase = useCpvLoad(() => listPhaseCounts(product.id), [product.id])
  const { canApprove } = useMenuPermission('cpv-products')
  const { notify } = useToast()
  const [postureOpen, setPostureOpen] = useState(false)
  const [rationale, setRationale] = useState('')
  const [officialPosture, setOfficialPosture] = useState(product.proposed_posture)
  const [printedName, setPrintedName] = useState('')
  const [meaning, setMeaning] = useState('Approval of official CPV validation posture')

  const productBatches = batches.data ?? []
  const latestProtocol = (protocols.data ?? []).find((row) => row.product_id === product.id && row.status === 'Approved/Effective')
  const latestReport = (reports.data ?? []).find((row) => row.product_id === product.id && row.status === 'Approved/Effective')
  const completeness = productBatches.length === 0 ? 0 : Math.min(100, Math.round((productBatches.filter((batch) => batch.fg_release_date).length / Math.max(productBatches.length, 1)) * 100))

  async function handleApprovePosture() {
    try {
      await approveOfficialPosture(product.id, officialPosture, rationale, {
        printedName,
        meaning,
      })
      notify('Official posture saved')
      setPostureOpen(false)
      await reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to approve posture')
    }
  }

  return (
    <>
      <Alert
        type="info"
        showIcon
        message={`Proposed posture: ${product.proposed_posture}. Completeness is not a Valid claim. Official posture requires QA approval.`}
        style={{ marginBottom: 16 }}
      />
      <div className="cpv-product-header">
        <Card size="small" title="Official posture">
          <CpvPostureBadge posture={product.official_posture} />
          <p>{product.official_posture_rationale ?? 'No approved rationale yet.'}</p>
          {canApprove ? (
            <Button size="small" type="primary" onClick={() => setPostureOpen(true)}>
              Approve official posture
            </Button>
          ) : null}
        </Card>
        <Card size="small" title="Batches in scope">
          <p>{productBatches.length}</p>
        </Card>
        <Card size="small" title="Data completeness">
          <p>{completeness}%</p>
        </Card>
        <Card size="small" title="Next review due">
          <p>{formatAppDate(product.next_review_due)}</p>
        </Card>
        <Card size="small" title="Latest approved protocol">
          <p>{latestProtocol ? `${latestProtocol.protocol_number} v${latestProtocol.version}` : 'None'}</p>
        </Card>
        <Card size="small" title="Latest approved report">
          <p>{latestReport ? `${latestReport.report_number} v${latestReport.version}` : 'None'}</p>
        </Card>
      </div>

      <Card title="Workspace completeness" className="panel">
        {CPV_WORKSPACE_SECTIONS.map((section) => {
          const counts = phase.data
          const encoded =
            section.id === 'profile' ||
            (section.id === 'batches' && productBatches.length > 0) ||
            (section.id === 'raw-materials' && (counts?.raw_materials ?? 0) > 0) ||
            (section.id === 'packaging-materials' && (counts?.packaging_materials ?? 0) > 0) ||
            (section.id === 'equipment' && (counts?.equipment ?? 0) > 0) ||
            (section.id === 'ipc' && (counts?.ipc ?? 0) > 0) ||
            (section.id === 'analytical' && (counts?.analytical ?? 0) > 0) ||
            (section.id === 'stability' && (counts?.stability ?? 0) > 0) ||
            (section.id === 'hold-time' && (counts?.hold_time ?? 0) > 0) ||
            (section.id === 'cnf' && (counts?.cnf ?? 0) > 0) ||
            (section.id === 'complaints' && (counts?.complaints ?? 0) > 0) ||
            (section.id === 'deviations' && (counts?.deviations ?? 0) > 0) ||
            (section.id === 'improvements' && (counts?.improvements ?? 0) > 0)
          return (
            <p key={section.id}>
              <Link to={section.path ? `/cpv/products/${product.id}/${section.path}` : `/cpv/products/${product.id}`}>
                {section.label}
              </Link>
              {' — '}
              {encoded ? 'Partial' : 'Missing'}
            </p>
          )
        })}
        {productBatches.length === 0 ? (
          <CpvEmpty title="No batches in the register" hint="Add Product Batches so RM, PM, Equipment, IPC, and AR can reference the same batch IDs." />
        ) : null}
      </Card>

      <Modal title="Approve official validation posture" open={postureOpen} onCancel={() => setPostureOpen(false)} onOk={() => void handleApprovePosture()}>
        <p>Proposed posture is calculated. Official Valid / Not Valid is a QA decision, not a completeness score.</p>
        <label className="cpv-field">
          Official posture
          <Select value={officialPosture} onChange={setOfficialPosture} options={CPV_POSTURES.map((value) => ({ value, label: value }))} />
        </label>
        <label className="cpv-field">
          Rationale
          <Input.TextArea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} />
        </label>
        <label className="cpv-field">
          Typed name
          <Input value={printedName} onChange={(event) => setPrintedName(event.target.value)} />
        </label>
        <label className="cpv-field">
          Meaning of signature
          <Input value={meaning} onChange={(event) => setMeaning(event.target.value)} />
        </label>
      </Modal>
    </>
  )
}
