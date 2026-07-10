import { useEffect, useState } from 'react'
import { Empty, Spin, Table } from 'antd'

import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useVrmsApp } from '../../context/VrmsAppContext'
import type { AuditEvent } from '../../types/vrms'

export function VrmsAuditPage() {
  const { getAuditTrail, dataRevision } = useVrmsApp()
  const [rows, setRows] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    void getAuditTrail()
      .then((data) => {
        if (active) setRows(data)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [getAuditTrail, dataRevision])

  return (
    <VrmsPage title="Audit Trail" description="Create, update, and registry activity.">
      <section className="vrms-panel">
        {loading ? (
          <Spin tip="Loading audit trail…" />
        ) : rows.length === 0 ? (
          <Empty description="No audit events recorded." />
        ) : (
          <Table<AuditEvent>
            className="vrms-table"
            dataSource={rows}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 900 }}
            columns={[
              { title: 'Timestamp', dataIndex: 'timestamp', key: 'timestamp' },
              { title: 'User', dataIndex: 'userEmail', key: 'userEmail' },
              { title: 'Action', dataIndex: 'action', key: 'action' },
              { title: 'Doc Tracer #', dataIndex: 'docTracer', key: 'docTracer' },
              { title: 'Details', dataIndex: 'details', key: 'details', render: (details) => <span style={{ whiteSpace: 'normal', maxWidth: 480 }}>{details}</span> },
            ]}
          />
        )}
      </section>
    </VrmsPage>
  )
}
