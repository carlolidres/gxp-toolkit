import { useEffect, useState } from 'react'

import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useVrmsApp } from '../../context/VrmsAppContext'
import type { AuditEvent } from '../../types/vrms'

export function VrmsAuditPage() {
  const { getAuditTrail } = useVrmsApp()
  const [rows, setRows] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
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
  }, [getAuditTrail])

  return (
    <VrmsPage title="Audit Trail" description="Create, update, and registry activity.">
      <section className="vrms-panel">
        {loading ? (
          <div className="vrms-loading">Loading audit trail…</div>
        ) : (
          <div className="vrms-table-wrap">
            <table className="vrms-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Doc Tracer #</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.timestamp}</td>
                    <td>{row.userEmail}</td>
                    <td>{row.action}</td>
                    <td>{row.docTracer}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 480 }}>{row.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </VrmsPage>
  )
}
