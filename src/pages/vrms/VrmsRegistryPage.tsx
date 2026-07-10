import { useMemo, useState } from 'react'
import { Button, Empty, Input, Select } from 'antd'
import { Plus, Trash2 } from 'lucide-react'

import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useToast } from '../../components/feedback/ToastProvider'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { useVrmsApp } from '../../context/VrmsAppContext'
import { VRMS_DEFAULT_REGISTRY } from '../../lib/vrmsDefaults'
import type { VrmsRegistryType } from '../../types/vrms'

const registryTypes = Object.keys(VRMS_DEFAULT_REGISTRY) as VrmsRegistryType[]

export function VrmsRegistryPage() {
  const { appData, addRegistryValue, deleteRegistryValue } = useVrmsApp()
  const { canCreate, canDelete } = useMenuPermission('registry')
  const { notify } = useToast()
  const [selectedType, setSelectedType] = useState<VrmsRegistryType>('Status')
  const [newValue, setNewValue] = useState('')
  const [busy, setBusy] = useState(false)

  const values = useMemo(
    () => appData?.registries[selectedType] ?? [],
    [appData?.registries, selectedType],
  )

  async function handleAdd() {
    if (!newValue.trim()) return
    setBusy(true)
    try {
      await addRegistryValue(selectedType, newValue.trim())
      setNewValue('')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to add registry value.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(value: string) {
    setBusy(true)
    try {
      await deleteRegistryValue(selectedType, value)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete registry value.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <VrmsPage title="Registry / Master Data" description="Manage dropdown values for forms and status.">
      <section className="vrms-panel">
        <div className="vrms-toolbar" style={{ gridTemplateColumns: canCreate ? '220px 1fr auto' : '220px 1fr' }}>
          <div>
            <label>Registry type</label>
            <Select value={selectedType} onChange={(value) => setSelectedType(value as VrmsRegistryType)} options={registryTypes.map((type) => ({ value: type, label: type }))} />
          </div>
          {canCreate ? (
            <>
              <div>
                <label>Dropdown value</label>
                <Input
                  placeholder="Add new value"
                  value={newValue}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleAdd()
                  }}
                  onChange={(event) => setNewValue(event.target.value)}
                />
              </div>
              <Button type="primary" icon={<Plus size={15} />} className="vrms-btn-primary" loading={busy} onClick={() => void handleAdd()}>
                Add value
              </Button>
            </>
          ) : null}
        </div>

        <div className="vrms-registry-list">
          {values.length === 0 ? <Empty description="No values in this registry." image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
          {values.map((value) => (
            <div className="vrms-registry-item" key={value}>
              <span>{value}</span>
              {canDelete ? (
                <Button icon={<Trash2 size={15} />} className="vrms-btn-secondary" disabled={busy} onClick={() => void handleDelete(value)}>
                  Delete
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </VrmsPage>
  )
}
