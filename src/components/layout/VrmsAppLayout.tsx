import { Outlet } from 'react-router-dom'

import { AppShell } from '../layout/AppShell'

/** VRMS routes rendered inside the standard template AppShell. */
export function VrmsAppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
