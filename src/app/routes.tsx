import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { MenuPermissionRoute } from '../components/auth/MenuPermissionRoute'
import { LoadingState } from '../components/feedback/FeedbackStates'
import { VrmsAppLayout } from '../components/layout/VrmsAppLayout'
import { VrmsAppProvider } from '../context/VrmsAppContext'
import { AppShell } from '../components/layout/AppShell'
import { LoginPage } from '../pages/LoginPage'
import { SignUpPage } from '../pages/SignUpPage'
import { VrmsDashboardPage } from '../pages/vrms/VrmsDashboardPage'
import { VrmsRoutingPage } from '../pages/vrms/VrmsRoutingPage'
import { VrmsDatabasePage } from '../pages/vrms/VrmsDatabasePage'
import { VrmsAuditPage } from '../pages/vrms/VrmsAuditPage'
import { VrmsRegistryPage } from '../pages/vrms/VrmsRegistryPage'
import { UserManagementPage } from '../pages/admin/UserManagementPage'

const ComponentsShowcasePage = lazy(() =>
  import('../pages/ComponentsShowcasePage').then((module) => ({ default: module.ComponentsShowcasePage })),
)
const StatisticsDashboardPage = lazy(() =>
  import('../pages/StatisticsDashboardPage').then((module) => ({ default: module.StatisticsDashboardPage })),
)
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))

function SamplePage({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>
        <Suspense fallback={<div className="page"><LoadingState label="Loading page" /></div>}>{children}</Suspense>
      </AppShell>
    </ProtectedRoute>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <VrmsAppProvider>
              <VrmsAppLayout />
            </VrmsAppProvider>
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <MenuPermissionRoute menuId="dashboard">
              <VrmsDashboardPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="routing"
          element={
            <MenuPermissionRoute menuId="routing">
              <VrmsRoutingPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="database"
          element={
            <MenuPermissionRoute menuId="database">
              <VrmsDatabasePage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="audit"
          element={
            <MenuPermissionRoute menuId="audit">
              <VrmsAuditPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="registry"
          element={
            <MenuPermissionRoute menuId="registry">
              <VrmsRegistryPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <MenuPermissionRoute menuId="user-management">
              <UserManagementPage />
            </MenuPermissionRoute>
          }
        />
      </Route>

      <Route path="/samples/components" element={<SamplePage><ComponentsShowcasePage /></SamplePage>} />
      <Route path="/samples/statistics" element={<SamplePage><StatisticsDashboardPage /></SamplePage>} />
      <Route path="*" element={<SamplePage><NotFoundPage /></SamplePage>} />
    </Routes>
  )
}
