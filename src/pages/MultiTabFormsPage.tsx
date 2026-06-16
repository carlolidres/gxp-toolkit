import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ProjectHierarchyPanel } from '../components/multiform/ProjectHierarchyPanel'
import { ProjectRoleTabs } from '../components/multiform/ProjectRoleTabs'
import { useToast } from '../components/feedback/ToastProvider'
import { FormField, SelectInput, TextInput } from '../components/forms/FormControls'
import { useScrollToHash } from '../hooks/useScrollToHash'
import { PROJECT_TABS, type ProjectTab, projectTabKey, tabFromHash } from '../lib/projectFormFields'

function hashForTab(tab: ProjectTab): string {
  return `#tab-${projectTabKey(tab)}`
}

export function MultiTabFormsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { notify } = useToast()
  const [activeTab, setActiveTab] = useState<ProjectTab>('AM/BM/PL')
  useScrollToHash(120)

  useEffect(() => {
    const tab = tabFromHash(location.hash)
    if (tab) setActiveTab(tab)
  }, [location.hash])

  function selectTab(tab: ProjectTab) {
    setActiveTab(tab)
    navigate(`/multiforms${hashForTab(tab)}`, { replace: true })
    document.getElementById('project-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <div className="page multiform-page">
      <div className="page-header page-header-compact">
        <div>
          <span className="eyebrow">Project Tracker pattern</span>
          <h1>Multi-tab project forms</h1>
          <p>Role-based tabs with nested batch / MO hierarchy, adapted from the reference Project Tracker UI.</p>
        </div>
      </div>

      <section className="project-panel page-section" id="project-entry">
        <div className="project-sticky-header">
          <div className="project-sticky-header-text">
            <span className="project-header-label">PROJ-2026-010</span>
            <h2>New Project</h2>
            <p>Client: <span className="project-header-client-na">N/A</span></p>
          </div>
          <div className="project-sticky-header-actions">
            <button type="button" className="button secondary" aria-label="Expand all" title="Expand all">⤢</button>
            <button type="button" className="button secondary" aria-label="Add batch" title="Add batch">+</button>
            <button type="button" className="button secondary" aria-label="Delete project" title="Delete">⌫</button>
            <button type="button" className="button primary" onClick={() => notify('Mock project saved')}>Save</button>
          </div>
        </div>

        <div className="project-form-body">
          <section className="project-header-section">
            <div className="project-form-grid">
              <FormField label="Project ID"><TextInput value="PROJ-2026-010" readOnly /></FormField>
              <FormField label="Project Owner"><TextInput placeholder="N/A" /></FormField>
              <FormField label="Activity Type">
                <SelectInput>
                  <option value="">N/A</option>
                  <option value="pilot">PILOT/TRIAL</option>
                  <option value="trc">TRC</option>
                  <option value="val">VAL/VER</option>
                </SelectInput>
              </FormField>
              <FormField label="Client Name"><TextInput placeholder="N/A" /></FormField>
              <FormField label="FG Code"><TextInput placeholder="N/A" /></FormField>
              <FormField label="Product Name" hint="Spans full row in production forms.">
                <TextInput placeholder="N/A" />
              </FormField>
            </div>
          </section>

          <ProjectRoleTabs activeTab={activeTab} onChange={selectTab} />
          <ProjectHierarchyPanel activeTab={activeTab} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Sidebar navigation</h2>
        </div>
        <p className="muted">
          Use the <strong>Multi-tab forms</strong> menu in the sidebar to jump to New project or a specific role tab
          ({PROJECT_TABS.join(', ')}).
        </p>
      </section>
    </div>
  )
}
