import { useState, type ReactNode, type SVGProps } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  APP_NAME,
  APP_TAGLINE,
  resolveWorkspaceTitle,
  toSidebarItems,
} from '../../config/appNavigation'
import { findSubmenuLabel } from '../../config/sidebarMenus'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { useTheme } from '../../hooks/useTheme'
import { SidebarNavGroup } from './SidebarNavGroup'

type IconProps = SVGProps<SVGSVGElement>

function IconSidebar(props: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  )
}

function IconVrms(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M12 3 19 6v5c0 4.5-2.8 7.8-7 10-4.2-2.2-7-5.5-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  )
}

function IconVrmsBrand(props: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 2.75 19.25 5.8v5.35c0 4.62-2.9 8.42-7.25 10.1-4.35-1.68-7.25-5.48-7.25-10.1V5.8L12 2.75Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m8.75 12.1 2.2 2.25 4.55-5.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconAdmin(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
      <circle cx="12" cy="7" r="4" />
      <path d="M20 8v6M23 11h-6" />
    </svg>
  )
}

function IconSearch(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function IconGift(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <rect x="3" y="8" width="18" height="13" rx="2" />
      <path d="M12 8v13M3 12h18M12 8c-2-2.5-4-3.5-6-3a3 3 0 0 0 0 6c2 .5 4-.5 6-3Zm0 0c2-2.5 4-3.5 6-3a3 3 0 1 1 0 6c-2 .5-4-.5-6-3Z" />
    </svg>
  )
}

function IconSun(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function IconMoon(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a6.5 6.5 0 0 0 11.5 11.5Z" />
    </svg>
  )
}

function IconGlobe(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" />
    </svg>
  )
}

function IconLogout(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}

const groupIcons = {
  vrms: IconVrms,
  admin: IconAdmin,
} as const

export function AppShell({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { user, logout, usesSupabase } = useAuth()
  const { accessibleNavigationGroups, permissionsReady, canViewMenu } = usePermissions()
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const submenuLabel = findSubmenuLabel(location.pathname, location.hash)
  const current = submenuLabel ?? resolveWorkspaceTitle(location.pathname)

  function closeMobileNav() {
    setIsMobileOpen(false)
  }

  const sidebarClass = [
    'sidebar',
    isCollapsed ? 'collapsed' : '',
    isMobileOpen ? 'open' : '',
  ].filter(Boolean).join(' ')

  const mainClass = isCollapsed ? 'app-main sidebar-collapsed' : 'app-main'

  return (
    <div className="app-shell">
      <aside className={sidebarClass}>
        <div className="sidebar-header">
          <div className="sidebar-brand-mark">
            <IconVrmsBrand />
          </div>
          <div className="sidebar-brand">
            <span className="sidebar-brand-title">{APP_NAME}</span>
            <span className="sidebar-brand-sub">{APP_TAGLINE}</span>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsCollapsed(true)}
            aria-label="Close sidebar"
          >
            <IconSidebar />
          </button>
        </div>

        <div className="sidebar-scroll">
          <nav className="sidebar-nav" aria-label="Main navigation">
            {permissionsReady ? (
              accessibleNavigationGroups.map((group) => {
                const Icon = groupIcons[group.id as keyof typeof groupIcons] ?? IconVrms
                return (
                  <SidebarNavGroup
                    key={group.id}
                    title={group.label}
                    tooltip={group.tooltip}
                    icon={Icon}
                    items={toSidebarItems(group.items)}
                    onNavigate={closeMobileNav}
                  />
                )
              })
            ) : (
              <p className="sidebar-permissions-loading">Loading menus…</p>
            )}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <div className="sidebar-profile-main">
              <div className="sidebar-profile-avatar">{user?.initials}</div>
              <div className="sidebar-profile-meta">
                <strong>{user?.name}</strong>
                <span>{user?.role} account</span>
              </div>
            </div>
            <button type="button" className="sidebar-profile-action" aria-label="Registry settings" onClick={() => navigate('/registry')}>
              <IconGift />
            </button>
          </div>

          <div className="sidebar-environment">
            <span className="environment-dot" />
            {usesSupabase ? 'Supabase live backend' : 'Mock data environment'}
          </div>
        </div>
      </aside>

      <div className={mainClass}>
        <header className="topbar">
          <div className="topbar-leading">
            {isCollapsed && (
              <button
                type="button"
                className="sidebar-expand-btn sidebar-expand-btn-glow"
                onClick={() => setIsCollapsed(false)}
                aria-label="Open sidebar"
              >
                <IconSidebar />
              </button>
            )}
            <button
              type="button"
              className="menu-button sidebar-expand-btn-glow"
              onClick={() => setIsMobileOpen((value) => !value)}
              aria-label="Toggle navigation"
            >
              <IconSidebar />
            </button>
            <p className="topbar-greeting">
              <span className="topbar-greeting-sub">{APP_NAME}</span>
              <span className="topbar-greeting-title">{current}</span>
            </p>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="topbar-icon-circle"
              aria-label="Search workspace"
              disabled={!canViewMenu('database')}
              onClick={() => { closeMobileNav(); navigate('/database') }}
            >
              <IconSearch />
            </button>
            <button
              type="button"
              className="topbar-icon-circle"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
            >
              {isDark ? <IconSun /> : <IconMoon />}
            </button>
            <button type="button" className="topbar-icon-circle" aria-label="Workspace overview" onClick={() => navigate('/')}>
              <IconGlobe />
            </button>
            <button
              type="button"
              className="topbar-profile-chip"
              aria-label="Account settings"
              onClick={() => { closeMobileNav(); navigate('/account') }}
            >
              <span className="topbar-profile-avatar">{user?.initials}</span>
              <span className="topbar-profile-text">
                <strong>{user?.name}</strong>
                <span>{user?.role}</span>
              </span>
            </button>
            <button type="button" className="topbar-icon-circle topbar-icon-quiet" aria-label="Log out" onClick={() => void logout()}>
              <IconLogout />
            </button>
          </div>
        </header>
        <main>{children}</main>
      </div>

      {isMobileOpen && (
        <button type="button" className="sidebar-scrim" onClick={closeMobileNav} aria-label="Close navigation" />
      )}
    </div>
  )
}
