import { useState } from 'react'

import { FormField, TextInput } from '../forms/FormControls'
import { TAB_SAMPLE_FIELDS, type ProjectTab, projectTabKey } from '../../lib/projectFormFields'

interface HierarchyNode {
  id: string
  label: string
  fields: Array<{ key: string; label: string }>
  children?: HierarchyNode[]
}

const AM_HIERARCHY: HierarchyNode[] = [
  {
    id: 'batch-1',
    label: 'Batch 1: Batch 1',
    fields: [{ key: 'unique_batch', label: 'Unique Batch' }],
    children: [
      {
        id: 'mo-1',
        label: 'MO 1: MO 1',
        fields: [{ key: 'mo_control_no', label: 'MO Control No.' }],
      },
    ],
  },
]

function HierarchySection({
  node,
  depth = 0,
  addLabel,
}: {
  node: HierarchyNode
  depth?: number
  addLabel?: string
}) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className={`hierarchy-panel depth-${depth}`}>
      <div className="hierarchy-header">
        <button type="button" className="hierarchy-toggle" onClick={() => setIsOpen((value) => !value)} aria-expanded={isOpen}>
          <span className="hierarchy-chevron" />
          <span className="hierarchy-title">{node.label}</span>
        </button>
        {addLabel && (
          <button type="button" className="button secondary hierarchy-add-btn">
            + {addLabel}
          </button>
        )}
      </div>
      {isOpen && (
        <div className="hierarchy-body">
          <div className="project-form-grid">
            {node.fields.map((field) => (
              <FormField key={field.key} label={field.label}>
                <TextInput placeholder="N/A" />
              </FormField>
            ))}
          </div>
          {node.children?.map((child) => (
            <HierarchySection
              key={child.id}
              node={child}
              depth={depth + 1}
              addLabel={depth === 0 ? 'PO' : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ProjectHierarchyPanel({ activeTab }: { activeTab: ProjectTab }) {
  const layerKey = projectTabKey(activeTab)
  const fields = TAB_SAMPLE_FIELDS[activeTab]

  if (activeTab === 'AM/BM/PL') {
    return (
      <div className={`project-tab-layer project-tab-layer-${layerKey}`}>
        {AM_HIERARCHY.map((node) => (
          <HierarchySection key={node.id} node={node} addLabel="MO" />
        ))}
      </div>
    )
  }

  return (
    <div className={`project-tab-layer project-tab-layer-${layerKey}`}>
      <div className="hierarchy-panel depth-0">
        <div className="hierarchy-header">
          <span className="hierarchy-title">{activeTab} fields</span>
        </div>
        <div className="hierarchy-body">
          <div className="project-form-grid">
            {fields.map((field) => (
              <FormField key={field.key} label={field.label}>
                <TextInput placeholder="N/A" />
              </FormField>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
