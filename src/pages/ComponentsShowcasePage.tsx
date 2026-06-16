import { useState } from 'react'

import { DataTable, PaginationControls, StatusBadge, type TableColumn } from '../components/data-display/DataTable'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/FeedbackStates'
import { ConfirmDialog, Modal } from '../components/feedback/Modal'
import { useToast } from '../components/feedback/ToastProvider'
import { DateInput, FormField, SearchInput, SelectInput, Textarea, TextInput } from '../components/forms/FormControls'
import { useScrollToHash } from '../hooks/useScrollToHash'

interface ExampleRow { id: string; name: string; owner: string; status: string }

const rows: ExampleRow[] = [
  { id: '1', name: 'Supplier qualification', owner: 'Maya Chen', status: 'In Progress' },
  { id: '2', name: 'Annual product review', owner: 'Jordan Lee', status: 'Approved' },
  { id: '3', name: 'Cleaning validation', owner: 'Priya Shah', status: 'Pending' },
]

export function ComponentsShowcasePage() {
  const [modal, setModal] = useState<'form' | 'confirm' | null>(null)
  const { notify } = useToast()
  useScrollToHash()

  const columns: TableColumn<ExampleRow>[] = [
    { key: 'name', label: 'Work item' },
    { key: 'owner', label: 'Owner' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} tone={row.status === 'Approved' ? 'success' : 'warning'} /> },
  ]

  return (
    <div className="page components-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Component catalog</span>
          <h1>Composable interface patterns</h1>
          <p>Copy individual components or use this page as a living implementation reference. Use the sidebar Multiform components menu to jump between sections.</p>
        </div>
        <button className="button primary" onClick={() => setModal('form')}>Open modal</button>
      </div>

      <section className="panel page-section" id="forms">
        <div className="panel-heading">
          <h2>Form controls</h2>
        </div>
        <div className="form-grid">
          <FormField label="Search"><SearchInput placeholder="Search records" /></FormField>
          <FormField label="Text input"><TextInput placeholder="Enter a value" /></FormField>
          <FormField label="Select input"><SelectInput><option>Option one</option><option>Option two</option></SelectInput></FormField>
          <FormField label="Date input"><DateInput /></FormField>
          <FormField label="Notes"><Textarea placeholder="Add context" /></FormField>
        </div>
      </section>

      <section className="panel page-section" id="tables">
        <div className="panel-heading">
          <h2>Data tables</h2>
          <div className="button-row">
            <button className="button secondary" onClick={() => notify('CSV export prepared')}>Export CSV</button>
            <button className="button secondary" onClick={() => notify('Spreadsheet export prepared')}>Excel-style export</button>
          </div>
        </div>
        <DataTable rows={rows} columns={columns} />
        <PaginationControls page={1} pageCount={3} onChange={(page) => notify(`Changed to page ${page}`)} />
      </section>

      <section className="panel page-section" id="feedback">
        <div className="panel-heading">
          <h2>Feedback states</h2>
        </div>
        <div className="three-column">
          <LoadingState />
          <EmptyState title="No matching records" description="Change the filters or create a new record." />
          <ErrorState message="The mock service could not return this example." />
        </div>
      </section>

      <section className="panel page-section" id="modals">
        <div className="panel-heading">
          <h2>Modals &amp; dialogs</h2>
        </div>
        <p className="muted">Reusable modal shell, confirm dialog, and toast notifications for destructive or async actions.</p>
        <div className="button-row">
          <button className="button secondary" onClick={() => setModal('form')}>Open form modal</button>
          <button className="button secondary" onClick={() => setModal('confirm')}>Open confirm dialog</button>
          <button className="button secondary" onClick={() => notify('Toast notification example')}>Show toast</button>
        </div>
      </section>

      <Modal
        isOpen={modal === 'form'}
        title="Reusable modal"
        onClose={() => setModal(null)}
        footer={<button className="button primary" onClick={() => { setModal(null); notify('Mock record saved') }}>Save record</button>}
      >
        <div className="form-grid">
          <FormField label="Name"><TextInput defaultValue="New record" /></FormField>
          <FormField label="Owner"><TextInput defaultValue="Avery Morgan" /></FormField>
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={modal === 'confirm'}
        title="Delete this record?"
        message="This demonstrates a destructive confirmation pattern."
        onClose={() => setModal(null)}
        onConfirm={() => { setModal(null); notify('Mock record deleted') }}
      />
    </div>
  )
}
