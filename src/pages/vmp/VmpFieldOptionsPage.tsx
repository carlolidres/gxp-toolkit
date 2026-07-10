import { useMemo, useState } from 'react'
import { Button, Empty, Select, Spin, Table, Tag } from 'antd'
import { RotateCcw, ToggleLeft } from 'lucide-react'

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
            <Select id="vmp-field-type" value={fieldType} onChange={(value) => setFieldType(value as VmpFieldType)} options={fieldTypes.map((type) => ({ value: type, label: type }))} />
          </div>
        </div>
        {optionsLoading ? <Spin tip="Loading options…" /> : rows.length === 0 ? <Empty description="No user-defined options for this field type yet." /> : (
          <Table
            className="vrms-table"
            dataSource={rows}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true }}
            columns={[
              { title: 'Value', dataIndex: 'displayValue', key: 'displayValue' },
              { title: 'Context', key: 'context', render: (_, row) => [row.validationArea, row.siteId, row.departmentId, row.parentOptionId].filter(Boolean).join(' · ') || '—' },
              { title: 'Source', key: 'source', render: (_, row) => <Tag>{row.isUserDefined ? 'User' : 'System'}</Tag> },
              { title: 'Status', key: 'status', render: (_, row) => <Tag color={row.isActive ? 'green' : 'default'}>{row.isActive ? 'Active' : 'Inactive'}</Tag> },
              {
                title: 'Action',
                key: 'action',
                render: (_, row) => canEdit && row.isUserDefined ? (
                  <Button
                    icon={row.isActive ? <ToggleLeft size={15} /> : <RotateCcw size={15} />}
                    className="vrms-btn-secondary"
                    loading={busyId === row.id}
                    onClick={() => void toggleActive(row.id, row.isActive)}
                  >
                    {row.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                ) : '—',
              },
            ]}
          />
        )}
      </section>
    </VrmsPage>
  )
}
