import { useState, type ReactNode, type SVGProps } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  APP_NAME,
  APP_TAGLINE,
  resolveWorkspaceTitle,
} from '../../config/appNavigation'
import { findSubmenuLabel } from '../../config/sidebarMenus'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { useTheme } from '../../hooks/useTheme'
import { MessagesModal } from '../feedback/MessagesModal'
import { ApqrNotificationsModal } from '../feedback/ApqrNotificationsModal'
import { VersionHistoryDrawer } from '../feedback/VersionHistoryDrawer'
import { GxpLogo } from '../brand/GxpLogo'
import { useFeedbackMessages } from '../../hooks/useFeedbackMessages'
import { useApqrNotifications } from '../../hooks/useApqrNotifications'
import { SidebarNavList } from './SidebarNavList'

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

function IconAdmin(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
      <circle cx="12" cy="7" r="4" />
      <path d="M20 8v6M23 11h-6" />
    </svg>
  )
}

function IconVmp(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M8 4h8l2 3v13H6V7l2-3Z" />
      <path d="M8 4v3h8V4" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  )
}

function IconEdoc(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h4" />
      <path d="M9 13h6M9 17h4" />
      <path d="m5 9-2 2 2 2" />
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

function IconMessage(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.2A8 8 0 1 1 21 12Z" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  )
}

function IconBell(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function IconInfo(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.75" fill="currentColor" stroke="none" />
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
  vmp: IconVmp,
  edoc: IconEdoc,
  admin: IconAdmin,
} as const

export function AppShell({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const { user, logout } = useAuth()
  const { messages, loading, unreadCount, isAdmin, refresh, acknowledgeUnread } = useFeedbackMessages()
  const { accessibleNavigationGroups, permissionsReady, canViewMenu } = usePermissions()
  const showApqrNotifications = canViewMenu('apqr-dashboard') || canViewMenu('apqr-scheduler')
  const { summary: apqrNotifications, loading: apqrNotificationsLoading, pendingCount: apqrPendingCount, refresh: refreshApqrNotifications } =
    useApqrNotifications(showApqrNotifications)
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
          <GxpLogo variant="mark" className="sidebar-brand-logo" />
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
          {permissionsReady ? (
            <SidebarNavList
              groups={accessibleNavigationGroups}
              groupIcons={groupIcons}
              onNavigate={closeMobileNav}
            />
          ) : (
            <p className="sidebar-permissions-loading">Loading menus…</p>
          )}
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
            <GxpLogo variant="mark" className="topbar-brand-logo" />
            <p className="topbar-greeting">
              <span className="topbar-greeting-sub">{APP_NAME}</span>
              <span className="topbar-greeting-title">{current}</span>
            </p>
          </div>
          <div className="topbar-actions" role="toolbar" aria-label="Application actions">
            <div className="topbar-actions-cluster" role="group" aria-label="Quick actions">
              <button
                type="button"
                className="topbar-icon-circle"
                aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={toggleTheme}
              >
                {isDark ? <IconSun /> : <IconMoon />}
              </button>
              <button
                type="button"
                className={[
                  'topbar-icon-circle',
                  isAdmin && unreadCount > 0 ? 'topbar-icon-unread' : '',
                ].filter(Boolean).join(' ')}
                aria-label={isAdmin && unreadCount > 0 ? `Messages (${unreadCount} unread)` : 'Messages'}
                onClick={() => openMessages()}
              >
                <IconMessage />
              </button>
              <button
                type="button"
                className="topbar-icon-circle"
                aria-label="Version history and release notes"
                aria-expanded={versionHistoryOpen}
                onClick={() => openVersionHistory()}
              >
                <IconInfo />
              </button>
              {showApqrNotifications ? (
                <button
                  type="button"
                  className={[
                    'topbar-icon-circle',
                    'topbar-icon-with-badge',
                    apqrPendingCount > 0 ? 'topbar-icon-unread' : '',
                  ].filter(Boolean).join(' ')}
                  aria-label={apqrPendingCount > 0 ? `APQR notifications (${apqrPendingCount} pending)` : 'APQR notifications'}
                  onClick={() => openNotifications()}
                >
                  <IconBell />
                  {apqrPendingCount > 0 ? (
                    <span className="topbar-icon-badge" aria-hidden="true">
                      {apqrPendingCount > 9 ? '9+' : apqrPendingCount}
                    </span>
                  ) : null}
                </button>
              ) : null}
            </div>
            <span className="topbar-actions-divider" aria-hidden="true" />
            <div className="topbar-actions-cluster" role="group" aria-label="Account">
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
          </div>
        </header>
        <main>{children}</main>
      </div>

      {isMobileOpen && (
        <button type="button" className="sidebar-scrim" onClick={closeMobileNav} aria-label="Close navigation" />
      )}

      <MessagesModal
        isOpen={messagesOpen}
        onClose={() => setMessagesOpen(false)}
        messages={messages}
        loading={loading}
        isAdmin={isAdmin}
        onRefresh={refresh}
        onAcknowledgeUnread={acknowledgeUnread}
      />
      <ApqrNotificationsModal
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        summary={apqrNotifications}
        loading={apqrNotificationsLoading}
      />
      <VersionHistoryDrawer
        isOpen={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
      />
    </div>
  )

  function openMessages() {
    closeMobileNav()
    setMessagesOpen(true)
  }

  function openNotifications() {
    closeMobileNav()
    setNotificationsOpen(true)
    void refreshApqrNotifications()
  }

  function openVersionHistory() {
    closeMobileNav()
    setVersionHistoryOpen(true)
  }
}
