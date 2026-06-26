import { Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { MenuPermissionRoute } from '../components/auth/MenuPermissionRoute'
import { VrmsAppLayout } from '../components/layout/VrmsAppLayout'
import { VrmsAppProvider } from '../context/VrmsAppContext'
import { LoginPage } from '../pages/LoginPage'
import { SignUpPage } from '../pages/SignUpPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { AccountSettingsPage } from '../pages/AccountSettingsPage'
import { VrmsDashboardPage } from '../pages/vrms/VrmsDashboardPage'
import { VrmsRoutingPage } from '../pages/vrms/VrmsRoutingPage'
import { VrmsDatabasePage } from '../pages/vrms/VrmsDatabasePage'
import { VrmsAuditPage } from '../pages/vrms/VrmsAuditPage'
import { VrmsRegistryPage } from '../pages/vrms/VrmsRegistryPage'
import { UserManagementPage } from '../pages/admin/UserManagementPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

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
        <Route path="account" element={<AccountSettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
