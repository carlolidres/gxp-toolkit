import { type DragEvent, type ReactElement } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

import type { SidebarSubmenuItem } from '../../config/sidebarMenus'
import { submenuHref, submenuNavLinkEnd } from '../../config/sidebarMenus'
import { iconSize, iconStroke } from '../../theme/iconSizes'

type GroupIcon = (props: { className?: string }) => ReactElement

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
  icon: GroupIcon
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
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={groupClass} onDragOver={onDragOver} onDrop={onDrop}>
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
        <ChevronDown
          size={iconSize.sm}
          strokeWidth={iconStroke}
          className="sidebar-chevron"
          aria-hidden
        />
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
