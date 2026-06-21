import type { JSX, SVGProps } from 'react'

import { PROJECT_TABS, type ProjectTab, projectTabKey } from '../../lib/projectFormFields'

type IconProps = SVGProps<SVGSVGElement>

function IconUser(props: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 6-6 8-6s6.5 2 8 6" />
    </svg>
  )
}

function IconProject(props: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M3 7h18M3 12h12M3 17h15" />
    </svg>
  )
}

function IconKey(props: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="3" />
      <path d="M11 11l9 9M16 6l2 2" />
    </svg>
  )
}

function IconLab(props: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M9 3v6l-5 9a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3l-5-9V3" />
    </svg>
  )
}

function IconSearch(props: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

const TAB_ICONS: Record<ProjectTab, (props: IconProps) => JSX.Element> = {
  'AM/BM/PL': IconUser,
  PP: IconProject,
  TSD: IconKey,
  VAL: IconLab,
  QC: IconSearch,
}

export function ProjectRoleTabs({
  activeTab,
  onChange,
}: {
  activeTab: ProjectTab
  onChange: (tab: ProjectTab) => void
}) {
  return (
    <div className="project-tabs" id="project-tabs" role="tablist" aria-label="Project role tabs">
      {PROJECT_TABS.map((tab) => {
        const key = projectTabKey(tab)
        const isActive = activeTab === tab
        const Icon = TAB_ICONS[tab]
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`project-tab project-tab-${key}${isActive ? ' project-tab-active' : ''}`}
            onClick={() => onChange(tab)}
          >
            <span className="project-tab-icon"><Icon /></span>
            {tab}
          </button>
        )
      })}
    </div>
  )
}
