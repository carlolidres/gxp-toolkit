import { useMemo, useState } from 'react'
import { Button, DatePicker, Modal, Select, Tooltip } from 'antd'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { Circle, CircleCheck, FileText, Hourglass, Plus, Scale, Tags, Trash2 } from 'lucide-react'

import { ApqrSearchableCombobox } from '../../components/apqr/ApqrSearchableCombobox'
import { CpvEmpty, CpvError, CpvLoading, CpvPage } from '../../components/cpv/CpvComponents'
import { cpvProductWindowHref, openCpvProductWindow } from '../../features/cpv/cpvLinks'
import { useToast } from '../../components/feedback/ToastProvider'
import { listDatabaseRows, listDepartmentSuggestions, saveApqrProductIdentity, saveRecord } from '../../features/apqr/apqrService'
import { forgetDepartment, rememberDepartment } from '../../features/apqr/departmentSuggestions'
import type { ApqrDepartment } from '../../features/apqr/types'
import { uniqueApqrProducts, type ApqrCatalogProduct } from '../../features/cpv/apqrProductCatalog'
import { formatBatchSizeLabel, type CpvBatchSizeUnit } from '../../features/cpv/batchSizes'
import { hasCppEntries } from '../../features/cpv/cppMonitoring'
import { ensureCpvProductFromApqr, listCpvProducts, renameCpvProductIdentity, saveCpvBatchSizes, saveCpvCppMonitoring, saveCpvHoldEntries, saveCpvReportEntries } from '../../features/cpv/cpvService'
import { arrangeReportRows, latestReportEntry } from '../../features/cpv/reportEntries'
import { listProductProfileFacts } from '../../features/cpv/cpvPhaseService'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import {
  CPV_PRODUCT_STATUSES,
  type CpvHoldEntry,
  type CpvProduct,
  type CpvProductStatus,
} from '../../features/cpv/types'
import type { CpvHoldTimeRequirement, CpvTestDefinition, CpvTestResult } from '../../features/cpv/phaseTypes'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { formatAppDate, parseAppDate } from '../../utils/dateUtils'
import { exportRows } from '../../utils/exportUtils'
import './cpv-products-page.css'

type CatalogRow = ApqrCatalogProduct & { cpv: CpvProduct | null }

type ProfileFacts = {
  holdReqs: CpvHoldTimeRequirement[]
  tests: CpvTestDefinition[]
  results: CpvTestResult[]
}

function joinNames(values: string[]): string {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))]
  return unique.length ? unique.join(', ') : '—'
}

function profileColumns(row: CatalogRow, facts: ProfileFacts): Record<string, string> {
  const productId = row.cpv?.id
  const latestReport = latestReportEntry(row.cpv?.report_entries)
  const holds = row.cpv?.hold_entries ?? []
  const critical = productId
    ? facts.tests.filter((item) => item.product_id === productId && (item.criticality === 'CPP' || item.criticality === 'CQA'))
    : []
  const batchSize = formatBatchSizeLabel(row.cpv?.batch_size, row.cpv?.batch_size_unit, row.cpv?.alternate_batch_sizes)
  const cpp = row.cpv?.cpp_monitoring

  return {
    'Product Name': row.product_name,
    'Product Code': row.product_code,
    Client: row.client_name || '—',
    Department: row.department || '—',
    'Batch Size': batchSize,
    'Report Tracer No.': latestReport?.tracer_no || '—',
    'Issued Date': formatAppDate(latestReport?.issued_date) || '—',
    Remarks: latestReport?.remarks.replace(/\s+/g, ' ').trim() || '—',
    'BHT-Report reference no.':
      holds
        .map((entry) =>
          [entry.report_ref, entry.issued_date ? formatAppDate(entry.issued_date) : ''].filter(Boolean).join(' · '),
        )
        .filter(Boolean)
        .join(', ') || '—',
    'Hold-Time': holds.map((entry) => entry.hold_time.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ') || '—',
    CPP: joinNames(critical.filter((item) => item.criticality === 'CPP').map((item) => item.name)),
    CQA: joinNames(critical.filter((item) => item.criticality === 'CQA').map((item) => item.name)),
    'CPP/CQA Monitoring Status (CPP/CQA Report No.)':
      cpp && hasCppEntries(cpp) ? [cpp.vmp_report_no, ...cpp.steps.map((step) => step.step_no)].filter(Boolean).join(', ') : '—',
  }
}

const PROFILE_HEADERS = [
  'Product Name',
  'Product Code',
  'Client',
  'Department',
  'Batch Size',
  'Report Tracer No.',
  'Issued Date',
  'Remarks',
  'BHT-Report reference no.',
  'Hold-Time',
  'CPP',
  'CQA',
  'CPP/CQA Monitoring Status (CPP/CQA Report No.)',
] as const

const APQR_DEPARTMENTS: ApqrDepartment[] = ['Dry', 'Liquids', 'Creams and Ointments', 'Topicals', 'Cosmetics']

type SizeDraft = { size: string; unit: CpvBatchSizeUnit }
type ReportDraft = { id: string; tracer_no: string; issued_date: string; remarks: string }
type CppDraft = { id: string; step_no: string; description: string; cpp: string }

function batchUnit(value: string | null | undefined): CpvBatchSizeUnit {
  return value === 'L' ? 'L' : 'Kg'
}

function departmentChoices(current: string, saved: string[]): string[] {
  const names = new Set<string>(APQR_DEPARTMENTS)
  if (current.trim()) names.add(current.trim())
  saved.forEach((name) => names.add(name))
  const extras = [...names]
    .filter((entry) => !APQR_DEPARTMENTS.includes(entry as ApqrDepartment))
    .sort((a, b) => a.localeCompare(b))
  return [...APQR_DEPARTMENTS.filter((entry) => names.has(entry)), ...extras]
}

const MONITORING_HEADER = 'CPP/CQA Monitoring Status (CPP/CQA Report No.)'

dayjs.extend(customParseFormat)

function AppDateField({
  id,
  value,
  onChange,
  ariaLabel,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
}) {
  const iso = value.trim() ? parseAppDate(value) : null
  return (
    <DatePicker
      id={id}
      aria-label={ariaLabel}
      className="cpv-app-date"
      format="DD MMM YYYY"
      placeholder="dd Mmm YYYY"
      allowClear
      value={iso ? dayjs(iso) : null}
      onChange={(next) => onChange(next ? next.format('DD MMM YYYY') : '')}
    />
  )
}

function EntryStatusMark({
  filled,
  productCode,
  field,
  onClick,
}: {
  filled: boolean
  productCode: string
  field: string
  onClick: () => void
}) {
  const tip = filled ? 'Entries available' : 'No entries'
  return (
    <Tooltip title={tip}>
      <button
        type="button"
        aria-label={`${tip}. Edit ${field} for ${productCode}`}
        onClick={onClick}
        className={
          filled
            ? 'inline-flex size-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:bg-emerald-200'
            : 'inline-flex size-8 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 active:bg-red-100'
        }
      >
        {filled ? (
          <CircleCheck size={18} strokeWidth={2.25} aria-hidden />
        ) : (
          <Circle size={18} strokeWidth={2.25} aria-hidden />
        )}
      </button>
    </Tooltip>
  )
}

function BatchSizeCell({
  value,
  productCode,
  onClick,
}: {
  value: string
  productCode: string
  onClick: () => void
}) {
  const empty = value === '—'
  return (
    <button
      type="button"
      className={
        empty
          ? 'inline-flex max-w-full items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-500 transition hover:border-teal-700 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
          : 'inline-flex max-w-full items-center gap-1.5 rounded-md bg-teal-50 px-2 py-1 text-left text-xs font-semibold text-teal-950 ring-1 ring-teal-200 transition hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
      }
      title={empty ? undefined : value}
      aria-label={empty ? `Add batch size for ${productCode}` : `Edit batch size for ${productCode}, currently ${value}`}
      onClick={onClick}
    >
      {empty ? <Plus size={14} strokeWidth={2.25} aria-hidden /> : <Scale size={14} strokeWidth={2.25} aria-hidden />}
      <span className="truncate">{empty ? 'Add' : value}</span>
    </button>
  )
}

const REPORT_SHEET_HEADERS = new Set<string>(['Report Tracer No.', 'Issued Date'])
const HOLD_SHEET_HEADERS = new Set<string>(['BHT-Report reference no.'])

function ReportEntryCell({
  value,
  productCode,
  field,
  onClick,
}: {
  value: string
  productCode: string
  field: string
  onClick: () => void
}) {
  const empty = value === '—'
  return (
    <button
      type="button"
      className={
        empty
          ? 'inline-flex max-w-full items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-500 transition hover:border-teal-700 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
          : 'inline-flex max-w-full items-center gap-1.5 rounded-md bg-teal-50 px-2 py-1 text-left text-xs font-semibold text-teal-950 ring-1 ring-teal-200 transition hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
      }
      title={empty ? undefined : value}
      aria-label={empty ? `Add ${field} for ${productCode}` : `Edit ${field} for ${productCode}, currently ${value}`}
      onClick={onClick}
    >
      {empty ? <Plus size={14} strokeWidth={2.25} aria-hidden /> : <FileText size={14} strokeWidth={2.25} aria-hidden />}
      <span className="truncate">{empty ? 'Add' : value}</span>
    </button>
  )
}

function LongTextCell({
  value,
  productCode,
  field,
  onClick,
}: {
  value: string
  productCode: string
  field: string
  onClick: () => void
}) {
  const empty = value === '—' || !value.trim()
  return (
    <button
      type="button"
      title={empty ? undefined : value}
      aria-label={empty ? `Add ${field} for ${productCode}` : `Edit ${field} for ${productCode}`}
      onClick={onClick}
      className={
        empty
          ? 'inline-flex max-w-full items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-500 transition hover:border-teal-700 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
          : 'line-clamp-3 max-w-[18rem] whitespace-pre-line text-left text-[13px] leading-5 text-slate-600 transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
      }
    >
      {empty ? <Plus size={14} strokeWidth={2.25} aria-hidden /> : null}
      {empty ? <span className="truncate">Add</span> : value}
    </button>
  )
}

function HoldColumn({
  entries,
  kind,
  productCode,
  onClick,
}: {
  entries: CpvHoldEntry[]
  kind: 'ref' | 'time'
  productCode: string
  onClick: () => void
}) {
  const field = kind === 'ref' ? 'BHT-Report reference no.' : 'Hold-Time'
  const lines = entries
    .map((entry) =>
      kind === 'ref'
        ? [entry.report_ref, entry.issued_date ? formatAppDate(entry.issued_date, '') : ''].filter(Boolean).join(' · ')
        : entry.hold_time.trim(),
    )
    .filter(Boolean)
  if (!lines.length) return <LongTextCell value="—" productCode={productCode} field={field} onClick={onClick} />
  return (
    <button
      type="button"
      title={lines.join('\n\n')}
      aria-label={`Edit ${field} for ${productCode}`}
      onClick={onClick}
      className="flex max-w-[18rem] flex-col gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
    >
      {lines.map((line, index) => (
        <span
          key={index}
          className={
            kind === 'time'
              ? 'line-clamp-3 whitespace-pre-line text-[13px] leading-5 text-slate-600'
              : 'text-sm leading-5 text-slate-800'
          }
        >
          {line}
        </span>
      ))}
    </button>
  )
}

function DepartmentCell({
  value,
  productCode,
  onClick,
}: {
  value: string
  productCode: string
  onClick: () => void
}) {
  const empty = value === '—'
  return (
    <button
      type="button"
      className={
        empty
          ? 'inline-flex max-w-full items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-500 transition hover:border-teal-700 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
          : 'inline-flex max-w-full items-center gap-1.5 rounded-md bg-teal-50 px-2 py-1 text-left text-xs font-semibold text-teal-950 ring-1 ring-teal-200 transition hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
      }
      aria-label={empty ? `Add department for ${productCode}` : `Edit department for ${productCode}, currently ${value}`}
      onClick={onClick}
    >
      {empty ? <Plus size={14} strokeWidth={2.25} aria-hidden /> : <Tags size={14} strokeWidth={2.25} aria-hidden />}
      <span className="truncate">{empty ? 'Add' : value}</span>
    </button>
  )
}

export function CpvProductsPage() {
  const list = useCpvLoad(async () => {
    const [apqrRows, cpvProducts, facts] = await Promise.all([
      listDatabaseRows(),
      listCpvProducts(),
      listProductProfileFacts(),
    ])
    return { apqrRows, cpvProducts, facts }
  })
  const { canExport, canEdit: canEditCpv } = useMenuPermission('cpv-products')
  const { canEdit: canEditApqr } = useMenuPermission('apqr-form')
  const { notify } = useToast()
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | CpvProductStatus>('all')
  const [departmentEdit, setDepartmentEdit] = useState<{ apqrId: string; productCode: string; productName: string } | null>(null)
  const [departmentDraft, setDepartmentDraft] = useState('')
  const [savedDepartments, setSavedDepartments] = useState<string[]>([])
  const [savingDepartment, setSavingDepartment] = useState(false)
  const [batchEdit, setBatchEdit] = useState<CatalogRow | null>(null)
  const [commercialSize, setCommercialSize] = useState('')
  const [commercialUnit, setCommercialUnit] = useState<CpvBatchSizeUnit>('Kg')
  const [alternateSizes, setAlternateSizes] = useState<SizeDraft[]>([])
  const [savingBatch, setSavingBatch] = useState(false)
  const [reportEdit, setReportEdit] = useState<CatalogRow | null>(null)
  const [reportRows, setReportRows] = useState<ReportDraft[]>([])
  const [savingReports, setSavingReports] = useState(false)
  const [holdEdit, setHoldEdit] = useState<CatalogRow | null>(null)
  const [holdRows, setHoldRows] = useState<Array<{ id: string; report_ref: string; issued_date: string; hold_time: string }>>([])
  const [savingHolds, setSavingHolds] = useState(false)
  const [cppEdit, setCppEdit] = useState<CatalogRow | null>(null)
  const [vmpReportNo, setVmpReportNo] = useState('')
  const [vmpIssuedDate, setVmpIssuedDate] = useState('')
  const [cppRows, setCppRows] = useState<CppDraft[]>([])
  const [savingCpp, setSavingCpp] = useState(false)
  const [identityEdit, setIdentityEdit] = useState<CatalogRow | null>(null)
  const [identityName, setIdentityName] = useState('')
  const [identityCode, setIdentityCode] = useState('')
  const [savingIdentity, setSavingIdentity] = useState(false)

  const catalog = useMemo(() => uniqueApqrProducts(list.data?.apqrRows ?? []), [list.data])
  const cpvByCode = useMemo(() => {
    const map = new Map<string, CpvProduct>()
    for (const product of list.data?.cpvProducts ?? []) {
      map.set(product.product_code.toUpperCase(), product)
    }
    return map
  }, [list.data])

  const rows = useMemo<CatalogRow[]>(() => {
    const fromApqr = catalog.map((product) => ({
      ...product,
      cpv: cpvByCode.get(product.product_code) ?? null,
    }))
    const known = new Set(fromApqr.map((row) => row.product_code))
    const orphans = (list.data?.cpvProducts ?? [])
      .filter((product) => !known.has(product.product_code.toUpperCase()))
      .map((product) => ({
        product_code: product.product_code,
        product_name: product.product_name,
        client_name: product.client_owner ?? '',
        department: null,
        apqr_id: '',
        cpv: product,
      }))
    return [...fromApqr, ...orphans]
  }, [catalog, cpvByCode, list.data])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (selectedCode && row.product_code !== selectedCode) return false
      if (statusFilter === 'all') return true
      return (row.cpv?.status ?? 'Draft') === statusFilter
    })
  }, [rows, selectedCode, statusFilter])

  function openBatch(row: CatalogRow) {
    setBatchEdit(row)
    setCommercialSize(row.cpv?.batch_size ?? '')
    setCommercialUnit(batchUnit(row.cpv?.batch_size_unit))
    setAlternateSizes((row.cpv?.alternate_batch_sizes ?? []).map((entry) => ({ size: entry.size, unit: entry.unit })))
  }

  async function saveBatch() {
    if (!batchEdit || !canEditCpv) return
    setSavingBatch(true)
    try {
      const product =
        batchEdit.cpv ??
        (
          await ensureCpvProductFromApqr({
            product_code: batchEdit.product_code,
            product_name: batchEdit.product_name,
            client_name: batchEdit.client_name,
          })
        ).product
      await saveCpvBatchSizes(product.id, commercialSize, commercialUnit, alternateSizes)
      notify('Successfully Saved')
      setBatchEdit(null)
      await list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to Save')
    } finally {
      setSavingBatch(false)
    }
  }

  function openReports(row: CatalogRow) {
    setReportEdit(row)
    setReportRows(
      arrangeReportRows(
        (row.cpv?.report_entries ?? []).map((entry) => ({
          id: crypto.randomUUID(),
          tracer_no: entry.tracer_no,
          issued_date: formatAppDate(entry.issued_date, ''),
          remarks: entry.remarks,
        })),
      ),
    )
  }

  async function saveReports() {
    if (!reportEdit || !canEditCpv) return
    setSavingReports(true)
    try {
      const product =
        reportEdit.cpv ??
        (
          await ensureCpvProductFromApqr({
            product_code: reportEdit.product_code,
            product_name: reportEdit.product_name,
            client_name: reportEdit.client_name,
          })
        ).product
      await saveCpvReportEntries(product.id, reportRows)
      notify('Successfully Saved')
      setReportEdit(null)
      await list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to Save')
    } finally {
      setSavingReports(false)
    }
  }

  function openHolds(row: CatalogRow) {
    setHoldEdit(row)
    setHoldRows(
      (row.cpv?.hold_entries ?? []).map((entry) => ({
        id: crypto.randomUUID(),
        report_ref: entry.report_ref,
        issued_date: entry.issued_date ? formatAppDate(entry.issued_date, '') : '',
        hold_time: entry.hold_time,
      })),
    )
  }

  async function saveHolds() {
    if (!holdEdit || !canEditCpv) return
    setSavingHolds(true)
    try {
      const product =
        holdEdit.cpv ??
        (
          await ensureCpvProductFromApqr({
            product_code: holdEdit.product_code,
            product_name: holdEdit.product_name,
            client_name: holdEdit.client_name,
          })
        ).product
      await saveCpvHoldEntries(product.id, holdRows)
      notify('Successfully Saved')
      setHoldEdit(null)
      await list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to Save')
    } finally {
      setSavingHolds(false)
    }
  }

  function openCpp(row: CatalogRow) {
    const saved = row.cpv?.cpp_monitoring
    setCppEdit(row)
    setVmpReportNo(saved?.vmp_report_no ?? '')
    setVmpIssuedDate(saved?.issued_date ? formatAppDate(saved.issued_date, '') : '')
    setCppRows(
      (saved?.steps ?? []).map((step) => ({
        id: crypto.randomUUID(),
        step_no: step.step_no,
        description: step.description,
        cpp: step.cpp,
      })),
    )
  }

  async function saveCpp() {
    if (!cppEdit || !canEditCpv) return
    setSavingCpp(true)
    try {
      const product =
        cppEdit.cpv ??
        (
          await ensureCpvProductFromApqr({
            product_code: cppEdit.product_code,
            product_name: cppEdit.product_name,
            client_name: cppEdit.client_name,
          })
        ).product
      await saveCpvCppMonitoring(product.id, { vmp_report_no: vmpReportNo, issued_date: vmpIssuedDate, steps: cppRows })
      notify('Successfully Saved')
      setCppEdit(null)
      await list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to Save')
    } finally {
      setSavingCpp(false)
    }
  }

  function openIdentity(row: CatalogRow) {
    setIdentityEdit(row)
    setIdentityName(row.product_name)
    setIdentityCode(row.product_code)
  }

  async function saveIdentity() {
    if (!identityEdit || !canEditApqr) return
    const previousCode = identityEdit.product_code
    const previousName = identityEdit.product_name
    setSavingIdentity(true)
    try {
      await saveApqrProductIdentity(previousCode, { product_name: identityName, product_code: identityCode })
      try {
        renameCpvProductIdentity(previousCode, identityCode, identityName)
      } catch (err) {
        await saveApqrProductIdentity(identityCode, { product_name: previousName, product_code: previousCode })
        throw err
      }
      notify('Successfully Saved')
      setIdentityEdit(null)
      await list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to Save')
    } finally {
      setSavingIdentity(false)
    }
  }

  function openDepartment(row: CatalogRow) {
    if (!row.apqr_id || !canEditApqr) return
    setDepartmentEdit({ apqrId: row.apqr_id, productCode: row.product_code, productName: row.product_name })
    setDepartmentDraft(row.department?.trim() ?? '')
    void listDepartmentSuggestions().then(setSavedDepartments)
  }

  async function saveDepartment() {
    if (!departmentEdit) return
    setSavingDepartment(true)
    try {
      const value = departmentDraft.trim()
      await saveRecord(departmentEdit.apqrId, { department: value || null })
      if (value) rememberDepartment(value)
      notify('Successfully Saved')
      setDepartmentEdit(null)
      await list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to Save')
    } finally {
      setSavingDepartment(false)
    }
  }

  function handleExport() {
    const facts = list.data?.facts ?? { holdReqs: [], tests: [], results: [] }
    exportRows(
      filtered.map((row) => profileColumns(row, facts)),
      `cpv-products-${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  if (list.loading) {
    return (
      <CpvPage sheet title="CPV / Product Profile" description="Products from the APQR Database.">
        <CpvLoading />
      </CpvPage>
    )
  }

  return (
    <CpvPage
      sheet
      title="CPV / Product Profile"
      description="Products from the APQR Database."
    >
      {list.error ? <CpvError message={list.error} /> : null}

      <section className="cpv-products-sheet" aria-labelledby="cpv-products-list-title">
        <div className="cpv-products-heading">
          <div className="cpv-products-heading-title">
            <h2 id="cpv-products-list-title">All Products</h2>
            <span className="cpv-products-count" aria-label={`${filtered.length} products`}>
              {filtered.length}
            </span>
          </div>
          <div className="cpv-products-toolbar">
            <Select
              showSearch
              allowClear
              placeholder="Select product from APQR Database…"
              value={selectedCode}
              onChange={(value) => setSelectedCode(value ?? null)}
              optionFilterProp="label"
              options={catalog.map((product) => ({
                value: product.product_code,
                label: `${product.product_code} · ${product.product_name} · ${product.client_name}`,
              }))}
              aria-label="Select product from APQR Database"
              className="cpv-products-search"
            />
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={[{ value: 'all', label: 'All statuses' }, ...CPV_PRODUCT_STATUSES.map((status) => ({ value: status, label: status }))]}
              aria-label="Filter by status"
              className="cpv-products-status"
            />
            {canExport ? (
              <Button className="button secondary" onClick={handleExport} disabled={filtered.length === 0}>
                Export
              </Button>
            ) : null}
          </div>
        </div>

        <div className="cpv-products-scroll">
          <table className="cpv-products-table">
            <caption className="sr-only">CPV products from APQR Database</caption>
            <thead>
              <tr>
                <th className="cpv-sheet-corner" scope="col" aria-label="Row" />
                {PROFILE_HEADERS.map((header) => (
                  <th key={header} scope="col" className={header === 'Product Name' ? 'cpv-sheet-name' : undefined}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => {
                const cells = profileColumns(row, list.data?.facts ?? { holdReqs: [], tests: [], results: [] })
                return (
                  <tr key={row.product_code}>
                    <th className="cpv-sheet-rowhead" scope="row">
                      {index + 1}
                    </th>
                    {PROFILE_HEADERS.map((header) => (
                      <td key={header} className={header === 'Product Name' ? 'cpv-sheet-name' : undefined}>
                        {header === 'Product Name' ? (
                          <a
                            className="cpv-sheet-name-button"
                            href={cpvProductWindowHref(row.product_code)}
                            title="Open in a new window"
                            onClick={(event) => {
                              event.preventDefault()
                              if (!openCpvProductWindow(row.product_code)) {
                                notify('Allow pop-ups to open the product in a new window.')
                              }
                            }}
                          >
                            {cells[header]}
                          </a>
                        ) : header === 'Product Code' ? (
                          <button type="button" className="cpv-sheet-code-button" onClick={() => openIdentity(row)}>
                            {cells[header]}
                          </button>
                        ) : header === 'Department' && row.apqr_id && canEditApqr ? (
                          <DepartmentCell
                            value={cells[header]}
                            productCode={row.product_code}
                            onClick={() => openDepartment(row)}
                          />
                        ) : header === 'Batch Size' ? (
                          <BatchSizeCell
                            value={cells[header]}
                            productCode={row.product_code}
                            onClick={() => openBatch(row)}
                          />
                        ) : header === 'Remarks' ? (
                          <EntryStatusMark
                            filled={Boolean(latestReportEntry(row.cpv?.report_entries)?.remarks.trim())}
                            productCode={row.product_code}
                            field="Remarks"
                            onClick={() => openReports(row)}
                          />
                        ) : header === 'Hold-Time' ? (
                          <EntryStatusMark
                            filled={(row.cpv?.hold_entries ?? []).some((entry) => entry.hold_time.trim())}
                            productCode={row.product_code}
                            field="Hold-Time"
                            onClick={() => openHolds(row)}
                          />
                        ) : header === MONITORING_HEADER ? (
                          <EntryStatusMark
                            filled={hasCppEntries(row.cpv?.cpp_monitoring)}
                            productCode={row.product_code}
                            field={MONITORING_HEADER}
                            onClick={() => openCpp(row)}
                          />
                        ) : HOLD_SHEET_HEADERS.has(header) ? (
                          <HoldColumn
                            entries={row.cpv?.hold_entries ?? []}
                            kind="ref"
                            productCode={row.product_code}
                            onClick={() => openHolds(row)}
                          />
                        ) : REPORT_SHEET_HEADERS.has(header) ? (
                          <ReportEntryCell
                            value={cells[header]}
                            productCode={row.product_code}
                            field={header}
                            onClick={() => openReports(row)}
                          />
                        ) : (
                          cells[header]
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td className="cpv-products-empty" colSpan={PROFILE_HEADERS.length + 1}>
                    <CpvEmpty
                      title="No APQR products match"
                      hint="Choose a product from the APQR Database list. New products are added in APQR, not here."
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <Modal
        title={
          <span className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
            <Tags size={18} className="text-teal-700" aria-hidden />
            Department
          </span>
        }
        open={departmentEdit != null}
        onCancel={() => setDepartmentEdit(null)}
        onOk={() => void saveDepartment()}
        confirmLoading={savingDepartment}
        okText="Save"
        destroyOnHidden
      >
        <div className="flex flex-col gap-3 pt-1">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900">{departmentEdit?.productCode}</p>
            <p className="text-xs text-slate-500">{departmentEdit?.productName}</p>
          </div>
          <label htmlFor="cpv-department-edit" className="text-sm font-medium text-slate-700">
            Department
          </label>
          <ApqrSearchableCombobox
            id="cpv-department-edit"
            value={departmentDraft}
            options={departmentChoices(departmentDraft, savedDepartments)}
            placeholder="Type or select department…"
            onChange={setDepartmentDraft}
            onCommit={rememberDepartment}
            canRemove={(value) => !APQR_DEPARTMENTS.includes(value as ApqrDepartment)}
            onRemove={(value) => {
              forgetDepartment(value)
              const removed = value.trim().toLowerCase()
              if (departmentDraft.trim().toLowerCase() === removed) setDepartmentDraft('')
              setSavedDepartments((current) => current.filter((name) => name.toLowerCase() !== removed))
              void listDepartmentSuggestions().then(setSavedDepartments)
            }}
          />
          <p className="text-xs leading-5 text-slate-500">
            Saving updates this product on its APQR cycles.
          </p>
        </div>
      </Modal>
      <Modal
        title={
          <span className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
            <Scale size={18} className="text-teal-700" aria-hidden />
            Batch size
          </span>
        }
        open={batchEdit != null}
        onCancel={() => setBatchEdit(null)}
        onOk={() => void saveBatch()}
        confirmLoading={savingBatch}
        okText="Save"
        okButtonProps={{ disabled: !canEditCpv }}
        destroyOnHidden
      >
        <div className="flex flex-col gap-4 pt-1">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900">{batchEdit?.product_code}</p>
            <p className="text-xs text-slate-500">{batchEdit?.product_name}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cpv-commercial-batch-size" className="text-sm font-medium text-slate-700">
              Commercial batch size
            </label>
            <div className="flex gap-2">
              <input
                id="cpv-commercial-batch-size"
                inputMode="decimal"
                value={commercialSize}
                onChange={(event) => setCommercialSize(event.target.value)}
                placeholder="Size"
                className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
              />
              <select
                aria-label="Commercial batch size unit"
                value={commercialUnit}
                onChange={(event) => setCommercialUnit(batchUnit(event.target.value))}
                className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
              >
                <option value="Kg">Kg</option>
                <option value="L">L</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">Alternate batch sizes</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50"
                onClick={() => setAlternateSizes((current) => [...current, { size: '', unit: 'Kg' }])}
              >
                <Plus size={14} aria-hidden />
                Add
              </button>
            </div>
            {alternateSizes.length === 0 ? (
              <p className="text-xs text-slate-500">No alternate sizes.</p>
            ) : (
              alternateSizes.map((entry, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    aria-label={`Alternate batch size ${index + 1}`}
                    inputMode="decimal"
                    value={entry.size}
                    onChange={(event) =>
                      setAlternateSizes((current) =>
                        current.map((row, rowIndex) => (rowIndex === index ? { ...row, size: event.target.value } : row)),
                      )
                    }
                    placeholder="Size"
                    className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
                  />
                  <select
                    aria-label={`Alternate batch size ${index + 1} unit`}
                    value={entry.unit}
                    onChange={(event) =>
                      setAlternateSizes((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, unit: batchUnit(event.target.value) } : row,
                        ),
                      )
                    }
                    className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
                  >
                    <option value="Kg">Kg</option>
                    <option value="L">L</option>
                  </select>
                  <button
                    type="button"
                    aria-label={`Remove alternate batch size ${index + 1}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    onClick={() => setAlternateSizes((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
      <Modal
        title={
          <span className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
            <FileText size={18} className="text-teal-700" aria-hidden />
            Reports
          </span>
        }
        open={reportEdit != null}
        width={720}
        onCancel={() => setReportEdit(null)}
        onOk={() => void saveReports()}
        confirmLoading={savingReports}
        okText="Save"
        okButtonProps={{ disabled: !canEditCpv }}
        destroyOnHidden
      >
        <div className="flex flex-col gap-3 pt-1">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900">{reportEdit?.product_code}</p>
            <p className="text-xs text-slate-500">{reportEdit?.product_name}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">Newest issued date is listed first. The top dated row is shown on the sheet.</p>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50"
              onClick={() =>
                setReportRows((current) =>
                  arrangeReportRows([...current, { id: crypto.randomUUID(), tracer_no: '', issued_date: '', remarks: '' }]),
                )
              }
            >
              <Plus size={14} aria-hidden />
              Add
            </button>
          </div>
          <div className="grid grid-cols-[minmax(0,0.8fr)_11.5rem_minmax(0,1.6fr)_2.25rem] items-start gap-2 text-xs font-medium text-slate-500">
            <span>Report Tracer No.</span>
            <span>Issued Date</span>
            <span>Remarks</span>
            <span />
          </div>
          {reportRows.length === 0 ? (
            <p className="text-xs text-slate-500">No reports yet.</p>
          ) : (
            reportRows.map((entry, index) => (
              <div key={entry.id} className="grid grid-cols-[minmax(0,0.8fr)_11.5rem_minmax(0,1.6fr)_2.25rem] items-start gap-2">
                <input
                  aria-label={`Report Tracer No. ${index + 1}`}
                  value={entry.tracer_no}
                  onChange={(event) =>
                    setReportRows((current) =>
                      current.map((row, rowIndex) => (rowIndex === index ? { ...row, tracer_no: event.target.value } : row)),
                    )
                  }
                  className="h-9 min-w-0 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
                />
                <AppDateField
                  ariaLabel={`Issued Date ${index + 1}`}
                  value={entry.issued_date}
                  onChange={(issued_date) =>
                    setReportRows((current) =>
                      arrangeReportRows(
                        current.map((row, rowIndex) => (rowIndex === index ? { ...row, issued_date } : row)),
                      ),
                    )
                  }
                />
                <textarea
                  aria-label={`Remarks ${index + 1}`}
                  rows={3}
                  value={entry.remarks}
                  onChange={(event) =>
                    setReportRows((current) =>
                      current.map((row, rowIndex) => (rowIndex === index ? { ...row, remarks: event.target.value } : row)),
                    )
                  }
                  className="min-h-24 min-w-0 resize-y rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800 outline-none focus:border-teal-700 focus:bg-white"
                />
                <button
                  type="button"
                  aria-label={`Remove report ${index + 1}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  onClick={() => setReportRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>
      <Modal
        title={
          <span className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
            <Hourglass size={18} className="text-teal-700" aria-hidden />
            Bulk hold time
          </span>
        }
        open={holdEdit != null}
        width={820}
        onCancel={() => setHoldEdit(null)}
        onOk={() => void saveHolds()}
        confirmLoading={savingHolds}
        okText="Save"
        okButtonProps={{ disabled: !canEditCpv }}
        destroyOnHidden
      >
        <div className="flex flex-col gap-3 pt-1">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900">{holdEdit?.product_code}</p>
            <p className="text-xs text-slate-500">{holdEdit?.product_name}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">The reference shows under BHT-Report reference no. The note shows under Hold-Time.</p>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50"
              onClick={() =>
                setHoldRows((current) => [...current, { id: crypto.randomUUID(), report_ref: '', issued_date: '', hold_time: '' }])
              }
            >
              <Plus size={14} aria-hidden />
              Add
            </button>
          </div>
          <div className="grid grid-cols-[11rem_11.5rem_minmax(0,1fr)_2.25rem] gap-2 text-xs font-medium text-slate-500">
            <span>BHT-Report reference no.</span>
            <span>Issued Date</span>
            <span>Hold-Time</span>
            <span />
          </div>
          {holdRows.length === 0 ? (
            <p className="text-xs text-slate-500">No hold-time studies yet.</p>
          ) : (
            holdRows.map((entry, index) => (
              <div key={entry.id} className="grid grid-cols-[11rem_11.5rem_minmax(0,1fr)_2.25rem] items-start gap-2">
                <input
                  aria-label={`BHT-Report reference no. ${index + 1}`}
                  value={entry.report_ref}
                  onChange={(event) =>
                    setHoldRows((current) =>
                      current.map((row, rowIndex) => (rowIndex === index ? { ...row, report_ref: event.target.value } : row)),
                    )
                  }
                  className="h-9 min-w-0 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
                />
                <AppDateField
                  ariaLabel={`BHT issued date ${index + 1}`}
                  value={entry.issued_date}
                  onChange={(issued_date) =>
                    setHoldRows((current) =>
                      current.map((row, rowIndex) => (rowIndex === index ? { ...row, issued_date } : row)),
                    )
                  }
                />
                <textarea
                  aria-label={`Hold-Time ${index + 1}`}
                  rows={4}
                  value={entry.hold_time}
                  placeholder="Hold time"
                  onChange={(event) =>
                    setHoldRows((current) =>
                      current.map((row, rowIndex) => (rowIndex === index ? { ...row, hold_time: event.target.value } : row)),
                    )
                  }
                  className="min-h-24 min-w-0 resize-y rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800 outline-none focus:border-teal-700 focus:bg-white"
                />
                <button
                  type="button"
                  aria-label={`Remove hold-time study ${index + 1}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  onClick={() => setHoldRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>
      <Modal
        title={
          <span className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
            <CircleCheck size={18} className="text-teal-700" aria-hidden />
            CPP monitoring
          </span>
        }
        open={cppEdit != null}
        width={860}
        onCancel={() => setCppEdit(null)}
        onOk={() => void saveCpp()}
        confirmLoading={savingCpp}
        okText="Save"
        okButtonProps={{ disabled: !canEditCpv }}
        destroyOnHidden
      >
        <div className="flex flex-col gap-3 pt-1">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900">{cppEdit?.product_code}</p>
            <p className="text-xs text-slate-500">{cppEdit?.product_name}</p>
          </div>
          <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cpv-vmp-report-no" className="text-sm font-medium text-slate-700">
                VMP Report No.
              </label>
              <input
                id="cpv-vmp-report-no"
                value={vmpReportNo}
                onChange={(event) => setVmpReportNo(event.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cpv-vmp-issued-date" className="text-sm font-medium text-slate-700">
                Issued Date
              </label>
              <AppDateField
                id="cpv-vmp-issued-date"
                ariaLabel="Issued Date"
                value={vmpIssuedDate}
                onChange={setVmpIssuedDate}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">CPPs endorsed for monitoring in the BMR and BPR.</p>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50"
              onClick={() => setCppRows((current) => [...current, { id: crypto.randomUUID(), step_no: '', description: '', cpp: '' }])}
            >
              <Plus size={14} aria-hidden />
              Add
            </button>
          </div>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_2.25rem] gap-2 text-xs font-medium text-slate-500">
            <span>Process Step No.</span>
            <span>Process Description</span>
            <span>CPP</span>
            <span />
          </div>
          {cppRows.length === 0 ? (
            <p className="text-xs text-slate-500">No CPP steps yet.</p>
          ) : (
            cppRows.map((entry, index) => (
              <div key={entry.id} className="grid grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-start gap-2">
                <input
                  aria-label={`Process Step No. ${index + 1}`}
                  value={entry.step_no}
                  placeholder="I.1"
                  onChange={(event) =>
                    setCppRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, step_no: event.target.value } : row)))
                  }
                  className="h-9 min-w-0 rounded-md border border-slate-300 px-2 text-sm text-slate-900"
                />
                <textarea
                  aria-label={`Process Description ${index + 1}`}
                  rows={3}
                  value={entry.description}
                  onChange={(event) =>
                    setCppRows((current) =>
                      current.map((row, rowIndex) => (rowIndex === index ? { ...row, description: event.target.value } : row)),
                    )
                  }
                  className="min-h-20 min-w-0 resize-y rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800 outline-none focus:border-teal-700 focus:bg-white"
                />
                <textarea
                  aria-label={`CPP ${index + 1}`}
                  rows={3}
                  value={entry.cpp}
                  onChange={(event) =>
                    setCppRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, cpp: event.target.value } : row)))
                  }
                  className="min-h-20 min-w-0 resize-y rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800 outline-none focus:border-teal-700 focus:bg-white"
                />
                <button
                  type="button"
                  aria-label={`Remove CPP step ${index + 1}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  onClick={() => setCppRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>
      <Modal
        title="Product details"
        open={identityEdit != null}
        onCancel={() => setIdentityEdit(null)}
        onOk={() => void saveIdentity()}
        confirmLoading={savingIdentity}
        okText="Save"
        okButtonProps={{ disabled: !canEditApqr }}
        destroyOnHidden
      >
        <div className="flex flex-col gap-3 pt-1">
          <label htmlFor="cpv-apqr-product-name" className="text-sm font-medium text-slate-700">
            Product Name
          </label>
          <input
            id="cpv-apqr-product-name"
            value={identityName}
            disabled={!canEditApqr}
            onChange={(event) => setIdentityName(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-teal-700"
          />
          <label htmlFor="cpv-apqr-product-code" className="text-sm font-medium text-slate-700">
            Product Code
          </label>
          <input
            id="cpv-apqr-product-code"
            value={identityCode}
            disabled={!canEditApqr}
            onChange={(event) => setIdentityCode(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold tracking-wide text-slate-500 outline-none focus:border-teal-700"
          />
        </div>
      </Modal>
    </CpvPage>
  )
}
