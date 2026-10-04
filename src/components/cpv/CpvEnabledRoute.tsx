import type { ReactNode } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Alert } from 'antd'

import { isCpvEnabled } from '../../features/cpv/cpvFlags'

export function CpvEnabledRoute({ children }: { children?: ReactNode }) {
  if (!isCpvEnabled()) {
    return (
      <div className="page">
        <Alert
          type="info"
          showIcon
          message="CPV is not enabled in this environment"
          description="Set VITE_ENABLE_CPV=true in .env.local and restart the dev server to use Continuous Process Verification."
        />
        <p style={{ marginTop: 16 }}>
          <Link to="/">Return to Dashboard</Link>
        </p>
      </div>
    )
  }
  return children ?? <Outlet />
}
