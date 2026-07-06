import { useMemo, useState } from 'react'

import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useToast } from '../../components/feedback/ToastProvider'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { useVmpApp } from '../../context/VmpAppContext'
import type { VmpFieldType } from '../../lib/vmpFieldOptions'

const fieldTypes: VmpFieldType[] = ['department', 'group', 'room_line', 'site_plant']

export function VmpFieldOptionsPage() {
  const { fieldOptions, optionsLoading, updateFieldOption } = useVmpApp()
  const { canEdit } = useMenuPermission('registry')
  const { notify } = useToast()
  const [fieldType, setFieldType] = useState<VmpFieldType>('department')
  const [busyId, setBusyId] = useState('')

  const rows = useMemo(
    () => fieldOptions.filter((row) => row.fieldType === fieldType).sort((a, b) => a.displayOrder - b.displayOrder),
    [fieldOptions, fieldType],
  )

  async function toggleActive(id: string, isActive: boolean) {
    if (!canEdit) return
    setBusyId(id)
    try {
      await updateFieldOption(id, { isActive: !isActive })
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update option.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <VrmsPage title="VMP Field Options" description="Review and maintain cascading dropdown registry values.">
      <section className="vrms-panel">
        <div className="vrms-toolbar" style={{ gridTemplateColumns: '220px 1fr' }}>
          <div>
            <label htmlFor="vmp-field-type">Field type</label>
            <select id="vmp-field-type" value={fieldType} onChange={(event) => setFieldType(event.target.value as VmpFieldType)}>
              {fieldTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
        {optionsLoading ? <p className="vrms-muted">Loading options…</p> : null}
        <table className="vrms-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Context</th>
              <th>Source</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>No user-defined options for this field type yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.displayValue}</td>
                  <td>
                    {[row.validationArea, row.siteId, row.departmentId, row.parentOptionId].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td>{row.isUserDefined ? 'User' : 'System'}</td>
                  <td>{row.isActive ? 'Active' : 'Inactive'}</td>
                  <td>
                    {canEdit && row.isUserDefined ? (
                      <button
                        type="button"
                        className="vrms-btn-secondary"
                        disabled={busyId === row.id}
                        onClick={() => void toggleActive(row.id, row.isActive)}
                      >
                        {row.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </VrmsPage>
  )
}
