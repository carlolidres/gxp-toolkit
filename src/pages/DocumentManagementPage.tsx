import { useEffect, useState } from 'react'

import { DataTable, PaginationControls, type TableColumn } from '../components/data-display/DataTable'
import { DateTracker, DocumentMetadataForm, DocumentPreview, DocumentStatusBadge, DocumentUpload, VersionHistory } from '../components/documents/DocumentComponents'
import { LoadingState } from '../components/feedback/FeedbackStates'
import { Modal } from '../components/feedback/Modal'
import { useToast } from '../components/feedback/ToastProvider'
import { SearchInput, SelectInput } from '../components/forms/FormControls'
import { useFilters } from '../hooks/useFilters'
import { usePagination } from '../hooks/usePagination'
import { exportService } from '../services/exportService'
import { mockDocumentService } from '../services/documentService'
import type { DocumentRecord } from '../types/documents'

export function DocumentManagementPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [selected, setSelected] = useState<DocumentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const { notify } = useToast()
  const fields: Array<keyof DocumentRecord> = ['code', 'title', 'category', 'owner', 'status']
  const { query, setQuery, filteredItems } = useFilters(documents, fields)
  const { page, setPage, pageCount, pageItems } = usePagination(filteredItems, 4)

  useEffect(() => {
    let active = true
    mockDocumentService.list().then((items) => {
      if (!active) return
      setDocuments(items)
      setSelected(items[0] ?? null)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const columns: TableColumn<DocumentRecord>[] = [
    { key: 'code', label: 'Document' },
    { key: 'title', label: 'Title', render: (row) => <button className="table-link" onClick={() => setSelected(row)}>{row.title}</button> },
    { key: 'owner', label: 'Owner' },
    { key: 'version', label: 'Version' },
    { key: 'status', label: 'Status', render: (row) => <DocumentStatusBadge status={row.status} /> },
  ]

  function handleExportRegister() {
    exportService.toCsv(filteredItems, 'document-register')
    notify('Document register exported')
  }

  if (loading) {
    return <div className="page"><LoadingState label="Loading documents" /></div>
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Controlled documents</span>
          <h1>Document management</h1>
          <p>Track metadata, lifecycle dates, versions, ownership, access, and audit-ready status.</p>
        </div>
        <button className="button primary" onClick={() => setShowUpload(true)}>Upload document</button>
      </div>
      <div className="kpi-grid compact-kpis">
        {[['Total documents', String(documents.length)], ['Effective', '92'], ['Review due', '11'], ['Archived', '17']].map(([label, value]) => (
          <article className="mini-stat" key={label}><span>{label}</span><strong>{value}</strong></article>
        ))}
      </div>
      <section className="panel">
        <div className="toolbar">
          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents…" />
          <SelectInput aria-label="Category filter">
            <option>All categories</option>
            <option>SOP</option>
            <option>Policy</option>
            <option>Form</option>
          </SelectInput>
          <button className="button secondary" onClick={handleExportRegister}>Export register</button>
        </div>
        <DataTable rows={pageItems} columns={columns} />
        <PaginationControls page={page} pageCount={pageCount} onChange={setPage} />
      </section>
      {selected && (
        <div className="document-detail-grid">
          <section className="panel span-2">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">{selected.code} · Version {selected.version}</span>
                <h2>{selected.title}</h2>
              </div>
              <DocumentStatusBadge status={selected.status} />
            </div>
            <DocumentPreview document={selected} />
          </section>
          <aside className="panel">
            <div className="panel-heading"><h2>Lifecycle</h2></div>
            <DateTracker label="Effective date" value={selected.effectiveDate} />
            <DateTracker label="Review due" value={selected.reviewDate} />
            {selected.expiryDate && <DateTracker label="Expiry date" value={selected.expiryDate} />}
            <div className="controlled-copy">{selected.controlledCopy ? '✓ Controlled copy' : 'Uncontrolled preview'}</div>
            <div className="panel-divider" />
            <h3>Version history</h3>
            <VersionHistory />
          </aside>
        </div>
      )}
      <Modal
        isOpen={showUpload}
        title="Add controlled document"
        onClose={() => setShowUpload(false)}
        footer={<button className="button primary" onClick={() => { setShowUpload(false); notify('Document added to mock register') }}>Create draft</button>}
      >
        <DocumentUpload onUpload={(name) => notify(`${name} selected`)} />
        <div className="panel-divider" />
        <DocumentMetadataForm />
      </Modal>
    </div>
  )
}
