import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Input, Select } from 'antd'

import { ApqrError, ApqrLoading, ApqrPackageBadge, ApqrPage, ApqrIcon } from '../../components/apqr/ApqrComponents'
import { ApqrContactRoleEditor } from '../../components/apqr/ApqrContactRoleEditor'
import { ApqrSearchableCombobox } from '../../components/apqr/ApqrSearchableCombobox'
import { useToast } from '../../components/feedback/ToastProvider'
import { useColumnResize } from '../../hooks/useColumnResize'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { listAccountManagerSuggestions, saveClient } from '../../features/apqr/apqrService'
import {
  mergeAccountManagerSuggestions,
  rememberAccountManager,
} from '../../features/apqr/accountManagerSuggestions'
import { emptyContact, formatContactsPlainText, parseContacts, serializeContacts } from '../../features/apqr/apqrContacts'
import { useApqrClients } from '../../features/apqr/useApqrData'
import type { ApqrClient, ApqrPackage, ClientStatus } from '../../features/apqr/types'
import { exportRows } from '../../utils/exportUtils'

const emptyForm = {
  code: '',
  account_manager: '',
  client_name: '',
  qaContacts: [emptyContact()],
  technicalContacts: [emptyContact()],
  regulatoryContacts: [emptyContact()],
  apqr_package: 'Billable' as ApqrPackage,
}

type PackageFilter = 'all' | ApqrPackage
type StatusFilter = 'all' | ClientStatus

type ColumnKey = 'code' | 'client_name' | 'account_manager' | 'apqr_package' | 'status'

const COLUMN_LABELS: Record<ColumnKey, string> = {
  code: 'Code',
  client_name: 'Client Name',
  account_manager: 'Account Manager',
  apqr_package: 'APQR Package',
  status: 'Status',
}

const RESIZABLE_COLUMNS: ColumnKey[] = ['code', 'client_name', 'account_manager', 'apqr_package', 'status']
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function ApqrClientRegistryPage() {
  const { data, loading, error, reload } = useApqrClients()
  const { canCreate, canEdit, canExport } = useMenuPermission('apqr-registry')
  const { notify } = useToast()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [packageFilter, setPackageFilter] = useState<PackageFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [accountManagerFilter, setAccountManagerFilter] = useState('all')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [savedAccountManagers, setSavedAccountManagers] = useState<string[]>([])
  const { getColumnStyle, onResizeHandleMouseDown } = useColumnResize<ColumnKey>('apqr-client-column-widths')

  useEffect(() => {
    void listAccountManagerSuggestions().then(setSavedAccountManagers)
  }, [])

  const accountManagers = useMemo(() => {
    const fromClients = (data ?? []).map((client) => client.account_manager).filter(Boolean)
    return mergeAccountManagerSuggestions(fromClients)
  }, [data, savedAccountManagers])

  const accountManagerOptions = useMemo(() => {
    const fromClients = (data ?? []).map((client) => client.account_manager).filter(Boolean)
    const extra = form.account_manager.trim() ? [form.account_manager.trim()] : []
    return mergeAccountManagerSuggestions([...fromClients, ...extra])
  }, [data, form.account_manager, savedAccountManagers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data ?? []).filter((client) => {
      if (packageFilter !== 'all' && client.apqr_package !== packageFilter) return false
      if (statusFilter !== 'all' && client.status !== statusFilter) return false
      if (accountManagerFilter !== 'all' && client.account_manager !== accountManagerFilter) return false
      if (!q) return true
      return (
        client.code.toLowerCase().includes(q) ||
        client.client_name.toLowerCase().includes(q) ||
        client.account_manager.toLowerCase().includes(q) ||
        client.apqr_package.toLowerCase().includes(q)
      )
    })
  }, [data, search, packageFilter, statusFilter, accountManagerFilter])

  const totalRows = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = Math.min(currentPage * pageSize, totalRows)

  const pagedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage, pageSize])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (packageFilter !== 'all') count += 1
    if (statusFilter !== 'all') count += 1
    if (accountManagerFilter !== 'all') count += 1
    return count
  }, [packageFilter, statusFilter, accountManagerFilter])

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code || !data) return
    const client = data.find((c) => c.code === code)
    if (client) loadClient(client)
  }, [searchParams, data])

  useEffect(() => {
    setPage(1)
  }, [search, packageFilter, statusFilter, accountManagerFilter, pageSize])

  function loadClient(client: ApqrClient) {
    setEditingId(client.id)
    setForm({
      code: client.code,
      account_manager: client.account_manager,
      client_name: client.client_name,
      qaContacts: parseContacts(client.qa),
      technicalContacts: parseContacts(client.technical),
      regulatoryContacts: parseContacts(client.regulatory),
      apqr_package: client.apqr_package,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function clearForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSave() {
    if (!canCreate && !canEdit) return
    setBusy(true)
    try {
      await saveClient(
        {
          code: form.code,
          account_manager: form.account_manager,
          client_name: form.client_name,
          qa: serializeContacts(form.qaContacts),
          technical: serializeContacts(form.technicalContacts),
          regulatory: serializeContacts(form.regulatoryContacts),
          apqr_package: form.apqr_package,
        },
        editingId ?? undefined,
      )
      if (form.account_manager.trim()) {
        rememberAccountManager(form.account_manager)
        setSavedAccountManagers(await listAccountManagerSuggestions())
      }
      notify('Successfully Saved')
      clearForm()
      await reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to Save'
      notify(message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <ApqrPage
        icon="users"
        headerClassName="apqr-page-header--registry"
        title="Client Registry"
        description="Enroll and maintain client information."
      >
        <ApqrLoading />
      </ApqrPage>
    )
  }

  return (
    <ApqrPage
      icon="users"
      headerClassName="apqr-page-header--registry"
      title="Client Registry"
      description="Enroll and maintain client information."
    >
      {error ? <ApqrError message={error} /> : null}

      {(canCreate || canEdit) && (
        <section className="panel apqr-registry-form-panel" aria-labelledby="apqr-registry-form-title">
          <header className="apqr-registry-form-header">
            <div className="apqr-registry-form-header-text">
              <h2 id="apqr-registry-form-title">
                <ApqrIcon name="building" />
                Create / Update Client
              </h2>
              <p className="help-text">Enter client details and contact roles, then save to enroll or update.</p>
            </div>
            <span
              className={`apqr-registry-mode-badge${editingId ? ' is-edit' : ''}`}
              role="status"
              aria-live="polite"
            >
              <ApqrIcon name={editingId ? 'edit' : 'plus'} />
              {editingId ? `Editing ${form.code || 'client'}` : 'New client'}
            </span>
          </header>

          <div className="apqr-registry-form-top">
            <RegistryFormField label="Code" htmlFor="apqr-client-code">
              <Input
                id="apqr-client-code"
                value={form.code}
                autoComplete="off"
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </RegistryFormField>
            <RegistryFormField label="Account Manager" htmlFor="apqr-client-am">
              <ApqrSearchableCombobox
                id="apqr-client-am"
                value={form.account_manager}
                options={accountManagerOptions}
                placeholder="Type or select account manager…"
                createLabel={(next) => `Add “${next}”`}
                onChange={(account_manager) => setForm({ ...form, account_manager })}
                onCommit={(value) => {
                  rememberAccountManager(value)
                  setSavedAccountManagers(mergeAccountManagerSuggestions())
                }}
              />
            </RegistryFormField>
            <RegistryFormField label="Client Name" htmlFor="apqr-client-name">
              <Input
                id="apqr-client-name"
                value={form.client_name}
                autoComplete="organization"
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              />
            </RegistryFormField>
            <RegistryFormField label="APQR Package" htmlFor="apqr-client-package">
              <Select
                id="apqr-client-package"
                value={form.apqr_package}
                onChange={(value) => setForm({ ...form, apqr_package: value as ApqrPackage })}
                options={[{ value: 'Billable', label: 'Billable' }, { value: 'Not Billable', label: 'Not Billable' }]}
              />
            </RegistryFormField>
          </div>

          <div className="apqr-registry-form-contacts">
            <h3 className="apqr-registry-contacts-heading">
              <ApqrIcon name="users" />
              Contact roles
            </h3>
            <div className="apqr-registry-form-contacts-grid">
              <ApqrContactRoleEditor
                label="QA"
                idPrefix="apqr-client-qa"
                entries={form.qaContacts}
                onChange={(qaContacts) => setForm({ ...form, qaContacts })}
              />
              <ApqrContactRoleEditor
                label="Technical"
                idPrefix="apqr-client-technical"
                entries={form.technicalContacts}
                onChange={(technicalContacts) => setForm({ ...form, technicalContacts })}
              />
              <ApqrContactRoleEditor
                label="Regulatory"
                idPrefix="apqr-client-regulatory"
                entries={form.regulatoryContacts}
                onChange={(regulatoryContacts) => setForm({ ...form, regulatoryContacts })}
              />
            </div>
          </div>

          <div className="form-actions apqr-registry-actions">
            <Button type="primary" className="button primary" loading={busy} onClick={() => void handleSave()}>
              <ApqrIcon name="save" />
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button className="button secondary" disabled={busy} onClick={clearForm}>
              <ApqrIcon name="clear" />
              Clear
            </Button>
          </div>
        </section>
      )}

      <section className="panel apqr-registry-panel" aria-labelledby="apqr-registry-list-title">
        <div className="panel-heading apqr-registry-heading">
          <div className="apqr-registry-heading-title">
            <h2 id="apqr-registry-list-title">
              <ApqrIcon name="users" />
              Clients
            </h2>
            <span className="apqr-registry-count" aria-label={`${filtered.length} clients`}>
              {filtered.length}
            </span>
          </div>
          <div className="apqr-table-toolbar">
            <label className="apqr-search-field">
              <ApqrIcon name="search" />
              <Input
                type="search"
                value={search}
                placeholder="Search code, name, AM, package…"
                aria-label="Search clients"
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Button
              className={`button secondary${filtersOpen || activeFilterCount > 0 ? ' is-active' : ''}`}
              aria-expanded={filtersOpen}
              aria-controls="apqr-registry-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <ApqrIcon name="filter" />
              Filter
              {activeFilterCount > 0 ? (
                <span className="apqr-filter-count" aria-hidden>
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
            {canExport ? (
              <Button className="button secondary" onClick={() => exportClientCsv(filtered)}>
                <ApqrIcon name="export" />
                Export
              </Button>
            ) : null}
          </div>
        </div>

        {filtersOpen ? (
          <div id="apqr-registry-filters" className="apqr-registry-filters" role="search" aria-label="Client filters">
            <label>
              APQR Package
              <select value={packageFilter} onChange={(e) => setPackageFilter(e.target.value as PackageFilter)}>
                <option value="all">All packages</option>
                <option value="Billable">Billable</option>
                <option value="Not Billable">Not Billable</option>
              </select>
            </label>
            <label>
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Account Manager
              <select value={accountManagerFilter} onChange={(e) => setAccountManagerFilter(e.target.value)}>
                <option value="all">All account managers</option>
                {accountManagers.map((manager) => (
                  <option key={manager} value={manager}>
                    {manager}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button secondary apqr-registry-filters-reset"
              onClick={() => {
                setPackageFilter('all')
                setStatusFilter('all')
                setAccountManagerFilter('all')
              }}
            >
              Reset filters
            </button>
          </div>
        ) : null}

        <div className="table-scroll apqr-client-table-scroll">
          <table className="data-table apqr-client-table compact">
            <thead>
              <tr>
                {RESIZABLE_COLUMNS.map((key) => (
                  <th key={key} scope="col" style={getColumnStyle(key)}>
                    <span className="apqr-th-label">{COLUMN_LABELS[key]}</span>
                    <span
                      className="apqr-col-resize-handle"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${COLUMN_LABELS[key]} column`}
                      onMouseDown={(event) => onResizeHandleMouseDown(key, event)}
                    />
                  </th>
                ))}
                <th scope="col" className="apqr-client-actions-col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedClients.map((client) => (
                <tr key={client.id}>
                  <td style={getColumnStyle('code')}>
                    <Link to={`/apqr/scheduler?client=${encodeURIComponent(client.id)}`}>{client.code}</Link>
                  </td>
                  <td style={getColumnStyle('client_name')}>{client.client_name}</td>
                  <td style={getColumnStyle('account_manager')}>{client.account_manager}</td>
                  <td style={getColumnStyle('apqr_package')}>
                    <ApqrPackageBadge apqrPackage={client.apqr_package} />
                  </td>
                  <td style={getColumnStyle('status')}>
                    <ClientStatusBadge status={client.status} />
                  </td>
                  <td className="apqr-client-actions-col">
                    <div className="apqr-row-actions">
                      {canEdit ? (
                        <button
                          type="button"
                          className="button secondary apqr-edit-btn"
                          aria-label={`Edit ${client.client_name}`}
                          onClick={() => loadClient(client)}
                        >
                          <ApqrIcon name="edit" />
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <div className="apqr-registry-empty" role="status">
              <span className="apqr-registry-empty-icon" aria-hidden>
                <ApqrIcon name="users" width={28} height={28} />
              </span>
              <p className="apqr-registry-empty-title">No matching clients</p>
              <p className="apqr-registry-empty-hint">Try clearing search or filters to see enrolled clients.</p>
            </div>
          ) : null}
        </div>

        {totalRows > 0 ? (
          <div className="apqr-scheduler-pagination apqr-client-pagination">
            <span>
              Showing {pageStart} to {pageEnd} of {totalRows} clients
            </span>
            <label>
              <span className="sr-only">Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
            </label>
            <div className="apqr-pagination-buttons">
              <button type="button" className="button secondary" disabled={currentPage <= 1} onClick={() => setPage(1)}>
                First
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                .map((n, index, list) => {
                  const prev = list[index - 1]
                  const gap = prev != null && n - prev > 1
                  return (
                    <span key={n} className="apqr-pagination-number-wrap">
                      {gap ? <span className="apqr-pagination-ellipsis">…</span> : null}
                      <button
                        type="button"
                        className={`button secondary${n === currentPage ? ' is-active' : ''}`}
                        aria-current={n === currentPage ? 'page' : undefined}
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </button>
                    </span>
                  )
                })}
              <button
                type="button"
                className="button secondary"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                Last
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </ApqrPage>
  )
}

function RegistryFormField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="apqr-form-field">
      <label className="apqr-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const tone = status === 'active' ? 'success' : 'neutral'
  const label = status === 'active' ? 'Active' : 'Archived'
  return (
    <span className={`apqr-client-status tone-${tone}`} role="status">
      {label}
    </span>
  )
}

function exportClientCsv(clients: ApqrClient[]) {
  exportRows(
    clients.map((client) => ({
      Code: client.code,
      'Client Name': client.client_name,
      'Account Manager': client.account_manager,
      'APQR Package': client.apqr_package,
      Status: client.status,
      QA: formatContactsPlainText(client.qa),
      Technical: formatContactsPlainText(client.technical),
      Regulatory: formatContactsPlainText(client.regulatory),
    })),
    `apqr-clients-${new Date().toISOString().slice(0, 10)}.csv`,
  )
}
