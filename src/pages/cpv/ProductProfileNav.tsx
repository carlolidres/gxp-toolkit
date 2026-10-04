import type { LucideIcon } from 'lucide-react'
import {
  Box,
  Clock,
  FileText,
  FlaskConical,
  Folder,
  Layers,
  MessageSquare,
  PanelLeft,
  Settings,
  TriangleAlert,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from 'antd'

import { PRODUCT_PROFILE_SECTIONS, productProfilePath, type ProductProfileSectionId } from '../../features/cpv/productProfile'
import { iconSize, iconStroke } from '../../theme/iconSizes'

const ICONS: Record<ProductProfileSectionId, LucideIcon> = {
  'raw-material': Layers,
  'packaging-material': Box,
  'in-process-control': Settings,
  'analytical-report': FileText,
  stability: FlaskConical,
  'holding-time': Clock,
  'other-data': Folder,
  'deviation-report': TriangleAlert,
  'product-complaints': MessageSquare,
}

export function ProductProfileNav({ productCode, onNavigate }: { productCode: string; onNavigate?: () => void }) {
  return (
    <nav className="sidebar-nav" aria-label="Product profile">
      {PRODUCT_PROFILE_SECTIONS.map((section) => {
        const Icon = ICONS[section.id]
        return (
          <NavLink
            key={section.id}
            to={productProfilePath(productCode, section.id)}
            className={({ isActive }) => (isActive ? 'sidebar-nav-item active' : 'sidebar-nav-item')}
            onClick={onNavigate}
          >
            <Icon size={iconSize.md} strokeWidth={iconStroke} aria-hidden />
            <span>{section.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

export function ProductProfileRail({
  productCode,
  exiting,
  onExpand,
}: {
  productCode: string
  exiting: boolean
  onExpand: () => void
}) {
  return (
    <div className={['sidebar-hover-chrome', exiting ? 'is-exiting' : ''].filter(Boolean).join(' ')}>
      <Button
        type="text"
        className="sidebar-expand-fab"
        onClick={onExpand}
        aria-label="Expand sidebar"
        icon={<PanelLeft size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
      />
      <nav className="sidebar-hover-rail" aria-label="Product profile">
        {PRODUCT_PROFILE_SECTIONS.map((section) => {
          const Icon = ICONS[section.id]
          return (
            <NavLink
              key={section.id}
              to={productProfilePath(productCode, section.id)}
              title={section.label}
              aria-label={section.label}
              className={({ isActive }) => (isActive ? 'sidebar-hover-rail-item is-active' : 'sidebar-hover-rail-item')}
            >
              <Icon size={iconSize.md} strokeWidth={iconStroke} aria-hidden />
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
