import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, Tooltip } from 'antd'
import {
  Bell,
  FileCheck2,
  FileText,
  Gift,
  Info,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  PanelLeft,
  Shield,
  Sun,
  Users,
} from 'lucide-react'

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
import { iconSize, iconStroke } from '../../theme/iconSizes'

const groupIcons = {
  vrms: (props: { className?: string }) => (
    <Shield size={iconSize.md} strokeWidth={iconStroke} aria-hidden {...props} />
  ),
  vmp: (props: { className?: string }) => (
    <FileCheck2 size={iconSize.md} strokeWidth={iconStroke} aria-hidden {...props} />
  ),
  edoc: (props: { className?: string }) => (
    <FileText size={iconSize.md} strokeWidth={iconStroke} aria-hidden {...props} />
  ),
  apqr: (props: { className?: string }) => (
    <LayoutDashboard size={iconSize.md} strokeWidth={iconStroke} aria-hidden {...props} />
  ),
  admin: (props: { className?: string }) => (
    <Users size={iconSize.md} strokeWidth={iconStroke} aria-hidden {...props} />
  ),
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
    <div className="app-shell gxp-antd-shell">
      <aside className={sidebarClass}>
        <div className="sidebar-header">
          <GxpLogo variant="lockup" showTagline className="sidebar-brand-lockup" />
          <div className="sidebar-brand visually-hidden">
            <span className="sidebar-brand-title">{APP_NAME}</span>
            <span className="sidebar-brand-sub">{APP_TAGLINE}</span>
          </div>
          <Button
            type="text"
            className="sidebar-toggle"
            onClick={() => setIsCollapsed(true)}
            aria-label="Close sidebar"
            icon={<PanelLeft size={iconSize.lg} strokeWidth={iconStroke} aria-hidden />}
          />
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
              <Avatar className="sidebar-profile-avatar" size={36}>
                {user?.initials}
              </Avatar>
              <div className="sidebar-profile-meta">
                <strong>{user?.name}</strong>
                <span>{user?.role} account</span>
              </div>
            </div>
            <Tooltip title="Registry settings">
              <Button
                type="text"
                className="sidebar-profile-action"
                aria-label="Registry settings"
                onClick={() => navigate('/registry')}
                icon={<Gift size={iconSize.md} strokeWidth={iconStroke} aria-hidden />}
              />
            </Tooltip>
          </div>
        </div>
      </aside>

      <div className={mainClass}>
        <header className="topbar">
          <div className="topbar-leading">
            {isCollapsed && (
              <Button
                type="text"
                className="sidebar-expand-btn sidebar-expand-btn-glow"
                onClick={() => setIsCollapsed(false)}
                aria-label="Open sidebar"
                icon={<PanelLeft size={iconSize.lg} strokeWidth={iconStroke} aria-hidden />}
              />
            )}
            <Button
              type="text"
              className="menu-button sidebar-expand-btn-glow"
              onClick={() => setIsMobileOpen((value) => !value)}
              aria-label="Toggle navigation"
              icon={<PanelLeft size={iconSize.lg} strokeWidth={iconStroke} aria-hidden />}
            />
            <GxpBrandMark inline />
            <p className="topbar-greeting">
              <span className="topbar-greeting-sub">{APP_NAME}</span>
              <span className="topbar-greeting-title">{current}</span>
            </p>
          </div>
          <div className="topbar-actions" role="toolbar" aria-label="Application actions">
            <div className="topbar-actions-cluster" role="group" aria-label="Quick actions">
              <Tooltip title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
                <Button
                  type="text"
                  className="topbar-icon-circle"
                  aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                  onClick={toggleTheme}
                  icon={
                    isDark ? (
                      <Sun size={iconSize.md} strokeWidth={iconStroke} aria-hidden />
                    ) : (
                      <Moon size={iconSize.md} strokeWidth={iconStroke} aria-hidden />
                    )
                  }
                />
              </Tooltip>
              <Tooltip title={isAdmin && unreadCount > 0 ? `Messages (${unreadCount} unread)` : 'Messages'}>
                <Badge count={isAdmin ? unreadCount : 0} size="small" offset={[-4, 4]}>
                  <Button
                    type="text"
                    className={[
                      'topbar-icon-circle',
                      isAdmin && unreadCount > 0 ? 'topbar-icon-unread' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={isAdmin && unreadCount > 0 ? `Messages (${unreadCount} unread)` : 'Messages'}
                    onClick={() => openMessages()}
                    icon={<MessageSquare size={iconSize.md} strokeWidth={iconStroke} aria-hidden />}
                  />
                </Badge>
              </Tooltip>
              <Tooltip title="Version history and release notes">
                <Button
                  type="text"
                  className="topbar-icon-circle"
                  aria-label="Version history and release notes"
                  aria-expanded={versionHistoryOpen}
                  onClick={() => openVersionHistory()}
                  icon={<Info size={iconSize.md} strokeWidth={iconStroke} aria-hidden />}
                />
              </Tooltip>
              {showApqrNotifications ? (
                <Tooltip
                  title={
                    apqrPendingCount > 0
                      ? `APQR notifications (${apqrPendingCount} pending)`
                      : 'APQR notifications'
                  }
                >
                  <Badge count={apqrPendingCount} overflowCount={9} size="small" offset={[-4, 4]}>
                    <Button
                      type="text"
                      className={[
                        'topbar-icon-circle',
                        'topbar-icon-with-badge',
                        apqrPendingCount > 0 ? 'topbar-icon-unread' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label={
                        apqrPendingCount > 0
                          ? `APQR notifications (${apqrPendingCount} pending)`
                          : 'APQR notifications'
                      }
                      onClick={() => openNotifications()}
                      icon={<Bell size={iconSize.md} strokeWidth={iconStroke} aria-hidden />}
                    />
                  </Badge>
                </Tooltip>
              ) : null}
            </div>
            <span className="topbar-actions-divider" aria-hidden="true" />
            <div className="topbar-actions-cluster" role="group" aria-label="Account">
              <Button
                type="text"
                className="topbar-profile-chip"
                aria-label="Account settings"
                onClick={() => {
                  closeMobileNav()
                  navigate('/account')
                }}
              >
                <Avatar size={28}>{user?.initials}</Avatar>
                <span className="topbar-profile-text">
                  <strong>{user?.name}</strong>
                  <span>{user?.role}</span>
                </span>
              </Button>
              <Tooltip title="Log out">
                <Button
                  type="text"
                  className="topbar-icon-circle topbar-icon-quiet"
                  aria-label="Log out"
                  onClick={() => void logout()}
                  icon={<LogOut size={iconSize.md} strokeWidth={iconStroke} aria-hidden />}
                />
              </Tooltip>
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

function GxpBrandMark({ inline = false }: { inline?: boolean }) {
  return (
    <span className={inline ? 'topbar-brand-logo gxp-brand-mark' : 'gxp-brand-mark'} aria-hidden="true">
      <Shield size={iconSize.md} strokeWidth={iconStroke} />
    </span>
  )
}
