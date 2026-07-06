import { useMemo, useState } from 'react'

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
            <select value={selectedType} onChange={(event) => setSelectedType(event.target.value as VrmsRegistryType)}>
              {registryTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          {canCreate ? (
            <>
              <div>
                <label>Dropdown value</label>
                <input
                  placeholder="Add new value"
                  value={newValue}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleAdd()
                  }}
                  onChange={(event) => setNewValue(event.target.value)}
                />
              </div>
              <button type="button" className="vrms-btn-primary" disabled={busy} onClick={() => void handleAdd()}>
                Add value
              </button>
            </>
          ) : null}
        </div>

        <div className="vrms-registry-list">
          {values.map((value) => (
            <div className="vrms-registry-item" key={value}>
              <span>{value}</span>
              {canDelete ? (
                <button type="button" className="vrms-btn-secondary" disabled={busy} onClick={() => void handleDelete(value)}>
                  Delete
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </VrmsPage>
  )
}
