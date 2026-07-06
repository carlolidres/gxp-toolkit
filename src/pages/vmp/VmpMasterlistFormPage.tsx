import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { FormInput, FormSelect, FormTextarea, VmpFormSectionHeader, VmpIcon, VmpModeBanner } from '../../components/vmp/VmpFormFields'
import { VmpQcInstrumentsSection } from '../../components/vmp/VmpQcInstrumentsSection'
import { useToast } from '../../components/feedback/ToastProvider'
import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useVmpApp } from '../../context/VmpAppContext'
import { useVrmsApp } from '../../context/VrmsAppContext'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import type { VmpFieldType } from '../../lib/vmpFieldOptions'
import {
  applyCascadeOnChange,
  findDuplicateOption,
  isDepartmentFieldVisible,
  isQcInstrumentSectionVisible,
  otherSpecifyLabel,
  resolveDepartmentField,
  resolveGroupField,
  resolveRoomLineField,
  validateCascadeFields,
} from '../../lib/vmpFieldOptions'
import {
  createEmptyQcInstrument,
  hasPopulatedInstruments,
  sanitizeInstrumentsForSave,
  validateQcInstruments,
} from '../../lib/vmpQcInstruments'
import {
  createDraftVmpRecord,
  criticalities,
  generateRecordId,
  getControlledSelectValue,
  getOtherOptionValue,
  lifecycleStatuses,
  reviewFrequencies,
  sitePlantOptions,
  validationAreas,
  validationStatuses,
  VMP_OTHER_OPTION,
  type ValidationArea,
  type VmpMasterlistRecord,
} from '../../lib/vmpMasterlist'
import { resolveVmpActorEmail } from '../../services/vmpMasterlistService'

function recordsEqual(a: VmpMasterlistRecord, b: VmpMasterlistRecord): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function VmpMasterlistFormPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const editRecordId = searchParams.get('edit') ?? ''
  const { appData } = useVrmsApp()
  const { records, fieldOptions, saveRecord, isSaving, loading, optionsLoading, error: optionsError, addFieldOption } =
    useVmpApp()
  const { canCreate, canEdit } = useMenuPermission('vmp-masterlist')
  const { notify } = useToast()
  const actor = resolveVmpActorEmail()

  const existing = editRecordId ? records.find((record) => record.recordId === editRecordId) : undefined
  const isEditMode = Boolean(existing)

  const [formRecord, setFormRecord] = useState<VmpMasterlistRecord | null>(null)
  const [baseline, setBaseline] = useState<VmpMasterlistRecord | null>(null)
  const [formMessage, setFormMessage] = useState('')
  const [saveSuccess, setSaveSuccess] = useState<VmpMasterlistRecord | null>(null)
  const [customReviewUnit, setCustomReviewUnit] = useState('years')
  const [customReviewInterval, setCustomReviewInterval] = useState('')
  const [departmentOtherDraft, setDepartmentOtherDraft] = useState('')
  const [groupOtherDraft, setGroupOtherDraft] = useState('')
  const [roomLineOtherDraft, setRoomLineOtherDraft] = useState('')

  const registryDepartments = appData?.registries.Department ?? []
  const validationArea = formRecord?.validationArea
  const isFacilities = validationArea === 'Facilities'
  const isEquipment = validationArea === 'Equipment'

  const cascadeContext = useMemo(
    () => ({
      validationArea: formRecord?.validationArea ?? 'Equipment',
      sitePlant: formRecord?.sitePlant ?? '',
      department: formRecord?.department ?? '',
      group: formRecord?.group ?? '',
    }),
    [formRecord?.department, formRecord?.group, formRecord?.sitePlant, formRecord?.validationArea],
  )

  const departmentField = useMemo(
    () => resolveDepartmentField(cascadeContext, registryDepartments, fieldOptions),
    [cascadeContext, fieldOptions, registryDepartments],
  )
  const groupField = useMemo(() => resolveGroupField(cascadeContext, fieldOptions), [cascadeContext, fieldOptions])
  const roomLineField = useMemo(() => resolveRoomLineField(cascadeContext, fieldOptions), [cascadeContext, fieldOptions])
  const showQcInstruments = useMemo(() => isQcInstrumentSectionVisible(cascadeContext), [cascadeContext])

  const departmentSelectValue = formRecord ? getControlledSelectValue(formRecord.department, departmentField.options) : ''
  const groupSelectValue = formRecord ? getControlledSelectValue(formRecord.group, groupField.options) : ''
  const roomLineSelectValue = formRecord ? getControlledSelectValue(formRecord.roomLine, roomLineField.options) : ''

  const departmentOtherValue = formRecord
    ? departmentOtherDraft || getOtherOptionValue(formRecord.department, departmentField.options)
    : ''
  const groupOtherValue = formRecord ? groupOtherDraft || getOtherOptionValue(formRecord.group, groupField.options) : ''
  const roomLineOtherValue = formRecord
    ? roomLineOtherDraft || getOtherOptionValue(formRecord.roomLine, roomLineField.options)
    : ''

  const isDirty = formRecord && baseline ? !recordsEqual(formRecord, baseline) : false
  const initializedKey = useRef<string | null>(null)

  useEffect(() => {
    if (loading) return
    const key = editRecordId || '__new__'
    if (initializedKey.current === key) return
    initializedKey.current = key

    if (editRecordId) {
      const match = records.find((record) => record.recordId === editRecordId)
      if (match) {
        const loaded = structuredClone(match)
        loaded.qcInstruments = loaded.qcInstruments?.length
          ? loaded.qcInstruments
          : isQcInstrumentSectionVisible({
              validationArea: loaded.validationArea,
              sitePlant: loaded.sitePlant,
              department: loaded.department,
              group: loaded.group,
            })
            ? [createEmptyQcInstrument(actor)]
            : []
        setFormRecord(loaded)
        setBaseline(structuredClone(loaded))
        setSaveSuccess(null)
      }
      return
    }
    const draft = createDraftVmpRecord(records, actor)
    setFormRecord(draft)
    setBaseline(structuredClone(draft))
    setSaveSuccess(null)
  }, [actor, editRecordId, loading, records])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty || saveSuccess) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty, saveSuccess])

  const updateCascadeField = useCallback(
    (key: 'validationArea' | 'sitePlant' | 'department' | 'group' | 'roomLine', value: string) => {
      setFormRecord((current) => {
        if (!current) return current

        const nextContext = applyCascadeOnChange(
          {
            validationArea: current.validationArea,
            sitePlant: current.sitePlant,
            department: current.department,
            group: current.group,
            roomLine: current.roomLine,
          },
          key,
          key === 'validationArea' ? (value as ValidationArea) : value,
          registryDepartments,
          fieldOptions,
        )

        const next: VmpMasterlistRecord = {
          ...current,
          validationArea: nextContext.validationArea,
          sitePlant: nextContext.sitePlant,
          department: nextContext.department,
          group: nextContext.group,
          roomLine: nextContext.roomLine,
        }

        const instrumentsVisible = isQcInstrumentSectionVisible({
          validationArea: next.validationArea,
          sitePlant: next.sitePlant,
          department: next.department,
          group: next.group,
        })
        if (!instrumentsVisible) {
          next.qcInstruments = []
        } else if (!next.qcInstruments?.length) {
          next.qcInstruments = [createEmptyQcInstrument(actor)]
        }

        if (key === 'validationArea' && !isEditMode) {
          next.recordId = generateRecordId(
            value as ValidationArea,
            records.map((record) => record.recordId),
          )
        }

        return next
      })
      setFormMessage('')
    },
    [actor, fieldOptions, isEditMode, records, registryDepartments],
  )

  const confirmInstrumentClear = useCallback(
    (nextDepartment: string, nextValidationArea?: ValidationArea) => {
      if (!formRecord) return true
      const currentVisible = isQcInstrumentSectionVisible(cascadeContext)
      const nextVisible = isQcInstrumentSectionVisible({
        validationArea: nextValidationArea ?? formRecord.validationArea,
        sitePlant: formRecord.sitePlant,
        department: nextDepartment,
        group: formRecord.group,
      })
      if (!currentVisible || nextVisible) return true
      if (!hasPopulatedInstruments(formRecord.qcInstruments ?? [])) return true
      return window.confirm(
        'Changing Department / Facility will remove Associated QC Instruments. Continue?',
      )
    },
    [cascadeContext, formRecord],
  )

  const handleDepartmentChange = useCallback(
    (value: string) => {
      if (!confirmInstrumentClear(value)) return
      updateCascadeField('department', value)
    },
    [confirmInstrumentClear, updateCascadeField],
  )

  const handleValidationAreaChange = useCallback(
    (value: string) => {
      if (!confirmInstrumentClear(formRecord?.department ?? '', value as ValidationArea)) return
      updateCascadeField('validationArea', value)
    },
    [confirmInstrumentClear, formRecord?.department, updateCascadeField],
  )

  async function ensureCustomOption(
    fieldType: VmpFieldType,
    selectValue: string,
    otherText: string,
    options: readonly string[],
  ): Promise<string> {
    if (selectValue !== VMP_OTHER_OPTION) return selectValue
    const trimmed = otherText.trim()
    if (!trimmed) {
      throw new Error('Specify Other is required when Others is selected.')
    }
    const duplicate = findDuplicateOption(trimmed, options)
    if (duplicate) return duplicate
    await addFieldOption({
      fieldType,
      context: cascadeContext,
      displayValue: trimmed,
      actor,
    })
    return trimmed
  }

  function validateRecord(record: VmpMasterlistRecord): string | null {
    if (!record.itemName.trim()) {
      return 'Item / System / Area Name is required before saving.'
    }
    if (!record.recordId.trim()) {
      return 'Record ID could not be generated. Select a Validation Area and try again.'
    }

    const cascadeError = validateCascadeFields(
      {
        validationArea: record.validationArea,
        sitePlant: record.sitePlant,
        department: isDepartmentFieldVisible({
          validationArea: record.validationArea,
          sitePlant: record.sitePlant,
          department: record.department,
          group: record.group,
        })
          ? record.department
          : '',
        group: record.group,
        roomLine: record.roomLine,
      },
      registryDepartments,
      fieldOptions,
    )
    if (cascadeError) return cascadeError

    if (isQcInstrumentSectionVisible({
      validationArea: record.validationArea,
      sitePlant: record.sitePlant,
      department: record.department,
      group: record.group,
    })) {
      const instrumentError = validateQcInstruments(record.qcInstruments ?? [])
      if (instrumentError) return instrumentError
    }

    const duplicate = records.some((row) => row.recordId === record.recordId && row.id !== record.id)
    if (duplicate) return 'Record ID must be unique across the masterlist.'
    return null
  }

  async function handleSave(mode: 'draft' | 'saved') {
    if (!formRecord) return
    if (isEditMode && !canEdit) {
      setFormMessage('You do not have permission to edit masterlist records.')
      return
    }
    if (!isEditMode && !canCreate) {
      setFormMessage('You do not have permission to create masterlist records.')
      return
    }

    try {
      const resolvedDepartment = departmentField.visible
        ? await ensureCustomOption(
            'department',
            departmentSelectValue,
            departmentOtherValue,
            departmentField.options,
          )
        : ''
      const resolvedGroup =
        !groupField.visible
          ? ''
          : groupField.useDropdown
            ? await ensureCustomOption('group', groupSelectValue, groupOtherValue, groupField.options)
            : formRecord.group
      const resolvedRoomLine = roomLineField.useDropdown
        ? await ensureCustomOption('room_line', roomLineSelectValue, roomLineOtherValue, roomLineField.options)
        : formRecord.roomLine

      const instrumentsVisible = isQcInstrumentSectionVisible({
        validationArea: formRecord.validationArea,
        sitePlant: formRecord.sitePlant,
        department: resolvedDepartment,
        group: resolvedGroup,
      })
      const qcInstruments = instrumentsVisible
        ? sanitizeInstrumentsForSave(formRecord.qcInstruments ?? [], actor)
        : []

      const payload: VmpMasterlistRecord = {
        ...formRecord,
        department: resolvedDepartment,
        group: resolvedGroup,
        roomLine: resolvedRoomLine,
        qcInstruments,
        reviewFrequency:
          formRecord.reviewFrequency === 'Custom' && customReviewInterval
            ? `Every ${customReviewInterval} ${customReviewUnit}`
            : formRecord.reviewFrequency,
      }

      const validationError = validateRecord(payload)
      if (validationError) {
        setFormMessage(validationError)
        return
      }

      const saved = await saveRecord({
        record: payload,
        mode,
        expectedVersion: isEditMode ? baseline?.version : undefined,
        previousInstruments: baseline?.qcInstruments ?? [],
      })
      setDepartmentOtherDraft('')
      setGroupOtherDraft('')
      setRoomLineOtherDraft('')
      setSaveSuccess(saved)
      setBaseline(structuredClone(saved))
      setFormRecord(structuredClone(saved))
      notify(mode === 'draft' ? 'Draft saved successfully.' : 'Record saved successfully.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save record.'
      setFormMessage(message)
      notify(message)
    }
  }

  function handleClear() {
    if (!window.confirm('Clear all form fields?')) return
    const draft = createDraftVmpRecord(records, actor)
    setFormRecord(draft)
    setBaseline(structuredClone(draft))
    setDepartmentOtherDraft('')
    setGroupOtherDraft('')
    setRoomLineOtherDraft('')
    setFormMessage('')
    setSaveSuccess(null)
    setSearchParams({})
  }

  function handleCancel() {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return
    navigate('/vmp/database')
  }

  function handleAddAnother() {
    initializedKey.current = null
    const draft = createDraftVmpRecord(records, actor)
    setFormRecord(draft)
    setBaseline(structuredClone(draft))
    setDepartmentOtherDraft('')
    setGroupOtherDraft('')
    setRoomLineOtherDraft('')
    setSaveSuccess(null)
    setFormMessage('')
    setSearchParams({})
    initializedKey.current = '__new__'
  }

  if (loading || !formRecord) {
    return (
      <VrmsPage eyebrow="Validation Master Plan" title="VMP / Masterlist Form" description="Create or update validation masterlist records.">
        <p className="vrms-muted">{editRecordId && !existing ? 'Record not found.' : 'Loading form…'}</p>
      </VrmsPage>
    )
  }

  return (
    <VrmsPage
      eyebrow="Validation Master Plan"
      title="VMP / Masterlist Form"
      description="Create or update validation masterlist records."
    >
      {isEditMode ? (
        <VmpModeBanner>
          Editing record <strong>{formRecord.recordId}</strong>
          {formRecord.isDraft ? ' · Draft' : ''}
        </VmpModeBanner>
      ) : formRecord.isDraft ? (
        <VmpModeBanner>New record · Draft mode</VmpModeBanner>
      ) : null}

      {optionsLoading ? <p className="vmp-options-loading">Loading field options…</p> : null}
      {optionsError ? (
        <p className="vmp-form-error" role="alert">
          {optionsError}
        </p>
      ) : null}

      {saveSuccess ? (
        <section className="vrms-panel vmp-success-panel" aria-live="polite">
          <strong>Record saved successfully.</strong>
          <p>
            {saveSuccess.recordId} — {saveSuccess.itemName}
          </p>
          <div className="vmp-form-actions-inline">
            <Link className="vrms-btn-primary" to={`/vmp/database?recordId=${encodeURIComponent(saveSuccess.recordId)}`}>
              View in Database
            </Link>
            <button type="button" className="vrms-btn-secondary" onClick={handleAddAnother}>
              Add Another Record
            </button>
          </div>
        </section>
      ) : null}

      <form
        className="vmp-form-page"
        aria-label="Masterlist Form"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSave('saved')
        }}
      >
        <section className="vrms-panel vmp-form-section">
          <VmpFormSectionHeader
            title="Record Classification and Identification"
            description="Select the validation area and related classification fields, then identify the applicable item, system, area, asset, responsible owner, and criticality for this record."
            icon="clipboard-list"
          />
          <div className="vmp-form-grid">
            <FormSelect
              label="Validation Area"
              required
              value={formRecord.validationArea}
              options={validationAreas}
              onChange={(value) => handleValidationAreaChange(value)}
            />
            <FormSelect
              label="Site / Plant"
              required
              value={formRecord.sitePlant}
              options={sitePlantOptions}
              onChange={(value) => updateCascadeField('sitePlant', value)}
            />

            {isFacilities ? (
              <>
                <FormSelect
                  label={groupField.label}
                  required
                  value={groupSelectValue}
                  options={groupField.options}
                  searchable={groupField.searchable}
                  loading={optionsLoading}
                  onChange={(value) => updateCascadeField('group', value)}
                />
                {groupSelectValue === VMP_OTHER_OPTION ? (
                  <FormInput
                    label={otherSpecifyLabel(groupField.label)}
                    required
                    value={groupOtherValue}
                    onChange={(value) => {
                      setGroupOtherDraft(value)
                      updateCascadeField('group', value || VMP_OTHER_OPTION)
                    }}
                  />
                ) : null}
                {departmentField.visible ? (
                  <>
                    <FormSelect
                      label={departmentField.label}
                      required
                      value={departmentSelectValue}
                      options={departmentField.options}
                      searchable={departmentField.searchable}
                      loading={optionsLoading}
                      onChange={(value) => updateCascadeField('department', value)}
                    />
                    {departmentSelectValue === VMP_OTHER_OPTION ? (
                      <FormInput
                        label={otherSpecifyLabel(departmentField.label)}
                        required
                        value={departmentOtherValue}
                        onChange={(value) => {
                          setDepartmentOtherDraft(value)
                          updateCascadeField('department', value || VMP_OTHER_OPTION)
                        }}
                      />
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}

            {isEquipment ? (
              <>
                <FormSelect
                  label={departmentField.label}
                  required
                  value={departmentSelectValue}
                  options={departmentField.options}
                  searchable={departmentField.searchable}
                  loading={optionsLoading}
                  onChange={(value) => updateCascadeField('department', value)}
                />
                {departmentSelectValue === VMP_OTHER_OPTION ? (
                  <FormInput
                    label={otherSpecifyLabel(departmentField.label)}
                    required
                    value={departmentOtherValue}
                    onChange={(value) => {
                      setDepartmentOtherDraft(value)
                      updateCascadeField('department', value || VMP_OTHER_OPTION)
                    }}
                  />
                ) : null}
                {groupField.useDropdown ? (
                  <>
                    <FormSelect
                      label={groupField.label}
                      required={groupField.options.length > 0}
                      value={groupSelectValue}
                      options={groupField.options}
                      searchable={groupField.searchable}
                      loading={optionsLoading}
                      onChange={(value) => updateCascadeField('group', value)}
                    />
                    {groupSelectValue === VMP_OTHER_OPTION ? (
                      <FormInput
                        label={otherSpecifyLabel(groupField.label)}
                        required
                        value={groupOtherValue}
                        onChange={(value) => {
                          setGroupOtherDraft(value)
                          updateCascadeField('group', value || VMP_OTHER_OPTION)
                        }}
                      />
                    ) : null}
                  </>
                ) : null}
                <FormInput
                  label="IL-tag No."
                  value={formRecord.assetTagNo}
                  onChange={(value) => setFormRecord((current) => current && { ...current, assetTagNo: value })}
                />
                {roomLineField.useDropdown ? (
                  <>
                    <FormSelect
                      label={roomLineField.label}
                      required
                      value={roomLineSelectValue}
                      options={roomLineField.options}
                      searchable={roomLineField.searchable}
                      loading={optionsLoading}
                      onChange={(value) => updateCascadeField('roomLine', value)}
                    />
                    {roomLineSelectValue === VMP_OTHER_OPTION ? (
                      <FormInput
                        label={otherSpecifyLabel(roomLineField.label)}
                        required
                        value={roomLineOtherValue}
                        onChange={(value) => {
                          setRoomLineOtherDraft(value)
                          updateCascadeField('roomLine', value || VMP_OTHER_OPTION)
                        }}
                      />
                    ) : null}
                  </>
                ) : (
                  <FormInput
                    label={roomLineField.label}
                    value={formRecord.roomLine}
                    onChange={(value) => setFormRecord((current) => current && { ...current, roomLine: value })}
                  />
                )}
              </>
            ) : null}

            {!isFacilities && !isEquipment ? (
              <>
                {departmentField.visible ? (
                  <>
                    <FormSelect
                      label={departmentField.label}
                      required
                      value={departmentSelectValue}
                      options={departmentField.options}
                      searchable={departmentField.searchable}
                      loading={optionsLoading}
                      onChange={(value) => handleDepartmentChange(value)}
                    />
                    {departmentSelectValue === VMP_OTHER_OPTION ? (
                      <FormInput
                        label={otherSpecifyLabel(departmentField.label)}
                        required
                        value={departmentOtherValue}
                        onChange={(value) => {
                          setDepartmentOtherDraft(value)
                          updateCascadeField('department', value || VMP_OTHER_OPTION)
                        }}
                      />
                    ) : null}
                  </>
                ) : null}
                {showQcInstruments ? (
                  <VmpQcInstrumentsSection
                    instruments={formRecord.qcInstruments ?? [createEmptyQcInstrument(actor)]}
                    actor={actor}
                    onChange={(next) =>
                      setFormRecord((current) => current && { ...current, qcInstruments: next })
                    }
                  />
                ) : null}
                {groupField.visible && groupField.useDropdown ? (
                  <>
                    <FormSelect
                      label={groupField.label}
                      value={groupSelectValue}
                      options={groupField.options}
                      searchable={groupField.searchable}
                      loading={optionsLoading}
                      onChange={(value) => updateCascadeField('group', value)}
                    />
                    {groupSelectValue === VMP_OTHER_OPTION ? (
                      <FormInput
                        label={otherSpecifyLabel(groupField.label)}
                        required
                        value={groupOtherValue}
                        onChange={(value) => {
                          setGroupOtherDraft(value)
                          updateCascadeField('group', value || VMP_OTHER_OPTION)
                        }}
                      />
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}

            <FormInput
              label="Item / System / Area Name"
              required
              value={formRecord.itemName}
              onChange={(value) => setFormRecord((current) => current && { ...current, itemName: value })}
            />
            {!isEquipment ? (
              <FormInput
                label="Asset / Tag No."
                value={formRecord.assetTagNo}
                onChange={(value) => setFormRecord((current) => current && { ...current, assetTagNo: value })}
                helper="Optional for facilities or records without a formal tag."
              />
            ) : null}
            <FormInput
              label="Responsible Owner"
              value={formRecord.responsibleOwner}
              onChange={(value) => setFormRecord((current) => current && { ...current, responsibleOwner: value })}
            />
            <FormSelect
              label="Criticality"
              required
              value={formRecord.criticality}
              options={criticalities}
              onChange={(value) =>
                setFormRecord((current) => current && { ...current, criticality: value as VmpMasterlistRecord['criticality'] })
              }
            />
          </div>
        </section>

        <section className="vrms-panel vmp-form-section">
          <VmpFormSectionHeader
            title="Document References"
            description="Linked protocol and report tracer numbers."
            icon="link"
          />
          <div className="vmp-form-grid">
            <FormInput
              label="Protocol Tracer"
              value={formRecord.protocolTracer}
              onChange={(value) => setFormRecord((current) => current && { ...current, protocolTracer: value })}
              placeholder="VMP-EQ-02-000-041P-4"
            />
            <FormInput
              label="Report Tracer"
              value={formRecord.reportTracer}
              onChange={(value) => setFormRecord((current) => current && { ...current, reportTracer: value })}
              placeholder="VMP-EQ-02-000-041R-3"
            />
            <FormInput
              label="Report Approval Date"
              type="date"
              value={formRecord.reportApprovalDate}
              onChange={(value) => setFormRecord((current) => current && { ...current, reportApprovalDate: value })}
            />
          </div>
        </section>

        <section className="vrms-panel vmp-form-section">
          <VmpFormSectionHeader
            title="Schedule and Status"
            description="Review cycle, validation state, and lifecycle tracking."
            icon="calendar"
          />
          <div className="vmp-form-grid">
            <FormSelect
              label="Review / Revalidation Frequency"
              value={formRecord.reviewFrequency}
              options={reviewFrequencies}
              onChange={(value) => setFormRecord((current) => current && { ...current, reviewFrequency: value })}
            />
            {formRecord.reviewFrequency === 'Custom' ? (
              <>
                <FormInput
                  label="Custom interval"
                  value={customReviewInterval}
                  onChange={setCustomReviewInterval}
                  placeholder="3"
                />
                <FormSelect
                  label="Custom unit"
                  value={customReviewUnit}
                  options={['years', 'months']}
                  onChange={setCustomReviewUnit}
                />
              </>
            ) : null}
            <FormInput
              label="Next Due Date"
              type="date"
              value={formRecord.nextDueDate}
              onChange={(value) => setFormRecord((current) => current && { ...current, nextDueDate: value })}
            />
            <FormSelect
              label="Validation Status"
              required
              value={formRecord.validationStatus}
              options={validationStatuses}
              onChange={(value) =>
                setFormRecord((current) => current && { ...current, validationStatus: value as VmpMasterlistRecord['validationStatus'] })
              }
            />
            <FormSelect
              label="Lifecycle Status"
              required
              value={formRecord.lifecycleStatus}
              options={lifecycleStatuses}
              onChange={(value) =>
                setFormRecord((current) => current && { ...current, lifecycleStatus: value as VmpMasterlistRecord['lifecycleStatus'] })
              }
            />
            <FormTextarea
              label="Remarks"
              wide
              value={formRecord.remarks}
              onChange={(value) => setFormRecord((current) => current && { ...current, remarks: value })}
            />
          </div>
        </section>

        {formMessage ? (
          <p className="vmp-form-error" role="alert">
            {formMessage}
          </p>
        ) : null}

        <div className="vmp-form-sticky-actions">
          {isEditMode ? (
            <>
              <button type="submit" className="vrms-btn-primary vmp-btn-with-icon" disabled={isSaving || optionsLoading}>
                <VmpIcon name="save" />
                {isSaving ? 'Saving…' : 'Update Record'}
              </button>
              <button type="button" className="vrms-btn-secondary vmp-btn-with-icon" onClick={handleCancel}>
                <VmpIcon name="cancel" />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="submit" className="vrms-btn-primary vmp-btn-with-icon" disabled={isSaving || !canCreate || optionsLoading}>
                <VmpIcon name="save" />
                {isSaving ? 'Saving…' : 'Save Record'}
              </button>
              <button
                type="button"
                className="vrms-btn-secondary vmp-btn-with-icon"
                disabled={isSaving || !canCreate || optionsLoading}
                onClick={() => void handleSave('draft')}
              >
                <VmpIcon name="draft" />
                Save as Draft
              </button>
              <button type="button" className="vrms-btn-secondary vmp-btn-with-icon" onClick={handleClear}>
                <VmpIcon name="clear" />
                Clear Form
              </button>
              <button type="button" className="vrms-btn-secondary vmp-btn-with-icon" onClick={handleCancel}>
                <VmpIcon name="cancel" />
                Cancel
              </button>
            </>
          )}
        </div>
      </form>
    </VrmsPage>
  )
}
