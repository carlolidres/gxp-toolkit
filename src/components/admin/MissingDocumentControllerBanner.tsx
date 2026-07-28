import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from 'antd'

import { edocService } from '../../features/edoc/edocService'
import { useAuth } from '../../hooks/useAuth'

/** Persistent admin warning when an organization has no Document Controller. */
export function MissingDocumentControllerBanner() {
  const { user } = useAuth()
  const [labels, setLabels] = useState<string[]>([])

  useEffect(() => {
    if (user?.role !== 'Admin') {
      setLabels([])
      return
    }
    let active = true
    void edocService
      .listMissingControllerWarnings()
      .then((rows) => {
        if (!active) return
        setLabels(rows.map((row) => row.organizationLabel))
      })
      .catch(() => {
        if (!active) return
        setLabels([])
      })
    return () => {
      active = false
    }
  }, [user?.role, user?.id])

  if (user?.role !== 'Admin' || labels.length === 0) return null

  return (
    <Alert
      className="mx-4 mt-3 mb-0"
      type="warning"
      showIcon
      message="Document Controller assignment required"
      description={
        <span>
          Organizations without a Document Controller: {labels.join(', ')}. External eDocuSign submission is
          blocked until at least one controller is assigned in{' '}
          <Link to="/admin/users">User Management</Link>.
        </span>
      }
    />
  )
}
