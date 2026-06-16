import { useEffect, useState, type ReactElement, type SVGProps } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import type { SidebarSubmenuItem } from '../../config/sidebarMenus'
import { submenuHref } from '../../config/sidebarMenus'

type IconProps = SVGProps<SVGSVGElement>

function IconChevron(props: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="sidebar-chevron" aria-hidden="true" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function SidebarNavGroup({
  title,
  icon: Icon,
  items,
  onNavigate,
}: {
  title: string
  icon: (props: IconProps) => ReactElement
  items: SidebarSubmenuItem[]
  onNavigate?: () => void
}) {
  const location = useLocation()
  const basePath = items[0]?.path ?? '/'
  const isOnSection = location.pathname === basePath
  const hasActiveChild = items.some(
    (item) => item.path === location.pathname && location.hash === `#${item.hash}`,
  )

  const [isOpen, setIsOpen] = useState(isOnSection || hasActiveChild)

  useEffect(() => {
    if (isOnSection || hasActiveChild) setIsOpen(true)
  }, [isOnSection, hasActiveChild])

  return (
    <div className={`sidebar-nav-group${isOpen ? ' open' : ''}`}>
      <button
        type="button"
        className="sidebar-nav-group-toggle"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <Icon />
        <span>{title}</span>
        <IconChevron />
      </button>
      {isOpen && (
        <div className="sidebar-nav-group-items">
          {items.map((item) => {
            const href = submenuHref(item)
            const isActive = location.pathname === item.path && location.hash === `#${item.hash}`
            return (
              <NavLink
                key={item.id}
                to={href}
                className={isActive ? 'sidebar-nav-subitem active' : 'sidebar-nav-subitem'}
                onClick={onNavigate}
              >
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}
