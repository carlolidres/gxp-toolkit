import { useState, type ReactNode, type SVGProps } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

import { appModuleMenu, findSubmenuLabel, multiTabFormsMenu, multiformComponentMenu } from '../../config/sidebarMenus'
import { useAuth } from '../../hooks/useAuth'
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

function IconNewWorkspace(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
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

function IconLibrary(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  )
}

function IconGrid(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function IconForms(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  )
}

function IconOverview(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  )
}

function IconProcess(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h10" />
      <path d="M4 18h14" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}

function IconDocuments(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

function IconRouting(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M8 6h8M7.2 7.2 10.8 16.8M16.8 7.2 13.2 16.8" />
    </svg>
  )
}

function IconSignature(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M3 17c2.5-3 5.5-3 8-1s5.5 2 8-1" />
      <path d="M3 21h18" />
    </svg>
  )
}

function IconSettings(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function IconChat(props: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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

const navigation = [
  { path: '/', label: 'Overview', icon: IconOverview },
  { path: '/cpv', label: 'Process verification', icon: IconProcess },
  { path: '/documents', label: 'Documents', icon: IconDocuments },
  { path: '/routing', label: 'Approvals', icon: IconRouting },
  { path: '/signatures', label: 'E-signatures', icon: IconSignature },
  { path: '/settings', label: 'Settings', icon: IconSettings },
]

const pinnedItems = [
  { path: '/routing', label: 'Routing eDocs' },
  { path: '/signatures', label: 'E-signature queue' },
]

const recentItems = [
  { path: '/documents', label: 'Operational handoff docs' },
  { path: '/statistics', label: 'Analytics dashboard' },
  { path: '/cpv', label: 'Process verification' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const submenuLabel = findSubmenuLabel(location.pathname, location.hash)
  const current = submenuLabel ?? navigation.find((item) => item.path === location.pathname)?.label ?? 'Northstar'

  function closeMobileNav() {
    setIsMobileOpen(false)
  }

  function handleNewWorkspace() {
    closeMobileNav()
    navigate('/components')
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
          <div className="sidebar-brand">
            <span className="sidebar-brand-title">Northstar</span>
            <span className="sidebar-brand-sub">Quality systems kit</span>
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
          <button type="button" className="sidebar-new-chat" onClick={handleNewWorkspace}>
            <IconNewWorkspace />
            <span>New workspace</span>
          </button>

          <nav className="sidebar-nav" aria-label="Main navigation">
            <button type="button" className="sidebar-nav-item sidebar-nav-button" onClick={() => { closeMobileNav(); navigate('/documents') }}>
              <IconSearch />
              <span>Search documents</span>
            </button>

            <SidebarNavGroup
              title="Multiform components"
              icon={IconLibrary}
              items={multiformComponentMenu}
              onNavigate={closeMobileNav}
            />
            <SidebarNavGroup
              title="Multi-tab forms"
              icon={IconForms}
              items={multiTabFormsMenu}
              onNavigate={closeMobileNav}
            />
            <SidebarNavGroup
              title="App modules"
              icon={IconGrid}
              items={appModuleMenu}
              onNavigate={closeMobileNav}
            />

            {navigation.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} end={path === '/'} to={path} className="sidebar-nav-item" onClick={closeMobileNav}>
                <Icon />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-section">
            <p className="sidebar-section-label">Pinned</p>
            <div className="sidebar-section-list">
              {pinnedItems.map((item) => (
                <NavLink key={item.path} to={item.path} className="sidebar-pinned-item" onClick={closeMobileNav}>
                  <IconChat />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <p className="sidebar-section-label">Recents</p>
            <div className="sidebar-section-list">
              {recentItems.map((item) => (
                <NavLink key={item.label} to={item.path} className="sidebar-recent-item" onClick={closeMobileNav}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
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
          <button type="button" className="sidebar-profile-action" aria-label="Account options" onClick={() => navigate('/settings')}>
            <IconGift />
          </button>
        </div>

        <div className="sidebar-environment">
          <span className="environment-dot" />
          Mock data environment
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
              <span className="topbar-greeting-sub">Workspace</span>
              <span className="topbar-greeting-title">{current}</span>
            </p>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="topbar-icon-circle"
              aria-label="Search workspace"
              onClick={() => { closeMobileNav(); navigate('/documents') }}
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
              onClick={() => navigate('/settings')}
            >
              <span className="topbar-profile-avatar">{user?.initials}</span>
              <span className="topbar-profile-text">
                <strong>{user?.name}</strong>
                <span>{user?.role}</span>
              </span>
            </button>
            <button type="button" className="topbar-icon-circle topbar-icon-quiet" aria-label="Log out" onClick={logout}>
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
