import { useState } from 'react'
import { Button, Card, Input, Modal, Select } from 'antd'

import { CpvEmpty, CpvError, CpvLoading } from '../../components/cpv/CpvComponents'
import { useToast } from '../../components/feedback/ToastProvider'
import { listCpvBatches } from '../../features/cpv/cpvService'
import { listMaterialDefinitions, listMaterialUsages, saveMaterialDefinition, saveMaterialUsage } from '../../features/cpv/cpvPhaseService'
import { CPV_PACKAGING_LEVELS, type CpvMaterialDefinition } from '../../features/cpv/phaseTypes'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import { useCpvProductRecord } from './useCpvProductRecord'
import { useMenuPermission } from '../../hooks/useMenuPermission'

export function CpvMaterialsPanel({ kind }: { kind: 'rm' | 'pm' }) {
  const product = useCpvProductRecord()
  const batches = useCpvLoad(() => listCpvBatches(product.id), [product.id])
  const defs = useCpvLoad(() => listMaterialDefinitions(product.id, kind), [product.id, kind])
  const usage = useCpvLoad(() => listMaterialUsages(product.id, kind), [product.id, kind])
  const { canCreate, canEdit } = useMenuPermission('cpv-products')
  const { notify } = useToast()
  const [defOpen, setDefOpen] = useState(false)
  const [useOpen, setUseOpen] = useState<{ batchId: string; material: CpvMaterialDefinition } | null>(null)
  const [def, setDef] = useState({
    description: '',
    item_number: '',
    spec_number: '',
    amount: '',
    unit: '',
    function_in_formulation: '',
    packaging_level: kind === 'pm' ? 'Primary' : '',
    approved_suppliers: '',
    critical: false,
    effective_from: '',
  })
  const [lot, setLot] = useState({ lot_number: '', supplier: '', quantity: '', po_id: '', comments: '' })

  const title = kind === 'rm' ? 'Raw Materials' : 'Packaging Materials'

  async function addDefinition() {
    try {
      await saveMaterialDefinition(product.id, {
        kind,
        description: def.description,
        item_number: def.item_number,
        spec_number: def.spec_number || null,
        amount: def.amount || null,
        unit: def.unit || null,
        function_in_formulation: def.function_in_formulation || null,
        packaging_level: kind === 'pm' ? def.packaging_level || 'Primary' : null,
        approved_suppliers: def.approved_suppliers || null,
        critical: def.critical,
        effective_from: def.effective_from || null,
        effective_to: null,
      })
      notify('Material definition saved')
      setDefOpen(false)
      await defs.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save material')
    }
  }

  async function addUsage() {
    if (!useOpen) return
    try {
      await saveMaterialUsage({
        material_id: useOpen.material.id,
        batch_id: useOpen.batchId,
        po_id: lot.po_id || null,
        lot_number: lot.lot_number,
        supplier: lot.supplier || null,
        quantity: lot.quantity || null,
        comments: lot.comments || null,
      })
      notify('Lot recorded')
      setUseOpen(null)
      setLot({ lot_number: '', supplier: '', quantity: '', po_id: '', comments: '' })
      await usage.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save lot')
    }
  }

  if (batches.loading || defs.loading || usage.loading) return <CpvLoading />
  if (batches.error || defs.error || usage.error) return <CpvError message={batches.error ?? defs.error ?? usage.error ?? 'Error'} />

  const batchRows = batches.data ?? []
  const materials = defs.data ?? []
  const usages = usage.data ?? []

  return (
    <Card
      className="panel"
      title={title}
      extra={
        canCreate ? (
          <Button type="primary" onClick={() => setDefOpen(true)}>
            Add {kind === 'rm' ? 'Raw Material' : 'Packaging Material'}
          </Button>
        ) : null
      }
    >
      <p className="cpv-empty-hint">
        Rows are Product Batches. Add a material definition, then encode the actual lot and supplier used on each batch. Multiple lots of the same material stay as extra rows, not extra columns.
      </p>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Unique Batch No.</th>
              <th>{kind === 'pm' ? 'PO Control No.' : 'MO Control No.'}</th>
              {materials.map((material) => (
                <th key={material.id}>
                  {material.item_number}
                  <div>{material.description}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batchRows.map((batch) => (
              <tr key={batch.id}>
                <td>{batch.batch_number}</td>
                <td>{kind === 'pm' ? batch.packaging_orders.map((po) => po.po_control_number).join(', ') || '—' : batch.mo_control_number ?? '—'}</td>
                {materials.map((material) => {
                  const lots = usages.filter((row) => row.batch_id === batch.id && row.material_id === material.id)
                  return (
                    <td key={material.id}>
                      {lots.length
                        ? lots.map((row) => (
                            <div key={row.id}>
                              {row.lot_number}
                              {row.supplier ? ` · ${row.supplier}` : ''}
                            </div>
                          ))
                        : '—'}
                      {canEdit ? (
                        <Button
                          type="link"
                          size="small"
                          onClick={() => {
                            setUseOpen({ batchId: batch.id, material })
                            setLot((current) => ({
                              ...current,
                              supplier: material.approved_suppliers ?? '',
                              po_id: batch.packaging_orders[0]?.id ?? '',
                            }))
                          }}
                        >
                          Encode lot
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
      {batchRows.length === 0 ? <CpvEmpty title="No batches" hint="Add Product Batches first. This spreadsheet does not create a second batch register." /> : null}
      {materials.length === 0 && batchRows.length > 0 ? <CpvEmpty title={`No ${title.toLowerCase()} defined`} hint="Add a material definition to create columns." /> : null}

      <Modal title={`Add ${title.slice(0, -1)}`} open={defOpen} onCancel={() => setDefOpen(false)} onOk={() => void addDefinition()} width={720}>
        <div className="cpv-form-grid">
          <label>
            Description
            <Input value={def.description} onChange={(event) => setDef({ ...def, description: event.target.value })} />
          </label>
          <label>
            Item number
            <Input value={def.item_number} onChange={(event) => setDef({ ...def, item_number: event.target.value })} />
          </label>
          <label>
            Approved spec/control number
            <Input value={def.spec_number} onChange={(event) => setDef({ ...def, spec_number: event.target.value })} />
          </label>
          {kind === 'rm' ? (
            <>
              <label>
                Amount in formulation
                <Input value={def.amount} onChange={(event) => setDef({ ...def, amount: event.target.value })} />
              </label>
              <label>
                Unit
                <Input value={def.unit} onChange={(event) => setDef({ ...def, unit: event.target.value })} />
              </label>
              <label>
                Function
                <Input value={def.function_in_formulation} onChange={(event) => setDef({ ...def, function_in_formulation: event.target.value })} />
              </label>
            </>
          ) : (
            <label>
              Packaging level
              <Select value={def.packaging_level} onChange={(value) => setDef({ ...def, packaging_level: value })} options={CPV_PACKAGING_LEVELS.map((value) => ({ value, label: value }))} />
            </label>
          )}
          <label>
            Approved supplier(s)
            <Input value={def.approved_suppliers} onChange={(event) => setDef({ ...def, approved_suppliers: event.target.value })} />
          </label>
          <label>
            Effective from
            <Input type="date" value={def.effective_from} onChange={(event) => setDef({ ...def, effective_from: event.target.value })} />
          </label>
        </div>
      </Modal>

      <Modal title="Encode lot / supplier used" open={Boolean(useOpen)} onCancel={() => setUseOpen(null)} onOk={() => void addUsage()}>
        {kind === 'pm' && useOpen ? (
          <label className="cpv-field">
            Packaging order
            <Select
              value={lot.po_id || undefined}
              onChange={(value) => setLot({ ...lot, po_id: value })}
              options={(batches.data ?? [])
                .find((batch) => batch.id === useOpen.batchId)
                ?.packaging_orders.map((po) => ({ value: po.id, label: po.po_control_number }))}
              placeholder="Optional PO"
              allowClear
            />
          </label>
        ) : null}
        <label className="cpv-field">
          Actual lot/control number
          <Input value={lot.lot_number} onChange={(event) => setLot({ ...lot, lot_number: event.target.value })} />
        </label>
        <label className="cpv-field">
          Actual supplier/source
          <Input value={lot.supplier} onChange={(event) => setLot({ ...lot, supplier: event.target.value })} />
        </label>
        <label className="cpv-field">
          Quantity used
          <Input value={lot.quantity} onChange={(event) => setLot({ ...lot, quantity: event.target.value })} />
        </label>
      </Modal>
    </Card>
  )
}
