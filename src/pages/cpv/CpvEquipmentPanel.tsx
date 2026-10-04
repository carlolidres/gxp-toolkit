import { useState } from 'react'
import { Button, Card, Input, Modal, Select, Tabs } from 'antd'

import { CpvEmpty, CpvError, CpvLoading } from '../../components/cpv/CpvComponents'
import { useToast } from '../../components/feedback/ToastProvider'
import { listCpvBatches } from '../../features/cpv/cpvService'
import { listAssets, listAssetUses, saveAsset, saveAssetUse } from '../../features/cpv/cpvPhaseService'
import { CPV_ASSET_STAGES, CPV_ASSET_TYPES, type CpvAsset } from '../../features/cpv/phaseTypes'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import { useCpvProductRecord } from './useCpvProductRecord'
import { useMenuPermission } from '../../hooks/useMenuPermission'

export function CpvEquipmentPanel() {
  const product = useCpvProductRecord()
  const batches = useCpvLoad(() => listCpvBatches(product.id), [product.id])
  const defs = useCpvLoad(() => listAssets(product.id), [product.id])
  const uses = useCpvLoad(() => listAssetUses(product.id), [product.id])
  const { canCreate, canEdit } = useMenuPermission('cpv-products')
  const { notify } = useToast()
  const [tab, setTab] = useState('All')
  const [open, setOpen] = useState(false)
  const [useOpen, setUseOpen] = useState<{ batchId: string; asset: CpvAsset } | null>(null)
  const [form, setForm] = useState({
    asset_type: 'Equipment' as (typeof CPV_ASSET_TYPES)[number],
    name: '',
    tag: '',
    room: '',
    line: '',
    stage: 'Manufacturing' as (typeof CPV_ASSET_STAGES)[number],
    parameter_name: '',
    lsl: '',
    usl: '',
    unit: '',
    qual_report: '',
    requal_due: '',
    cleaning_sop: '',
    cleaning_val_ref: '',
    cleaning_review_due: '',
  })
  const [useForm, setUseForm] = useState({ used_at: '', parameter_result: '', comments: '' })

  async function addAsset() {
    try {
      await saveAsset(product.id, {
        ...form,
        tag: form.tag || null,
        room: form.room || null,
        line: form.line || null,
        parameter_name: form.parameter_name || null,
        lsl: form.lsl || null,
        usl: form.usl || null,
        unit: form.unit || null,
        trend_enabled: Boolean(form.parameter_name),
        qual_report: form.qual_report || null,
        qual_status: null,
        requal_due: form.requal_due || null,
        cleaning_sop: form.cleaning_sop || null,
        cleaning_val_ref: form.cleaning_val_ref || null,
        cleaning_review_due: form.cleaning_review_due || null,
        facility_qual_ref: null,
        facility_requal_due: null,
        effective_from: null,
        effective_to: null,
      })
      notify('Asset saved')
      setOpen(false)
      await defs.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save asset')
    }
  }

  async function addUse() {
    if (!useOpen) return
    try {
      await saveAssetUse({
        asset_id: useOpen.asset.id,
        batch_id: useOpen.batchId,
        used_at: useForm.used_at,
        parameter_result: useForm.parameter_result || null,
        comments: useForm.comments || null,
      })
      notify('Use recorded')
      setUseOpen(null)
      await uses.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save use')
    }
  }

  if (batches.loading || defs.loading || uses.loading) return <CpvLoading />
  if (batches.error || defs.error || uses.error) return <CpvError message={batches.error ?? defs.error ?? uses.error ?? 'Error'} />

  const assets = (defs.data ?? []).filter((asset) => tab === 'All' || asset.stage === tab)

  return (
    <Card
      className="panel"
      title="Equipment / Rooms / Lines"
      extra={
        canCreate ? (
          <Button type="primary" onClick={() => setOpen(true)}>
            Add Equipment / Room / Line
          </Button>
        ) : null
      }
    >
      <Tabs activeKey={tab} onChange={setTab} items={['Manufacturing', 'Packaging', 'All'].map((value) => ({ key: value, label: value }))} />
      <p className="cpv-empty-hint">Qualification status is evaluated as of the date of use, not today. Process capability indices are not calculated (missing numbers stay blank).</p>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Unique Batch No.</th>
              {assets.map((asset) => (
                <th key={asset.id}>
                  {asset.name} ({asset.asset_type})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(batches.data ?? []).map((batch) => (
              <tr key={batch.id}>
                <td>{batch.batch_number}</td>
                {assets.map((asset) => {
                  const recorded = (uses.data ?? []).filter((row) => row.batch_id === batch.id && row.asset_id === asset.id)
                  return (
                    <td key={asset.id}>
                      {recorded.map((row) => (
                        <div key={row.id}>
                          {row.parameter_result ?? 'Used'} · {row.window_status}
                        </div>
                      ))}
                      {canEdit ? (
                        <Button type="link" size="small" onClick={() => setUseOpen({ batchId: batch.id, asset })}>
                          Encode use
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

      <Modal title="Add Equipment / Room / Line" open={open} onCancel={() => setOpen(false)} onOk={() => void addAsset()} width={760}>
        <div className="cpv-form-grid">
          <label>
            Type
            <Select value={form.asset_type} onChange={(value) => setForm({ ...form, asset_type: value })} options={CPV_ASSET_TYPES.map((value) => ({ value, label: value }))} />
          </label>
          <label>
            Name
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            IL tag / asset ID
            <Input value={form.tag} onChange={(event) => setForm({ ...form, tag: event.target.value })} />
          </label>
          <label>
            Stage
            <Select value={form.stage} onChange={(value) => setForm({ ...form, stage: value })} options={CPV_ASSET_STAGES.map((value) => ({ value, label: value }))} />
          </label>
          <label>
            Room
            <Input value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} />
          </label>
          <label>
            Line
            <Input value={form.line} onChange={(event) => setForm({ ...form, line: event.target.value })} />
          </label>
          <label>
            Critical parameter
            <Input value={form.parameter_name} onChange={(event) => setForm({ ...form, parameter_name: event.target.value })} />
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
            Qualification report
            <Input value={form.qual_report} onChange={(event) => setForm({ ...form, qual_report: event.target.value })} />
          </label>
          <label>
            Requalification due
            <Input type="date" value={form.requal_due} onChange={(event) => setForm({ ...form, requal_due: event.target.value })} />
          </label>
          <label>
            Cleaning procedure/PECSP
            <Input value={form.cleaning_sop} onChange={(event) => setForm({ ...form, cleaning_sop: event.target.value })} />
          </label>
        </div>
      </Modal>

      <Modal title="Encode equipment/room/line use" open={Boolean(useOpen)} onCancel={() => setUseOpen(null)} onOk={() => void addUse()}>
        <label className="cpv-field">
          Date/time of use
          <Input type="datetime-local" value={useForm.used_at} onChange={(event) => setUseForm({ ...useForm, used_at: event.target.value })} />
        </label>
        <label className="cpv-field">
          Parameter result
          <Input value={useForm.parameter_result} onChange={(event) => setUseForm({ ...useForm, parameter_result: event.target.value })} />
        </label>
      </Modal>
    </Card>
  )
}
