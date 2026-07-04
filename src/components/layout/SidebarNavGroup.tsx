import { type DragEvent, type ReactElement, type SVGProps } from 'react'
import { NavLink } from 'react-router-dom'

import type { SidebarSubmenuItem } from '../../config/sidebarMenus'
import { submenuHref, submenuNavLinkEnd } from '../../config/sidebarMenus'

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
  tooltip,
  icon: Icon,
  items,
  isOpen,
  onToggle,
  onNavigate,
  isDragging = false,
  isDropTarget = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  title: string
  tooltip?: string
  icon: (props: IconProps) => ReactElement
  items: SidebarSubmenuItem[]
  isOpen: boolean
  onToggle: () => void
  onNavigate?: () => void
  isDragging?: boolean
  isDropTarget?: boolean
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void
  onDrop?: (event: DragEvent<HTMLDivElement>) => void
}) {
  const groupClass = [
    'sidebar-nav-group',
    isOpen ? 'open' : '',
    isDragging ? 'is-dragging' : '',
    isDropTarget ? 'is-drop-target' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={groupClass}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <button
        type="button"
        className="sidebar-nav-group-toggle"
        aria-expanded={isOpen}
        title={tooltip}
        draggable={Boolean(onDragStart)}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onToggle}
      >
        <Icon />
        <span>{title}</span>
        <IconChevron />
      </button>
      {isOpen && (
        <div className="sidebar-nav-group-items">
          {items.map((item) => {
            const href = submenuHref(item)
            return (
              <NavLink
                key={item.id}
                to={href}
                end={submenuNavLinkEnd(item, items)}
                className={({ isActive }) =>
                  isActive ? 'sidebar-nav-subitem active' : 'sidebar-nav-subitem'
                }
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
