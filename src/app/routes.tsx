import { Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { MenuPermissionRoute } from '../components/auth/MenuPermissionRoute'
import { VrmsAppLayout } from '../components/layout/VrmsAppLayout'
import { VrmsAppProvider } from '../context/VrmsAppContext'
import { VmpAppProvider } from '../context/VmpAppContext'
import { LoginPage } from '../pages/LoginPage'
import { SignUpPage } from '../pages/SignUpPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { AccountSettingsPage } from '../pages/AccountSettingsPage'
import { VrmsDashboardPage } from '../pages/vrms/VrmsDashboardPage'
import { VrmsRoutingPage } from '../pages/vrms/VrmsRoutingPage'
import { VrmsDatabasePage } from '../pages/vrms/VrmsDatabasePage'
import { VrmsAuditPage } from '../pages/vrms/VrmsAuditPage'
import { VrmsRegistryPage } from '../pages/vrms/VrmsRegistryPage'
import { VmpModulePage } from '../pages/vmp/VmpModulePage'
import { VmpMasterlistFormPage } from '../pages/vmp/VmpMasterlistFormPage'
import { VmpDatabasePage } from '../pages/vmp/VmpDatabasePage'
import { VmpFieldOptionsPage } from '../pages/vmp/VmpFieldOptionsPage'
import { EdocAdministrationPage } from '../pages/edoc/EdocAdministrationPage'
import { EdocAuditPage } from '../pages/edoc/EdocAuditPage'
import { EdocCreateDocumentPage } from '../pages/edoc/EdocCreateDocumentPage'
import { EdocDashboardPage } from '../pages/edoc/EdocDashboardPage'
import { EdocDocumentsPage } from '../pages/edoc/EdocDocumentsPage'
import { EdocInboxPage } from '../pages/edoc/EdocInboxPage'
import { EdocReportsPage } from '../pages/edoc/EdocReportsPage'
import { EdocRoutingTemplatesPage } from '../pages/edoc/EdocRoutingTemplatesPage'
import { EdocWorkspacePage } from '../pages/edoc/EdocWorkspacePage'
import { ApqrDashboardPage } from '../pages/apqr/ApqrDashboardPage'
import { ApqrClientRegistryPage } from '../pages/apqr/ApqrClientRegistryPage'
import { ApqrSchedulerPage } from '../pages/apqr/ApqrSchedulerPage'
import { ApqrDatabasePage } from '../pages/apqr/ApqrDatabasePage'
import { ApqrFormPage } from '../pages/apqr/ApqrFormPage'
import { ApqrAuditPage } from '../pages/apqr/ApqrAuditPage'
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
              <VmpAppProvider>
                <VrmsAppLayout />
              </VmpAppProvider>
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
          path="vmp/masterlist"
          element={
            <MenuPermissionRoute menuId="vmp-masterlist">
              <VmpMasterlistFormPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="vmp/risk-assessment"
          element={
            <MenuPermissionRoute menuId="vmp-risk-assessment">
              <VmpModulePage module="Risk Assessment" />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="vmp/timeline"
          element={
            <MenuPermissionRoute menuId="vmp-timeline">
              <VmpModulePage module="Timeline" />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="vmp/database"
          element={
            <MenuPermissionRoute menuId="vmp-database">
              <VmpDatabasePage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="vmp/field-options"
          element={
            <MenuPermissionRoute menuId="registry">
              <VmpFieldOptionsPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="vmp/audit"
          element={
            <MenuPermissionRoute menuId="vmp-audit">
              <VmpModulePage module="Audit Trail" />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="edoc"
          element={
            <MenuPermissionRoute menuId="edoc-dashboard">
              <EdocDashboardPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="edoc/inbox"
          element={
            <MenuPermissionRoute menuId="edoc-inbox">
              <EdocInboxPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="edoc/my-documents"
          element={
            <MenuPermissionRoute menuId="edoc-my-documents">
              <EdocDocumentsPage scope="my" title="My Documents" />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="edoc/documents"
          element={
            <MenuPermissionRoute menuId="edoc-all-documents">
              <EdocDocumentsPage scope="all" title="All Documents" />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="edoc/create"
          element={
            <MenuPermissionRoute menuId="edoc-create">
              <EdocCreateDocumentPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="edoc/returned"
          element={
            <MenuPermissionRoute menuId="edoc-returned">
              <EdocDocumentsPage scope="returned" title="Returned Documents" />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="edoc/completed"
          element={
            <MenuPermissionRoute menuId="edoc-completed">
              <EdocDocumentsPage scope="completed" title="Completed Documents" />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="edoc/templates"
          element={
            <MenuPermissionRoute menuId="edoc-routing-templates">
              <EdocRoutingTemplatesPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="edoc/reports"
          element={
            <MenuPermissionRoute menuId="edoc-reports">
              <EdocReportsPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="edoc/audit"
          element={
            <MenuPermissionRoute menuId="edoc-audit">
              <EdocAuditPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="edoc/admin"
          element={
            <MenuPermissionRoute menuId="edoc-admin">
              <EdocAdministrationPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="edoc/workspace/:assignmentId"
          element={
            <MenuPermissionRoute menuId="edoc-inbox">
              <EdocWorkspacePage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="apqr"
          element={
            <MenuPermissionRoute menuId="apqr-dashboard">
              <ApqrDashboardPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="apqr/registry"
          element={
            <MenuPermissionRoute menuId="apqr-registry">
              <ApqrClientRegistryPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="apqr/scheduler"
          element={
            <MenuPermissionRoute menuId="apqr-scheduler">
              <ApqrSchedulerPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="apqr/database"
          element={
            <MenuPermissionRoute menuId="apqr-database">
              <ApqrDatabasePage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="apqr/form"
          element={
            <MenuPermissionRoute menuId="apqr-form">
              <ApqrFormPage />
            </MenuPermissionRoute>
          }
        />
        <Route
          path="apqr/audit"
          element={
            <MenuPermissionRoute menuId="apqr-audit">
              <ApqrAuditPage />
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
