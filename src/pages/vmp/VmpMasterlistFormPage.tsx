import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Eraser, FilePen, Loader2, Save, X } from 'lucide-react'

import { FormInput, FormSelect, FormTextarea, VmpFormSectionHeader, VmpModeBanner } from '../../components/vmp/VmpFormFields'
import { FormEditableCombobox } from '../../components/vmp/VmpEditableCombobox'
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
import {
  type GroupSuggestionScope,
  mergeGroupSubcategorySuggestions,
  readGroupSubcategorySuggestions,
  rememberGroupSubcategory,
  forgetGroupSubcategory,
} from '../../lib/vmpGroupSubcategorySuggestions'
import {
  readResponsibleOwnerSuggestions,
  rememberResponsibleOwner,
  forgetResponsibleOwner,
} from '../../lib/vmpResponsibleOwnerSuggestions'
import { VMP_FORM_GRID_CLASS, VMP_SECTION_CARD_CLASS } from './vmp-form-shared'
import './vmp-form-page.css'

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
  const [roomLineOtherDraft, setRoomLineOtherDraft] = useState('')
  const [responsibleOwnerOptions, setResponsibleOwnerOptions] = useState<string[]>(() =>
    readResponsibleOwnerSuggestions(),
  )
  const [groupSubcategoryOptions, setGroupSubcategoryOptions] = useState<string[]>([])

  const savedResponsibleOwners = useMemo(() => new Set(readResponsibleOwnerSuggestions()), [responsibleOwnerOptions])

  const refreshResponsibleOwnerOptions = useCallback(() => {
    setResponsibleOwnerOptions(readResponsibleOwnerSuggestions())
  }, [])

  useEffect(() => {
    refreshResponsibleOwnerOptions()
  }, [refreshResponsibleOwnerOptions])

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

  const groupSuggestionScope = useMemo<GroupSuggestionScope>(
    () => ({
      validationArea: formRecord?.validationArea ?? 'Equipment',
      department: formRecord?.department,
    }),
    [formRecord?.department, formRecord?.validationArea],
  )

  const savedGroupSubcategories = useMemo(
    () => new Set(readGroupSubcategorySuggestions(groupSuggestionScope)),
    [groupSubcategoryOptions, groupSuggestionScope],
  )

  const refreshGroupSubcategoryOptions = useCallback(() => {
    setGroupSubcategoryOptions(mergeGroupSubcategorySuggestions(groupSuggestionScope, groupField.options))
  }, [groupField.options, groupSuggestionScope])

  useEffect(() => {
    refreshGroupSubcategoryOptions()
  }, [refreshGroupSubcategoryOptions])

  const departmentSelectValue = formRecord ? getControlledSelectValue(formRecord.department, departmentField.options) : ''
  const roomLineSelectValue = formRecord ? getControlledSelectValue(formRecord.roomLine, roomLineField.options) : ''

  const departmentOtherValue = formRecord
    ? departmentOtherDraft || getOtherOptionValue(formRecord.department, departmentField.options)
    : ''
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

  async function ensureGroupOption(value: string, options: readonly string[]): Promise<string> {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (options.includes(trimmed)) return trimmed
    const duplicate = findDuplicateOption(trimmed, options)
    if (duplicate) return duplicate
    await addFieldOption({
      fieldType: 'group',
      context: cascadeContext,
      displayValue: trimmed,
      actor,
    })
    return trimmed
  }

  function validateRecord(record: VmpMasterlistRecord): string | null {
    if (!record.itemName.trim()) {
      return 'Description is required before saving.'
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
            ? await ensureGroupOption(formRecord.group, groupField.options)
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
      if (payload.responsibleOwner.trim()) {
        rememberResponsibleOwner(payload.responsibleOwner)
        refreshResponsibleOwnerOptions()
      }
      if (payload.group.trim() && groupField.useDropdown) {
        rememberGroupSubcategory(groupSuggestionScope, payload.group)
        refreshGroupSubcategoryOptions()
      }
      setDepartmentOtherDraft('')
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

  function renderGroupSubcategoryField(required = false) {
    if (!groupField.visible || !groupField.useDropdown) return null
    return (
      <FormEditableCombobox
        label={groupField.label}
        required={required}
        value={formRecord!.group}
        options={groupSubcategoryOptions}
        removableOptions={savedGroupSubcategories}
        loading={optionsLoading}
        placeholder="Type or select group / subcategory…"
        onChange={(value) => updateCascadeField('group', value)}
        onCommit={(value) => {
          rememberGroupSubcategory(groupSuggestionScope, value)
          refreshGroupSubcategoryOptions()
        }}
        onRemoveOption={(value) => {
          forgetGroupSubcategory(groupSuggestionScope, value)
          refreshGroupSubcategoryOptions()
        }}
      />
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

      {optionsLoading ? (
        <p className="flex items-center gap-2 text-sm text-[var(--muted)]" role="status">
          <Loader2 className="size-4 animate-spin text-[var(--teal)]" aria-hidden="true" />
          Loading field options…
        </p>
      ) : null}
      {optionsError ? (
        <p
          className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--danger-text)_28%,var(--border))] bg-[var(--badge-danger-bg)] px-3 py-2.5 text-sm font-semibold text-[var(--danger-text)]"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{optionsError}</span>
        </p>
      ) : null}

      {saveSuccess ? (
        <section
          className="rounded-xl border border-[color-mix(in_srgb,var(--teal)_35%,var(--border))] bg-[color-mix(in_srgb,var(--teal)_8%,var(--surface))] p-5 shadow-[var(--shadow)]"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--teal)]" aria-hidden="true" />
            <div className="min-w-0">
              <strong className="block text-[var(--navy)]">Record saved successfully.</strong>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {saveSuccess.recordId} — {saveSuccess.itemName}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
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
        className="vmp-form-page vmp-form-page--modern flex flex-col gap-5"
        aria-label="Masterlist Form"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSave('saved')
        }}
      >
        <section className={VMP_SECTION_CARD_CLASS}>
          <VmpFormSectionHeader
            title="Record Classification and Identification"
            description="Select the validation area and related classification fields, then identify the applicable item, system, area, asset, responsible owner, and criticality for this record."
            icon="clipboard-list"
          />
          <div className={VMP_FORM_GRID_CLASS}>
            <FormInput
              label="Description"
              required
              wide
              value={formRecord.itemName}
              onChange={(value) => setFormRecord((current) => current && { ...current, itemName: value })}
            />
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
                {renderGroupSubcategoryField(true)}
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
                {renderGroupSubcategoryField(groupField.options.length > 0)}
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
                {renderGroupSubcategoryField(false)}
              </>
            ) : null}

            {!isEquipment ? (
              <FormInput
                label="Asset / Tag No."
                value={formRecord.assetTagNo}
                onChange={(value) => setFormRecord((current) => current && { ...current, assetTagNo: value })}
                helper="Optional for facilities or records without a formal tag."
              />
            ) : null}
            <FormEditableCombobox
              label="Responsible Owner"
              value={formRecord.responsibleOwner}
              options={responsibleOwnerOptions}
              removableOptions={savedResponsibleOwners}
              loading={optionsLoading}
              placeholder="Type or select responsible owner…"
              onChange={(value) => setFormRecord((current) => current && { ...current, responsibleOwner: value })}
              onCommit={(value) => {
                rememberResponsibleOwner(value)
                refreshResponsibleOwnerOptions()
              }}
              onRemoveOption={(value) => {
                forgetResponsibleOwner(value)
                refreshResponsibleOwnerOptions()
              }}
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

        <section className={VMP_SECTION_CARD_CLASS}>
          <VmpFormSectionHeader
            title="Document References"
            description="Linked protocol and report tracer numbers."
            icon="link"
          />
          <div className={VMP_FORM_GRID_CLASS}>
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

        <section className={VMP_SECTION_CARD_CLASS}>
          <VmpFormSectionHeader
            title="Schedule and Status"
            description="Review cycle, validation state, and lifecycle tracking."
            icon="calendar"
          />
          <div className={VMP_FORM_GRID_CLASS}>
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
          <p
            className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--danger-text)_28%,var(--border))] bg-[var(--badge-danger-bg)] px-3 py-2.5 text-sm font-semibold text-[var(--danger-text)]"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{formMessage}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] sm:p-5">
          {isEditMode ? (
            <>
              <button
                type="submit"
                className="vrms-btn-primary vmp-btn-with-icon inline-flex items-center gap-2"
                disabled={isSaving || optionsLoading}
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                {isSaving ? 'Saving…' : 'Update Record'}
              </button>
              <button type="button" className="vrms-btn-secondary vmp-btn-with-icon inline-flex items-center gap-2" onClick={handleCancel}>
                <X className="size-4" aria-hidden="true" />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="submit"
                className="vrms-btn-primary vmp-btn-with-icon inline-flex items-center gap-2"
                disabled={isSaving || !canCreate || optionsLoading}
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                {isSaving ? 'Saving…' : 'Save Record'}
              </button>
              <button
                type="button"
                className="vrms-btn-secondary vmp-btn-with-icon inline-flex items-center gap-2"
                disabled={isSaving || !canCreate || optionsLoading}
                onClick={() => void handleSave('draft')}
              >
                <FilePen className="size-4" aria-hidden="true" />
                Save as Draft
              </button>
              <button type="button" className="vrms-btn-secondary vmp-btn-with-icon inline-flex items-center gap-2" onClick={handleClear}>
                <Eraser className="size-4" aria-hidden="true" />
                Clear Form
              </button>
              <button type="button" className="vrms-btn-secondary vmp-btn-with-icon inline-flex items-center gap-2" onClick={handleCancel}>
                <X className="size-4" aria-hidden="true" />
                Cancel
              </button>
            </>
          )}
        </div>
      </form>
    </VrmsPage>
  )
}
