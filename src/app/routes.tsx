import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { LoadingState } from '../components/feedback/FeedbackStates'
import { AppShell } from '../components/layout/AppShell'
import { LoginPage } from '../pages/LoginPage'

const MultiTabFormsPage = lazy(() => import('../pages/MultiTabFormsPage').then((module) => ({ default: module.MultiTabFormsPage })))
const ComponentsShowcasePage = lazy(() => import('../pages/ComponentsShowcasePage').then((module) => ({ default: module.ComponentsShowcasePage })))
const ContinuousProcessVerificationPage = lazy(() => import('../pages/ContinuousProcessVerificationPage').then((module) => ({ default: module.ContinuousProcessVerificationPage })))
const DashboardPage = lazy(() => import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const DocumentManagementPage = lazy(() => import('../pages/DocumentManagementPage').then((module) => ({ default: module.DocumentManagementPage })))
const DocumentRoutingPage = lazy(() => import('../pages/DocumentRoutingPage').then((module) => ({ default: module.DocumentRoutingPage })))
const ESignaturePage = lazy(() => import('../pages/ESignaturePage').then((module) => ({ default: module.ESignaturePage })))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const StatisticsDashboardPage = lazy(() => import('../pages/StatisticsDashboardPage').then((module) => ({ default: module.StatisticsDashboardPage })))

function SecuredPage({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  return <ProtectedRoute roles={adminOnly ? ['Admin'] : undefined}><AppShell><Suspense fallback={<div className="page"><LoadingState label="Loading page" /></div>}>{children}</Suspense></AppShell></ProtectedRoute>
}

export function AppRoutes() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/" element={<SecuredPage><DashboardPage /></SecuredPage>} /><Route path="/components" element={<SecuredPage><ComponentsShowcasePage /></SecuredPage>} /><Route path="/multiforms" element={<SecuredPage><MultiTabFormsPage /></SecuredPage>} /><Route path="/statistics" element={<SecuredPage><StatisticsDashboardPage /></SecuredPage>} /><Route path="/cpv" element={<SecuredPage><ContinuousProcessVerificationPage /></SecuredPage>} /><Route path="/documents" element={<SecuredPage><DocumentManagementPage /></SecuredPage>} /><Route path="/routing" element={<SecuredPage><DocumentRoutingPage /></SecuredPage>} /><Route path="/signatures" element={<SecuredPage><ESignaturePage /></SecuredPage>} /><Route path="/settings" element={<SecuredPage adminOnly><SettingsPage /></SecuredPage>} /><Route path="*" element={<SecuredPage><NotFoundPage /></SecuredPage>} /></Routes>
}
