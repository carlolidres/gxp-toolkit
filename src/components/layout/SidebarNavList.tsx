import { useEffect, useMemo, useState, type DragEvent, type ReactElement, type SVGProps } from 'react'
import { useLocation } from 'react-router-dom'

import type { NavGroupDefinition } from '../../config/appNavigation'
import { toSidebarItems } from '../../config/appNavigation'
import { isSidebarItemActive } from '../../config/sidebarMenus'
import { useSidebarMenuOrder } from '../../hooks/useSidebarMenuOrder'
import { SidebarNavGroup } from './SidebarNavGroup'

type IconProps = SVGProps<SVGSVGElement>

export function SidebarNavList({
  groups,
  groupIcons,
  onNavigate,
}: {
  groups: NavGroupDefinition[]
  groupIcons: Record<string, (props: IconProps) => ReactElement>
  onNavigate?: () => void
}) {
  const { orderedGroups, moveGroup } = useSidebarMenuOrder(groups)
  const location = useLocation()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const activeGroupId = useMemo(() => {
    for (const group of orderedGroups) {
      const items = toSidebarItems(group.items)
      if (items.some((item) => isSidebarItemActive(item, location.pathname, location.hash))) {
        return group.id
      }
    }
    return null
  }, [orderedGroups, location.pathname, location.hash])

  const [openGroupId, setOpenGroupId] = useState<string | null>(activeGroupId)

  useEffect(() => {
    if (activeGroupId) setOpenGroupId(activeGroupId)
  }, [activeGroupId])

  function handleToggle(groupId: string) {
    setOpenGroupId((current) => (current === groupId ? null : groupId))
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>, groupId: string) {
    const groupEl = event.currentTarget.closest('.sidebar-nav-group')
    if (groupEl instanceof HTMLElement) {
      event.dataTransfer.setDragImage(groupEl, 24, 20)
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', groupId)
    setDraggingId(groupId)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setOverId(null)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, groupId: string) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (groupId !== draggingId) setOverId(groupId)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain')
    if (sourceId && sourceId !== targetId) moveGroup(sourceId, targetId)
    handleDragEnd()
  }

  return (
    <nav className="sidebar-nav" aria-label="Main navigation">
      {orderedGroups.map((group) => {
        const Icon = groupIcons[group.id] ?? groupIcons.vrms
        return (
          <SidebarNavGroup
            key={group.id}
            title={group.label}
            tooltip={group.tooltip}
            icon={Icon}
            items={toSidebarItems(group.items)}
            isOpen={openGroupId === group.id}
            onToggle={() => handleToggle(group.id)}
            onNavigate={onNavigate}
            isDragging={draggingId === group.id}
            isDropTarget={overId === group.id && draggingId !== group.id}
            onDragStart={(event) => handleDragStart(event, group.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(event) => handleDragOver(event, group.id)}
            onDrop={(event) => handleDrop(event, group.id)}
          />
        )
      })}
    </nav>
  )
}
