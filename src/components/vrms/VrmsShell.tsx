import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useVrmsApp } from '../../context/VrmsAppContext'
import { VRMS_APP_TITLE } from '../../lib/vrmsDefaults'

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      {children}
    </svg>
  )
}

const navItems = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
  },
  {
    to: '/routing',
    label: 'Document Routing',
    icon: (
      <>
        <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
        <path d="M14 2v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </>
    ),
  },
  {
    to: '/database',
    label: 'Database',
    icon: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
  },
  {
    to: '/audit',
    label: 'Audit Trail',
    icon: (
      <>
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <path d="M9 2v4" />
        <path d="M15 2v4" />
        <path d="M9 11h6" />
        <path d="M9 15h4" />
      </>
    ),
  },
  {
    to: '/registry',
    label: 'Registry',
    icon: (
      <>
        <path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4z" />
        <path d="M7 4v14" />
        <path d="M10 8h5" />
        <path d="M10 12h5" />
        <path d="M10 16h3" />
      </>
    ),
  },
]

export function VrmsShell() {
  const { appData, loading } = useVrmsApp()
  const user = appData?.user ?? 'Loading...'
  const initials = user.charAt(0).toUpperCase()

  return (
    <div className="vrms-app">
      <aside className="vrms-sidebar">
        <div className="vrms-brand">
          <div className="vrms-logo">VR</div>
          <div>
            <strong>VRMS</strong>
            <span>VALIDATION ROUTING</span>
          </div>
        </div>

        <nav aria-label="VRMS navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `vrms-nav${isActive ? ' active' : ''}`}
            >
              <NavIcon>{item.icon}</NavIcon>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="vrms-user">
          <div className="vrms-user-avatar">{initials}</div>
          <div>
            <span className="vrms-user-name">{user}</span>
            <span className="vrms-user-role">{loading ? 'Loading data...' : 'Authenticated user'}</span>
          </div>
        </div>
      </aside>

      <div className="vrms-main">
        <header className="vrms-header">
          <span>{VRMS_APP_TITLE}</span>
          {loading && <span className="vrms-muted" style={{ margin: 0, fontSize: 14 }}>Refreshing…</span>}
        </header>
        <div className="vrms-page">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
