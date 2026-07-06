import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { VrmsPage } from '../../components/vrms/VrmsPage'
import { NaOptionalInput, NaOptionalTextarea } from '../../components/forms/NaOptionalField'
import { useToast } from '../../components/feedback/ToastProvider'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { useVrmsApp } from '../../context/VrmsAppContext'
import { VRMS_ROUTING_FORM_FIELDS } from '../../lib/vrmsFormConfig'
import { NA_OPTIONAL_VALUE, isNaOptionalValue } from '../../lib/naOptionalField'
import { formatVrmsDateTime, getStatusKey, normalizeOptionalField, validateRoutingPayload } from '../../utils/vrmsLogic'
import type { RoutingDocument, SaveRoutingDocumentPayload, VrmsSignatory } from '../../types/vrms'

function emptySignatory(order: number, active: boolean): VrmsSignatory {
  return {
    Order: order,
    Name: '',
    Status: active ? 'Active' : 'Pending',
    'Date/time forwarded': active ? formatVrmsDateTime(new Date()) : '',
    'Date/time signed': '',
    'Duration pending/signing time': '',
  }
}

function documentToFormState(doc: RoutingDocument) {
  return {
    routingTracker: doc.routingTracker,
    docTracer: doc.docTracer,
    equipmentProduct: doc.equipmentProduct,
    category: doc.category,
    ilTag: doc.ilTag,
    status: doc.status,
    sentRoutingTo: doc.sentRoutingTo,
    email: doc.email,
    dateSent: doc.dateSent,
    reportProtocol: doc.reportProtocol,
    batchNo: isNaOptionalValue(doc.batchNo) ? NA_OPTIONAL_VALUE : doc.batchNo,
    clientName: doc.clientName,
    department: doc.department,
    preparedBy: doc.preparedBy,
    datePrepared: doc.datePrepared,
    checkedBy: doc.checkedBy,
    dateChecked: doc.dateChecked,
    targetCompletionDate: doc.targetCompletionDate,
    remarks: doc.remarks,
  }
}

const initialForm = {
  routingTracker: '',
  docTracer: '',
  equipmentProduct: '',
  category: '',
  ilTag: NA_OPTIONAL_VALUE,
  status: '' as RoutingDocument['status'],
  sentRoutingTo: '',
  email: NA_OPTIONAL_VALUE,
  dateSent: '',
  reportProtocol: '',
  batchNo: NA_OPTIONAL_VALUE,
  clientName: '',
  department: '',
  preparedBy: '',
  datePrepared: '',
  checkedBy: '',
  dateChecked: '',
  targetCompletionDate: '',
  remarks: NA_OPTIONAL_VALUE,
}

function buildRoutingPayload(
  form: typeof initialForm,
  signatories: VrmsSignatory[],
  isCancelled: boolean,
): SaveRoutingDocumentPayload {
  return {
    ...form,
    ilTag: normalizeOptionalField(form.ilTag),
    email: normalizeOptionalField(form.email),
    batchNo: normalizeOptionalField(form.batchNo),
    remarks: normalizeOptionalField(form.remarks),
    signatories: isCancelled ? [] : signatories,
    __originalTracker: form.routingTracker,
  }
}

export function VrmsRoutingPage() {
  const { appData, saveDocument, signDocumentSignatory, getDocumentByTracker } = useVrmsApp()
  const { canCreate, canEdit, canApprove, canDelete } = useMenuPermission('routing')
  const { notify } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState(initialForm)
  const [signatories, setSignatories] = useState<VrmsSignatory[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<{ routingTracker: string; docTracer: string } | null>(null)
  const [signingOrder, setSigningOrder] = useState<number | null>(null)
  const persistedSnapshotRef = useRef('')

  const allowedNames = appData?.registries['Sent / Routing'] ?? []
  const isRouting = getStatusKey(form.status) === 'routing'
  const isCancelled = getStatusKey(form.status) === 'cancelled'
  const isFormDirty =
    persistedSnapshotRef.current !== '' &&
    JSON.stringify(buildRoutingPayload(form, signatories, isCancelled)) !== persistedSnapshotRef.current
  const canModifyForm = canCreate || canEdit
  const canSubmit = form.routingTracker ? canEdit : canCreate

  const loadTracker = useCallback(
    async (tracker: string) => {
      try {
        const record = await getDocumentByTracker(tracker)
        setForm(documentToFormState(record))
        const loadedSignatories = structuredClone(record.signatories)
        setSignatories(loadedSignatories)
        setSaveSuccess(null)
        persistedSnapshotRef.current = JSON.stringify(
          buildRoutingPayload(documentToFormState(record), loadedSignatories, getStatusKey(record.status) === 'cancelled'),
        )
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Failed to load tracker.')
      }
    },
    [getDocumentByTracker, notify],
  )

  useEffect(() => {
    const tracker = searchParams.get('tracker')
    if (tracker) void loadTracker(tracker)
  }, [loadTracker, searchParams])

  function resetFormState() {
    setForm(initialForm)
    setSignatories([])
    setSaveError(null)
    persistedSnapshotRef.current = ''
  }

  function updateField(key: string, value: string) {
    setSaveSuccess(null)
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleStatusChange(value: string) {
    setSaveSuccess(null)
    if (getStatusKey(value) === 'cancelled') {
      setSignatories([])
      setForm((current) => ({ ...current, status: value as RoutingDocument['status'], sentRoutingTo: '' }))
      notify('Cancelled status clears the Signatories Tracker for this form.')
      return
    }
    setForm((current) => ({ ...current, status: value as RoutingDocument['status'] }))
  }

  function handleSentRoutingChange(value: string) {
    setSaveSuccess(null)
    setForm((current) => ({ ...current, sentRoutingTo: value }))
    if (!isRouting) return
    setSignatories((current) => {
      const next = current.length ? [...current] : [emptySignatory(1, true)]
      next[0] = { ...next[0], Name: value, Status: 'Active', Order: 1 }
      return next
    })
  }

  function addSignatory() {
    setSignatories((current) => [
      ...current,
      emptySignatory(current.length + 1, isRouting && !current.length),
    ])
  }

  function removeSignatory(index: number) {
    setSignatories((current) =>
      current
        .filter((_, idx) => idx !== index)
        .map((item, idx) => ({ ...item, Order: idx + 1 })),
    )
  }

  function updateSignatory(index: number, key: keyof VrmsSignatory, value: string | number) {
    setSignatories((current) =>
      current.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)),
    )
  }

  async function handleSubmit() {
    setSaving(true)
    setSaveError(null)
    try {
      const payload = buildRoutingPayload(form, signatories, isCancelled)
      validateRoutingPayload(payload)
      const data = await saveDocument(payload)
      const saved = data.documents.find((doc) => doc.docTracer === form.docTracer)
      const routingTracker = saved?.routingTracker ?? form.routingTracker
      const docTracer = saved?.docTracer ?? form.docTracer
      resetFormState()
      setSaveSuccess({ routingTracker, docTracer })
      navigate('/routing')
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not save the routing record. Check required fields and your connection, then try again.'
      setSaveError(message)
      notify(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSign(order: number) {
    if (!form.routingTracker) return
    if (isFormDirty) {
      notify('Submit the form to save your changes before signing.')
      return
    }
    setSigningOrder(order)
    try {
      const result = await signDocumentSignatory(form.routingTracker, order)
      if (result.appData) {
        const saved = result.appData.documents.find((doc) => doc.routingTracker === form.routingTracker)
        if (saved) {
          setForm(documentToFormState(saved))
          const savedSignatories = structuredClone(saved.signatories)
          setSignatories(savedSignatories)
          persistedSnapshotRef.current = JSON.stringify(
            buildRoutingPayload(documentToFormState(saved), savedSignatories, getStatusKey(saved.status) === 'cancelled'),
          )
        }
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Sign failed.')
    } finally {
      setSigningOrder(null)
    }
  }

  function clearForm() {
    resetFormState()
    setSaveSuccess(null)
    navigate('/routing')
  }

  return (
    <VrmsPage title="Document Routing" description="Register documents and track ordered signatories.">
      <div className="vrms-grid2">
        <section className="vrms-panel">
          <h2>Document Routing Form</h2>
          {saveSuccess ? (
            <p className="form-success" role="status" aria-live="polite">
              Document routing record saved successfully.
              {saveSuccess.routingTracker ? ` Tracker: ${saveSuccess.routingTracker}` : ''}
              {saveSuccess.docTracer ? ` · Doc Tracer: ${saveSuccess.docTracer}` : ''}
            </p>
          ) : null}
          {form.routingTracker ? (
            <div className="vrms-tracker-callout">
              Tracker{' '}
              <button type="button" className="vrms-tracker-link" onClick={() => void loadTracker(form.routingTracker)}>
                {form.routingTracker}
              </button>
            </div>
          ) : null}

          <div className="vrms-formgrid">
            {VRMS_ROUTING_FORM_FIELDS.map((field) => {
              const value = String(form[field.key as keyof typeof form] ?? '')
              return (
                <div key={field.key} className={field.wide ? 'wide' : undefined}>
                  <label>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </label>
                  {field.naOptional && field.type === 'textarea' ? (
                    <NaOptionalTextarea
                      value={value}
                      disabled={!canModifyForm}
                      onChange={(next) => updateField(field.key, next)}
                    />
                  ) : field.naOptional ? (
                    <NaOptionalInput
                      type={field.type === 'email' ? 'text' : (field.type ?? 'text')}
                      inputMode={field.type === 'email' ? 'email' : undefined}
                      value={value}
                      disabled={!canModifyForm}
                      onChange={(next) => updateField(field.key, next)}
                    />
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={value}
                      disabled={!canModifyForm}
                      onChange={(event) => updateField(field.key, event.target.value)}
                    />
                  ) : field.registryType ? (
                    <select
                      value={value}
                      disabled={!canModifyForm}
                      onChange={(event) => {
                        const next = event.target.value
                        if (field.key === 'status') handleStatusChange(next)
                        else if (field.key === 'sentRoutingTo') handleSentRoutingChange(next)
                        else updateField(field.key, next)
                      }}
                    >
                      <option value="">Select {field.label}</option>
                      {(appData?.registries[field.registryType] ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type ?? 'text'}
                      value={value}
                      disabled={!canModifyForm}
                      onChange={(event) => updateField(field.key, event.target.value)}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {saveError ? <p className="form-error">{saveError}</p> : null}

          <div className="vrms-actions">
            {canSubmit ? (
              <button type="button" className="vrms-btn-primary" disabled={saving} onClick={() => void handleSubmit()}>
                {saving ? 'Saving…' : 'Submit'}
              </button>
            ) : null}
            {canCreate ? (
              <button type="button" className="vrms-btn-secondary" disabled={saving} onClick={clearForm}>
                Clear
              </button>
            ) : null}
          </div>
        </section>

        <section className="vrms-panel">
          <h2>Signatories Tracker</h2>
          <div className="vrms-signatory-list">
            {signatories.length === 0 ? (
              <p className="vrms-muted">No signatories added.</p>
            ) : (
              signatories.map((item, index) => {
                const canSign =
                  Boolean(form.routingTracker) && isRouting && item.Status === 'Active' && canApprove && !isFormDirty
                const signed = item.Status === 'Signed'
                return (
                  <div className="vrms-signatory-row" key={`${item.Order}-${index}`}>
                    <div className="vrms-signatory-head">
                      <strong>#{index + 1}</strong>
                      <span>{item.Status}</span>
                    </div>
                    <label>Signatory/Approver Name</label>
                    <select
                      value={item.Name}
                      disabled={signed || (isRouting && index === 0) || !canModifyForm}
                      onChange={(event) => updateSignatory(index, 'Name', event.target.value)}
                    >
                      <option value="">Select signatory</option>
                      {allowedNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <div className="vrms-signatory-meta">
                      <div>
                        <label>Date/time forwarded</label>
                        <input value={item['Date/time forwarded'] || 'Not forwarded'} readOnly />
                      </div>
                      <div>
                        <label>Date/time signed</label>
                        <input value={item['Date/time signed'] || 'Not signed'} readOnly />
                      </div>
                    </div>
                    <div className="vrms-signatory-meta">
                      <div>
                        <label>Duration</label>
                        <input value={item['Duration pending/signing time'] || ''} readOnly />
                      </div>
                      <div className="vrms-actions" style={{ margin: 0 }}>
                        {canApprove ? (
                          <button
                            type="button"
                            className="vrms-btn-primary"
                            disabled={!canSign || signingOrder !== null}
                            onClick={() => void handleSign(item.Order)}
                          >
                            {signingOrder === item.Order ? 'Signing…' : 'Signed'}
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className="vrms-btn-secondary"
                            disabled={signed}
                            onClick={() => removeSignatory(index)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          {canEdit ? (
            <div className="vrms-actions">
              <button type="button" className="vrms-btn-secondary" onClick={addSignatory}>
                Add Signatory
              </button>
            </div>
          ) : null}
          <p className="vrms-muted" style={{ padding: '0 30px 24px' }}>
            Signatory names must be selected from Sent/Routing To. Only the active signatory can be marked signed.
          </p>
        </section>
      </div>
    </VrmsPage>
  )
}
