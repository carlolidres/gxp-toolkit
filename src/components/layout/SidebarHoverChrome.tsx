import { useMemo, useRef, type ReactElement } from 'react'
import { NavLink } from 'react-router-dom'
import { Button, Tooltip } from 'antd'
import { PanelLeft } from 'lucide-react'

import type { NavGroupDefinition } from '../../config/appNavigation'
import { toSidebarItems } from '../../config/appNavigation'
import {
  isSidebarItemActive,
  submenuHref,
  submenuNavLinkEnd,
} from '../../config/sidebarMenus'
import { useSidebarMenuOrder } from '../../hooks/useSidebarMenuOrder'
import { iconSize, iconStroke } from '../../theme/iconSizes'

type GroupIcon = (props: { className?: string }) => ReactElement

export function SidebarHoverChrome({
  groups,
  groupIcons,
  exiting,
  onExpand,
  pathname,
  hash,
}: {
  groups: NavGroupDefinition[]
  groupIcons: Record<string, GroupIcon>
  exiting: boolean
  onExpand: () => void
  pathname: string
  hash: string
}) {
  const chromeRef = useRef<HTMLDivElement>(null)
  const { orderedGroups } = useSidebarMenuOrder(groups)

  const railGroups = useMemo(
    () =>
      orderedGroups.map((group) => {
        const items = toSidebarItems(group.items)
        return {
          ...group,
          items,
          isActive: items.some((item) => isSidebarItemActive(item, pathname, hash)),
        }
      }),
    [orderedGroups, pathname, hash],
  )

  function popupContainer(): HTMLElement {
    return chromeRef.current ?? document.body
  }

  return (
    <div
      ref={chromeRef}
      className={['sidebar-hover-chrome', exiting ? 'is-exiting' : ''].filter(Boolean).join(' ')}
    >
      <Tooltip title="Expand sidebar" placement="right" mouseEnterDelay={0.2} getPopupContainer={popupContainer}>
        <Button
          type="text"
          className="sidebar-expand-fab"
          onClick={onExpand}
          aria-label="Expand sidebar"
          icon={<PanelLeft size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
        />
      </Tooltip>

      <nav className="sidebar-hover-rail" aria-label="Collapsed navigation">
        {railGroups.map((group) => {
          const Icon = groupIcons[group.id] ?? groupIcons.vrms
          return (
            <div
              key={group.id}
              className={
                group.isActive ? 'sidebar-hover-group is-active' : 'sidebar-hover-group'
              }
            >
              <button
                type="button"
                className={
                  group.isActive
                    ? 'sidebar-hover-rail-item is-active'
                    : 'sidebar-hover-rail-item'
                }
                aria-label={group.tooltip ?? group.label}
                aria-haspopup="menu"
                aria-controls={`sidebar-hover-submenu-${group.id}`}
              >
                <Icon />
              </button>

              <div
                id={`sidebar-hover-submenu-${group.id}`}
                className="sidebar-hover-submenu"
                role="menu"
                aria-label={`${group.label} menu`}
              >
                {group.items.map((item) => {
                  const active = isSidebarItemActive(item, pathname, hash)
                  return (
                    <NavLink
                      key={item.id}
                      to={submenuHref(item)}
                      end={submenuNavLinkEnd(item, group.items)}
                      role="menuitem"
                      className={
                        active
                          ? 'sidebar-hover-subitem is-active'
                          : 'sidebar-hover-subitem'
                      }
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.label}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>
    </div>
  )
}
