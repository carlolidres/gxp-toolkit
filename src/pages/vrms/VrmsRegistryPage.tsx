import { useMemo, useState } from 'react'
import { Button, Empty, Input, Modal, Select, Space } from 'antd'
import { Plus, Trash2 } from 'lucide-react'

import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useToast } from '../../components/feedback/ToastProvider'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { useVrmsApp } from '../../context/VrmsAppContext'
import { VRMS_DEFAULT_REGISTRY } from '../../lib/vrmsDefaults'
import { normalizeRegistryValue } from '../../utils/vrmsLogic'
import type { VrmsRegistryType } from '../../types/vrms'

const registryTypes = Object.keys(VRMS_DEFAULT_REGISTRY) as VrmsRegistryType[]

export function VrmsRegistryPage() {
  const { appData, addRegistryValue, deleteRegistryValue } = useVrmsApp()
  const { canCreate, canDelete } = useMenuPermission('registry')
  const { notify } = useToast()
  const [selectedType, setSelectedType] = useState<VrmsRegistryType>('Status')
  const [newValue, setNewValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const values = useMemo(
    () => appData?.registries[selectedType] ?? [],
    [appData?.registries, selectedType],
  )

  async function handleAdd() {
    const trimmed = normalizeRegistryValue(newValue)
    if (!trimmed) return
    setBusy(true)
    try {
      await addRegistryValue(selectedType, trimmed)
      setNewValue('')
      notify(`Added “${trimmed}” to ${selectedType}.`, 'success')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to add registry value.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteConfirmed() {
    if (!pendingDelete) return
    setBusy(true)
    try {
      await deleteRegistryValue(selectedType, pendingDelete)
      notify(`Removed “${pendingDelete}” from ${selectedType}.`, 'success')
      setPendingDelete(null)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete registry value.', 'error')
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
            <Select
              value={selectedType}
              onChange={(value) => setSelectedType(value as VrmsRegistryType)}
              options={registryTypes.map((type) => ({ value: type, label: type }))}
            />
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
              <Button
                type="primary"
                icon={<Plus size={15} />}
                className="vrms-btn-primary"
                loading={busy}
                onClick={() => void handleAdd()}
              >
                Add value
              </Button>
            </>
          ) : null}
        </div>

        <div className="vrms-registry-list">
          {values.length === 0 ? (
            <Empty description="No values in this registry." image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : null}
          {values.map((value) => (
            <div className="vrms-registry-item" key={value}>
              <span>{value}</span>
              {canDelete ? (
                <Button
                  icon={<Trash2 size={15} />}
                  className="vrms-btn-secondary"
                  disabled={busy}
                  onClick={() => setPendingDelete(value)}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <Modal
        open={Boolean(pendingDelete)}
        title="Remove saved option?"
        onCancel={() => setPendingDelete(null)}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={() => setPendingDelete(null)} disabled={busy}>
              Cancel
            </Button>
            <Button danger type="primary" loading={busy} onClick={() => void handleDeleteConfirmed()}>
              Remove
            </Button>
          </Space>
        }
      >
        <p>
          Remove <strong>{pendingDelete}</strong> from the shared suggestion list? Existing routing records that already
          use this value will not be changed.
        </p>
      </Modal>
    </VrmsPage>
  )
}
