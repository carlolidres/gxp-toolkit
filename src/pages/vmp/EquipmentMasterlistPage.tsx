import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  applyEquipmentRecord,
  deleteEquipmentRecord,
  AUXILIARY_SHEET,
  equipmentRecordFromSheet,
  equipmentSheetDepartments,
  clearEquipmentReturn,
  isAuxiliarySheet,
  MASTERLIST_SHEET,
  readEquipmentReturn,
  filterEquipmentMasterlist,
  formatMasterlistDate,
  isEquipmentEntryRow,
  loadEquipmentMasterlist,
  parseMasterlistDate,
  QC_PLANT_2_SECTIONS,
  reviewOneYearAfter,
  saveEquipmentMasterlist,
  sectionHint,
  sectionUsesMovable,
  type EquipmentRecord,
} from '../../features/vmp/equipmentMasterlist'
import { logEquipmentCell, logEquipmentDeletion, logEquipmentRecord, setEquipmentAuditActor } from '../../features/vmp/equipmentAudit'
import { equipmentProfileLabel, findEquipmentRecord } from '../../features/vmp/equipmentReport'
import { syncEquipmentProfiles, writeProfileEquipmentCell } from '../../features/cpv/productProfileWorkbook'
import { activeSheet } from '../../features/vmp/equipmentWorkbook'
import { useAuth } from '../../hooks/useAuth'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { EquipmentSpreadsheet } from './EquipmentSpreadsheet'
import '../../styles/equipment-profile.css'

export function EquipmentMasterlistPage() {
  const { canEdit } = useMenuPermission('vmp-equipment')
  const { user } = useAuth()
  const [workbook, setWorkbook] = useState(loadEquipmentMasterlist)
  const [query, setQuery] = useState('')
  const [saveState, setSaveState] = useState('Saved')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const openedRegister = useRef(false)
  const [record, setRecord] = useState<EquipmentRecord | null>(null)
  const [recordSheet, setRecordSheet] = useState('')
  const timer = useRef<number | null>(null)
  const shown = useMemo(() => filterEquipmentMasterlist(workbook, query), [workbook, query])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  useEffect(() => {
    if (!user) return
    setEquipmentAuditActor({ id: user.profileId ?? user.id, name: user.name })
  }, [user])

  useEffect(() => {
    if (openedRegister.current) return
    const registering = params.get('register') === '1'
    const editing = params.get('edit') === '1'
    if (!registering && !editing) return
    openedRegister.current = true
    const list = isAuxiliarySheet(params.get('list') ?? '') ? AUXILIARY_SHEET : MASTERLIST_SHEET
    setRecordSheet(list)
    if (registering) {
      setRecord(blankEquipmentRecord(list))
      return
    }
    setRecord(findEquipmentRecord(workbook, list, params.get('department') ?? '', params.get('no') ?? ''))
  }, [params, workbook])

  function commit(next: ReturnType<typeof loadEquipmentMasterlist>) {
    setWorkbook(next)
    setSaveState('Saving…')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      try {
        saveEquipmentMasterlist(next)
        setSaveState('Saved')
      } catch {
        setSaveState('Not saved')
        setError('The equipment masterlist could not be saved in this browser.')
      }
    }, 400)
  }

  function openRecord(row: number, column = 1) {
    const sheet = activeSheet(shown)
    if (!isEquipmentEntryRow(sheet, row)) return
    const next = equipmentRecordFromSheet(sheet, row)
    if (column === 0 && next.sourceNo) {
      const params = new URLSearchParams({ sheet: sheet.name, department: next.department, no: next.sourceNo })
      navigate(`/vmp/equipment/report?${params.toString()}`)
      return
    }
    setRecordSheet(sheet.name)
    setRecord(next)
  }

  return (
    <div className="page equipment-profile-page">
      {error ? <p>{error}</p> : null}
      <EquipmentSpreadsheet
        workbook={shown}
        readOnly={!canEdit}
        saveState={saveState}
        hideFormulaBar
        allowNewSheet={false}
        recordSearch={query}
        onRecordSearch={setQuery}
        onError={setError}
        onOpenRecord={openRecord}
        onEquipment={openRecord}
        onChange={(next, audit) => {
          if (query.trim()) {
            if (!audit) setWorkbook((current) => ({ ...current, activeSheetId: next.activeSheetId }))
            return
          }
          if (audit && audit.oldValue !== audit.newValue && audit.newValue !== 'Format painted') {
            logEquipmentCell(audit.range, audit.oldValue, audit.newValue)
          }
          commit(next)
        }}
      />
      {record ? (
        <EquipmentRecordDialog
          record={record}
          sheetName={recordSheet}
          onCancel={() => {
            const ticket = readEquipmentReturn()
            setRecord(null)
            if (!ticket) return
            clearEquipmentReturn()
            navigate(ticket.returnTo)
          }}
          onSave={(next, sheetName) => {
            const ticket = readEquipmentReturn()
            const previousLabel = record.sourceNo ? equipmentProfileLabel(record.equipment, record.ilTag) : ''
            const nextLabel = equipmentProfileLabel(next.equipment, next.ilTag)
            logEquipmentRecord(record.sourceNo ? record : null, next)
            const updated = applyEquipmentRecord(workbook, next, false, sheetName, recordSheet)
            if (ticket || previousLabel) {
              saveEquipmentMasterlist(updated)
              setWorkbook(updated)
              setSaveState('Saved')
              if (previousLabel) syncEquipmentProfiles(previousLabel, nextLabel)
              if (!ticket) {
                setError('')
                setRecord(null)
                return
              }
              writeProfileEquipmentCell(ticket.productCode, ticket.sheetId, ticket.row, ticket.column, nextLabel)
              clearEquipmentReturn()
              setError('')
              setRecord(null)
              navigate(ticket.returnTo)
              return
            }
            commit(updated)
            setError('')
            setRecord(null)
          }}
          onDelete={(reason) => {
            const ticket = readEquipmentReturn()
            logEquipmentDeletion(record, reason)
            const updated = deleteEquipmentRecord(workbook, record, reason, recordSheet)
            if (ticket) {
              saveEquipmentMasterlist(updated)
              setWorkbook(updated)
              writeProfileEquipmentCell(ticket.productCode, ticket.sheetId, ticket.row, ticket.column, '')
              clearEquipmentReturn()
              setError('')
              setRecord(null)
              navigate(ticket.returnTo)
              return
            }
            commit(updated)
            setError('')
            setRecord(null)
          }}
        />
      ) : null}
    </div>
  )
}

function blankEquipmentRecord(list: string): EquipmentRecord {
  return {
    department: equipmentSheetDepartments(list)[0] ?? '',
    equipment: '',
    ilTag: '',
    section: '',
    protocol: '',
    report: '',
    approval: '',
    nextReview: '',
    sourceDepartment: '',
    sourceNo: '',
  }
}

function EquipmentRecordDialog({
  record,
  sheetName,
  onCancel,
  onSave,
  onDelete,
}: {
  record: EquipmentRecord
  sheetName: string
  onCancel: () => void
  onSave: (record: EquipmentRecord, sheetName: string) => void
  onDelete: (reason: string) => void
}) {
  const [draft, setDraft] = useState(record)
  const [list, setList] = useState(isAuxiliarySheet(sheetName) ? AUXILIARY_SHEET : MASTERLIST_SHEET)
  const departments = equipmentSheetDepartments(list)
  const [useEquipmentId, setUseEquipmentId] = useState(false)
  const [equipmentId, setEquipmentId] = useState('')
  const [formError, setFormError] = useState('')
  const [deleteMode, setDeleteMode] = useState(false)
  const [reason, setReason] = useState('')
  const movable = sectionUsesMovable(draft.department)
  const plant2 = draft.department === 'QUALITY CONTROL Plant 2'
  const sectionOptions = plant2 && draft.section && !QC_PLANT_2_SECTIONS.includes(draft.section)
    ? [draft.section, ...QC_PLANT_2_SECTIONS]
    : QC_PLANT_2_SECTIONS
  const editing = Boolean(draft.sourceNo)

  function update(patch: Partial<EquipmentRecord>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function chooseList(next: string) {
    setList(next)
    const allowed = equipmentSheetDepartments(next)
    setDraft((current) => allowed.includes(current.department) ? current : { ...current, department: allowed[0] ?? '', section: '' })
  }

  function submit() {
    const ilTag = useEquipmentId ? equipmentId.trim() : draft.ilTag.trim()
      if (!list) {
      setFormError('Identify whether this equipment is Auxiliary.')
      return
    }
    if (!draft.equipment.trim()) {
      setFormError('Enter the equipment name.')
      return
    }
    if (!ilTag) {
      setFormError('Enter the IL Tag No., or the Equipment ID when no IL tag is assigned yet.')
      return
    }
    try {
      setFormError('')
      onSave({ ...draft, ilTag, section: movable && draft.section === 'Movable' ? 'Movable' : draft.section.trim() }, list)
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'The equipment record could not be saved.')
    }
  }

  function remove() {
    if (!reason.trim()) {
      setFormError('Enter the reason for deletion.')
      return
    }
    try {
      setFormError('')
      onDelete(reason.trim())
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'The equipment record could not be deleted.')
    }
  }

  return (
    <form
      className="eq-profile-dialog"
      role="dialog"
      aria-label={editing ? 'Edit equipment' : 'Register equipment'}
      onSubmit={(event) => {
        event.preventDefault()
        if (deleteMode) remove()
        else submit()
      }}
      onKeyDown={(event) => { if (event.key === 'Escape') onCancel() }}
    >
      <h2>{editing ? 'Edit equipment' : 'Register equipment'}</h2>
      <label>
        Identify
        <select aria-label="Identify" value={list} onChange={(event) => chooseList(event.target.value)}>
          <option value={MASTERLIST_SHEET}>Main Equipment</option>
          <option value={AUXILIARY_SHEET}>Auxiliary</option>
        </select>
      </label>
      <label>
        Department
        <select value={draft.department} onChange={(event) => update({ department: event.target.value })}>
          {departments.map((department) => <option key={department} value={department}>{department}</option>)}
        </select>
      </label>
      <label>
        Equipment name
        <input value={draft.equipment} onChange={(event) => update({ equipment: event.target.value })} />
      </label>
      <label>
        IL Tag No.
        <input value={draft.ilTag} disabled={useEquipmentId} onChange={(event) => update({ ilTag: event.target.value })} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={useEquipmentId}
          onChange={(event) => setUseEquipmentId(event.target.checked)}
        />
        No IL tag yet. Use the Equipment ID.
      </label>
      {useEquipmentId ? (
        <label>
          Equipment ID
          <input value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} />
        </label>
      ) : null}
      <label>
        Section
        {plant2 ? (
          <select value={draft.section} onChange={(event) => update({ section: event.target.value })}>
            <option value="">Select a section</option>
            {sectionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        ) : (
          <input
            value={draft.section === 'Movable' && movable ? '' : draft.section}
            disabled={movable && draft.section === 'Movable'}
            onChange={(event) => update({ section: event.target.value })}
          />
        )}
        <small>{sectionHint(draft.department)}</small>
      </label>
      {movable ? (
        <label>
          <input
            type="checkbox"
            checked={draft.section === 'Movable'}
            onChange={(event) => update({ section: event.target.checked ? 'Movable' : '' })}
          />
          Movable
        </label>
      ) : null}
      <label>
        Protocol Tracer No.
        <input value={draft.protocol} onChange={(event) => update({ protocol: event.target.value })} />
      </label>
      <label>
        Report Tracer No.
        <input value={draft.report} onChange={(event) => update({ report: event.target.value })} />
      </label>
      <DateField
        label="Report Approval Date"
        value={draft.approval}
        onChange={(approval) => update({ approval, nextReview: reviewOneYearAfter(approval) })}
      />
      <DateField
        label="Next Review Date"
        value={draft.nextReview}
        onChange={(nextReview) => update({ nextReview })}
      />
      {editing && deleteMode ? (
        <label>
          Reason for deletion
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
      ) : null}
      {formError ? <p>{formError}</p> : null}
      <div className="eq-profile-dialog-actions">
        {deleteMode ? <button type="submit">Delete</button> : <button type="submit">{editing ? 'Save' : 'Register'}</button>}
        {editing && !deleteMode ? <button type="button" onClick={() => setDeleteMode(true)}>Delete</button> : null}
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const parsed = parseMasterlistDate(value)
  return (
    <label>
      {label}
      <span className="eq-date-field">
        <input
          type="date"
          aria-label={label}
          value={parsed?.iso ?? ''}
          onClick={(event) => event.currentTarget.showPicker?.()}
          onChange={(event) => onChange(event.target.value ? formatMasterlistDate(event.target.value) : '')}
        />
        <span className={value ? undefined : 'is-empty'}>{value || 'dd Mmm YYYY'}</span>
      </span>
    </label>
  )
}
