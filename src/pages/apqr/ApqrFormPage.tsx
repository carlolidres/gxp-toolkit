import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Input } from 'antd'

import { ApqrSearchableCombobox } from '../../components/apqr/ApqrSearchableCombobox'
import { AppDateInput } from '../../components/forms/AppDateInput'
import {
  ApqrCommitmentStatusBadge,
  ApqrError,
  ApqrIcon,
  ApqrLoading,
  ApqrPage,
} from '../../components/apqr/ApqrComponents'
import { useToast } from '../../components/feedback/ToastProvider'
import { useAuth } from '../../hooks/useAuth'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { expectedStabilityTabulationCompletionDate } from '../../features/apqr/scheduling'
import {
  DELAY_CATEGORIES,
  addFollowUp,
  deleteFollowUp,
  formatApqrDate,
  formatApqrDateTime,
  formatReviewCoverage,
  listDatabaseRows,
  listDepartmentSuggestions,
  listFollowUps,
  listReportStatusSuggestions,
  listSentBySuggestions,
  requiresDelayInfo,
  saveRecord,
  updateFollowUp,
} from '../../features/apqr/apqrService'
import { rememberDepartment } from '../../features/apqr/departmentSuggestions'
import { rememberReportStatus } from '../../features/apqr/reportStatusSuggestions'
import { rememberSentBy } from '../../features/apqr/sentBySuggestions'
import { CONTACT_EMAIL_RE, parseContactSegments, parseContacts } from '../../features/apqr/apqrContacts'
import { useApqrRecord } from '../../features/apqr/useApqrData'
import type { ApqrDepartment, ApqrFollowUp, ApqrReportStatus, StabilityTabulationStatus } from '../../features/apqr/types'

const DEPARTMENTS: ApqrDepartment[] = ['Dry', 'Liquids', 'Creams and Ointments', 'Topicals', 'Cosmetics']
const STAB_STATUSES: StabilityTabulationStatus[] = ['No Ongoing Stability', 'Not Sent', 'Sent']
const REPORT_STATUSES: ApqrReportStatus[] = ['Draft Sent', 'For Client Approval', 'Client Approved']
const REMARKS_MAX = 1000

export function ApqrFormPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const apqrId = searchParams.get('apqr')
  const { data, loading, error, reload } = useApqrRecord(apqrId)
  const { canEdit } = useMenuPermission('apqr-form')
  const { user } = useAuth()
  const { notify } = useToast()
  const followUpSectionRef = useRef<HTMLElement | null>(null)

  const [lookup, setLookup] = useState(apqrId ?? '')
  const [busy, setBusy] = useState(false)
  const [followUps, setFollowUps] = useState<ApqrFollowUp[]>([])
  const [delayPanelOpen, setDelayPanelOpen] = useState(false)
  const [followUpFormOpen, setFollowUpFormOpen] = useState(false)
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null)

  const [department, setDepartment] = useState('')
  const [stabStatus, setStabStatus] = useState<StabilityTabulationStatus | ''>('')
  const [noStabJustification, setNoStabJustification] = useState('')
  const [reportStatus, setReportStatus] = useState('')
  const [sentBy, setSentBy] = useState('')
  const [dateSent, setDateSent] = useState('')
  const [aprRef, setAprRef] = useState('')
  const [batches, setBatches] = useState('')
  const [zeroBatchRemark, setZeroBatchRemark] = useState('')
  const [dateSigned, setDateSigned] = useState('')
  const [finalDelivery, setFinalDelivery] = useState('')
  const [billingRef, setBillingRef] = useState('')
  const [delayCategory, setDelayCategory] = useState('')
  const [delayReason, setDelayReason] = useState('')
  const [expectedDelivery, setExpectedDelivery] = useState('')
  const [remarks, setRemarks] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpRemarks, setFollowUpRemarks] = useState('')
  const [savedSenders, setSavedSenders] = useState<string[]>([])
  const [savedDepartments, setSavedDepartments] = useState<string[]>([])
  const [savedReportStatuses, setSavedReportStatuses] = useState<string[]>([])

  const showDelayPrompt = useMemo(() => {
    if (!data?.sched || !finalDelivery) return false
    return requiresDelayInfo(data.sched.commitment_schedule, finalDelivery)
  }, [data, finalDelivery])

  const showOverdueUndelivered = useMemo(() => {
    if (!data?.sched || finalDelivery) return false
    const today = new Date().toISOString().slice(0, 10)
    return today > data.sched.commitment_schedule
  }, [data, finalDelivery])

  const showDelayPanel = showDelayPrompt || delayPanelOpen || Boolean(delayCategory || delayReason)

  const recordIsActive = data?.record?.record_status === 'active' && data?.sched?.is_active !== false
  const canSetDateSigned = canEdit && reportStatus === 'Client Approved'

  const departmentOptions = useMemo(() => {
    const names = new Set<string>(DEPARTMENTS)
    if (department.trim()) names.add(department.trim())
    savedDepartments.forEach((name) => names.add(name))
    const standard = DEPARTMENTS.filter((entry) => names.has(entry))
    const extras = [...names]
      .filter((entry) => !DEPARTMENTS.includes(entry as ApqrDepartment))
      .sort((a, b) => a.localeCompare(b))
    return [...standard, ...extras]
  }, [department, savedDepartments])

  const reportStatusOptions = useMemo(() => {
    const names = new Set<string>(REPORT_STATUSES)
    if (reportStatus.trim()) names.add(reportStatus.trim())
    savedReportStatuses.forEach((status) => names.add(status))
    const standard = REPORT_STATUSES.filter((entry) => names.has(entry))
    const extras = [...names]
      .filter((entry) => !REPORT_STATUSES.includes(entry as ApqrReportStatus))
      .sort((a, b) => a.localeCompare(b))
    return [...standard, ...extras]
  }, [reportStatus, savedReportStatuses])

  const senderOptions = useMemo(() => {
    const names = new Set<string>()
    if (user?.name) names.add(user.name)
    if (sentBy.trim()) names.add(sentBy.trim())
    savedSenders.forEach((name) => names.add(name))
    followUps.forEach((fu) => {
      if (fu.recorded_by.trim()) names.add(fu.recorded_by.trim())
    })
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [user?.name, sentBy, savedSenders, followUps])

  useEffect(() => {
    void listSentBySuggestions().then(setSavedSenders)
    void listDepartmentSuggestions().then(setSavedDepartments)
    void listReportStatusSuggestions().then(setSavedReportStatuses)
  }, [apqrId])

  const expectedStab = useMemo(() => {
    const pullOut = data?.sched.stability_pull_out_date
    return pullOut ? expectedStabilityTabulationCompletionDate(pullOut) : null
  }, [data])

  useEffect(() => {
    setLookup(apqrId ?? '')
  }, [apqrId])

  useEffect(() => {
    if (!data?.record) return
    const r = data.record
    setDepartment(r.department ?? '')
    setStabStatus(r.stability_tabulation_status ?? '')
    setNoStabJustification(r.no_ongoing_stability_justification ?? '')
    setReportStatus(r.apqr_report_status ?? '')
    setSentBy(r.sent_by ?? user?.name ?? '')
    setDateSent(r.date_sent ?? '')
    setAprRef(r.apr_reference_number ?? '')
    setBatches(r.number_of_batches != null ? String(r.number_of_batches) : '')
    setZeroBatchRemark(r.zero_batch_explanation ?? '')
    setDateSigned(r.date_client_signed ?? '')
    setFinalDelivery(r.final_apqr_delivery_date ?? '')
    setBillingRef(r.billing_reference_number ?? '')
    setDelayCategory(r.delay_category ?? '')
    setDelayReason(r.delay_reason ?? '')
    setExpectedDelivery(r.expected_final_delivery_date ?? '')
    setRemarks(r.remarks ?? '')
    setDelayPanelOpen(Boolean(r.delay_category || r.delay_reason))
    void listFollowUps(r.id).then(setFollowUps)
  }, [data, user?.name])

  function openLookup() {
    const id = lookup.trim()
    if (!id) return
    setSearchParams({ apqr: id })
  }

  function scrollToFollowUps() {
    followUpSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function resetFollowUpForm() {
    setFollowUpDate('')
    setFollowUpRemarks('')
    setEditingFollowUpId(null)
    setFollowUpFormOpen(false)
  }

  function startEditFollowUp(entry: ApqrFollowUp) {
    setEditingFollowUpId(entry.id)
    setFollowUpDate(entry.follow_up_date)
    setFollowUpRemarks(entry.follow_up_remarks)
    setFollowUpFormOpen(true)
    scrollToFollowUps()
  }

  async function handleSave() {
    if (!apqrId || !canEdit) return
    if (remarks.length > REMARKS_MAX) {
      notify(`Remarks must be ${REMARKS_MAX} characters or fewer.`)
      return
    }
    setBusy(true)
    try {
      await saveRecord(apqrId, {
        department: department || null,
        stability_tabulation_status: stabStatus || null,
        no_ongoing_stability_justification: noStabJustification || null,
        apqr_report_status: reportStatus || null,
        sent_by: sentBy || null,
        date_sent: dateSent || null,
        apr_reference_number: aprRef || null,
        number_of_batches: batches === '' ? null : Number(batches),
        zero_batch_explanation: zeroBatchRemark || null,
        date_client_signed: reportStatus === 'Client Approved' ? dateSigned || null : null,
        final_apqr_delivery_date: finalDelivery || null,
        billing_reference_number: billingRef || null,
        delay_category: delayCategory || null,
        delay_reason: delayReason || null,
        expected_final_delivery_date: expectedDelivery || null,
        remarks: remarks || null,
      })
      if (sentBy.trim()) {
        rememberSentBy(sentBy)
        setSavedSenders(await listSentBySuggestions())
      }
      if (department.trim()) {
        rememberDepartment(department)
        setSavedDepartments(await listDepartmentSuggestions())
      }
      if (reportStatus.trim()) {
        rememberReportStatus(reportStatus)
        setSavedReportStatuses(await listReportStatusSuggestions())
      }
      notify('Successfully Saved')
      await reload()
      await listDatabaseRows()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to Save')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveFollowUp() {
    if (!apqrId || !canEdit || !followUpDate || !followUpRemarks.trim()) return
    setBusy(true)
    try {
      if (editingFollowUpId) {
        await updateFollowUp(apqrId, editingFollowUpId, {
          follow_up_date: followUpDate,
          follow_up_remarks: followUpRemarks,
        })
      } else {
        await addFollowUp(apqrId, {
          follow_up_date: followUpDate,
          follow_up_remarks: followUpRemarks,
          recorded_by: user?.name ?? sentBy ?? 'Unknown',
        })
      }
      notify('Successfully Saved')
      resetFollowUpForm()
      await reload()
      if (data?.record) setFollowUps(await listFollowUps(data.record.id))
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to Save')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteFollowUp(entry: ApqrFollowUp) {
    if (!apqrId || !canEdit) return
    if (!window.confirm('Remove this follow-up entry?')) return
    setBusy(true)
    try {
      await deleteFollowUp(apqrId, entry.id)
      notify('Successfully Saved')
      if (editingFollowUpId === entry.id) resetFollowUpForm()
      await reload()
      if (data?.record) setFollowUps(await listFollowUps(data.record.id))
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to Save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ApqrPage
      icon="document"
      title="APQR Form"
      description="Report progress, approval, delivery, and delay information."
      action={
        apqrId ? (
          <Link className="button secondary apqr-page-header-action" to="/apqr/audit">
            <ApqrIcon name="list" />
            View Audit Trail
          </Link>
        ) : null
      }
    >
      <section className="panel apqr-form-lookup" aria-label="APQR record lookup">
        <div className="apqr-form-lookup-row">
          <label className="apqr-search-field apqr-form-lookup-search" htmlFor="apqr-form-lookup-id">
            <ApqrIcon name="search" />
            <span className="sr-only">APQR ID</span>
            <Input
              id="apqr-form-lookup-id"
              type="search"
              placeholder="4 chars, e.g. aB12"
              title="4-character APQR ID (mixed upper and lower case letters and numbers)"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={16}
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  openLookup()
                }
              }}
              aria-label="APQR ID"
            />
          </label>
          <Button type="primary" className="button primary apqr-form-lookup-load" onClick={openLookup}>
            <ApqrIcon name="document" />
            Load
          </Button>
          {data?.record ? (
            <div className="apqr-form-record-status">
              <span className="apqr-dashboard-toolbar-label" id="apqr-form-record-status-label">
                Record Status
              </span>
              <span
                className={`apqr-status-live tone-${recordIsActive ? 'success' : 'neutral'}`}
                role="status"
                aria-labelledby="apqr-form-record-status-label"
              >
                <span
                  className={`apqr-status-dot tone-${recordIsActive ? 'success' : 'neutral'}`}
                  aria-hidden="true"
                />
                {recordIsActive ? 'Active' : 'Archived'}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {loading ? <ApqrLoading /> : null}
      {error ? <ApqrError message={error} /> : null}

      {data?.sched && data.client ? (
        <>
          <section className="panel apqr-form-section">
            <SectionHeader
              icon="users"
              title="Client Information"
              action={
                <Link className="apqr-form-link" to={`/apqr/registry?code=${encodeURIComponent(data.client.code)}`}>
                  Open Client Registry
                  <ApqrIcon name="external" />
                </Link>
              }
            />
            <div className="apqr-form-info-grid">
              <InfoField label="Code" value={data.client.code} />
              <InfoField label="Client Name" value={data.client.client_name} />
              <InfoField label="Account Manager" value={data.client.account_manager} />
              <InfoField
                label="APQR Package"
                value={
                  <span
                    className={`status-pill ${data.client.apqr_package === 'Billable' ? 'success' : 'neutral'}`}
                  >
                    {data.client.apqr_package}
                  </span>
                }
              />
              <InfoField label="QA Contact" value={data.client.qa} contact />
              <InfoField label="Technical Contact" value={data.client.technical} contact />
              <InfoField label="Regulatory Contact" value={data.client.regulatory} contact />
            </div>
          </section>

          <section className="panel apqr-form-section apqr-form-schedule-section">
            <SectionHeader
              icon="calendar"
              title="Product & Schedule"
              action={
                <Link className="apqr-form-link" to={`/apqr/scheduler?client=${encodeURIComponent(data.client.id)}`}>
                  Open APQR Scheduler
                  <ApqrIcon name="external" />
                </Link>
              }
            />
            <div className="apqr-form-info-grid">
              <InfoField label="Product" value={data.sched.product_name} />
              <InfoField
                label="Review Coverage"
                value={formatReviewCoverage(data.sched.review_coverage_start, data.sched.review_coverage_end)}
              />
              <InfoField label="Department" value={department} />
              <InfoField label="Stability Pull-Out" value={formatApqrDate(data.sched.stability_pull_out_date)} />
              <InfoField
                className="apqr-form-info-field--emphasis"
                label="Commitment Schedule"
                value={<span className="apqr-form-highlight">{formatApqrDate(data.sched.commitment_schedule)}</span>}
              />
              <InfoField label="Expected Stability Tabulation" value={formatApqrDate(expectedStab)} />
              <InfoField
                label="Commitment Schedule Status"
                value={<ApqrCommitmentStatusBadge status={data.sched.commitment_schedule_status} />}
              />
              <InfoField label="Schedule Status Date" value={formatApqrDate(data.sched.schedule_status_date)} />
            </div>
          </section>

          <section className="panel apqr-form-section apqr-form-report-section">
            <SectionHeader icon="document" title="APQR Report Details" />
            <div className="apqr-form-report-grid">
              <Field label="Department" required>
                <ApqrSearchableCombobox
                  id="apqr-department"
                  value={department}
                  options={departmentOptions}
                  disabled={!canEdit}
                  placeholder="Type or select department…"
                  onChange={setDepartment}
                  onCommit={rememberDepartment}
                />
              </Field>
              <Field label="Stability Tabulation Status" required>
                <select
                  value={stabStatus}
                  disabled={!canEdit}
                  onChange={(e) => setStabStatus(e.target.value as StabilityTabulationStatus)}
                >
                  <option value="">Select…</option>
                  {STAB_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tabulation Status Date">
                <input
                  type="text"
                  className="apqr-form-readonly"
                  readOnly
                  value={formatApqrDate(data.record?.stability_tabulation_status_date)}
                  aria-readonly
                  tabIndex={-1}
                />
              </Field>
              <Field label="APQR Report Status" required>
                <ApqrSearchableCombobox
                  id="apqr-report-status"
                  value={reportStatus}
                  options={reportStatusOptions}
                  disabled={!canEdit}
                  placeholder="Type or select report status…"
                  onChange={(next) => {
                    setReportStatus(next)
                    if (next !== 'Client Approved') setDateSigned('')
                  }}
                  onCommit={rememberReportStatus}
                />
              </Field>
              <Field label="Sent By" required>
                <ApqrSearchableCombobox
                  id="apqr-sent-by"
                  value={sentBy}
                  options={senderOptions}
                  disabled={!canEdit}
                  placeholder="Type or select sender…"
                  onChange={setSentBy}
                  onCommit={rememberSentBy}
                />
              </Field>
              <Field label="Date Sent" required>
                <AppDateInput value={dateSent} disabled={!canEdit} onChange={(e) => setDateSent(e.target.value)} />
              </Field>
              <div className="apqr-form-action-chip apqr-form-followup-chip">
                <span className="apqr-field-label">Follow-Up History</span>
                <Button className="button secondary apqr-form-chip-btn" onClick={scrollToFollowUps}>
                  <ApqrIcon name="clock" />
                  View History
                  {followUps.length > 0 ? (
                    <span className="apqr-count-badge" aria-label={`${followUps.length} entries`}>
                      {followUps.length}
                    </span>
                  ) : null}
                </Button>
              </div>
              <Field label="APR Reference Number" required>
                <input
                  placeholder="APR-YYYY-xxxx"
                  value={aprRef}
                  disabled={!canEdit}
                  onChange={(e) => setAprRef(e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Number of Batches" required>
                <input type="number" min={0} value={batches} disabled={!canEdit} onChange={(e) => setBatches(e.target.value)} />
              </Field>
              <Field label="Date Client Signed">
                <AppDateInput
                  value={dateSigned}
                  disabled={!canSetDateSigned}
                  onChange={(e) => setDateSigned(e.target.value)}
                />
              </Field>
              <Field label="Final APQR Delivery Date">
                <AppDateInput value={finalDelivery} disabled={!canEdit} onChange={(e) => setFinalDelivery(e.target.value)} />
              </Field>
              <Field label="Billing Reference Number" required={data.client.apqr_package === 'Billable'}>
                <input
                  value={billingRef}
                  disabled={!canEdit || data.client.apqr_package !== 'Billable'}
                  onChange={(e) => setBillingRef(e.target.value)}
                />
              </Field>
              <div className="apqr-form-action-chip apqr-form-delay-chip">
                <span className="apqr-field-label">Delay Information</span>
                {showDelayPanel ? (
                  <span className="apqr-form-chip-status tone-warning">
                    {delayCategory || 'Details recorded below'}
                  </span>
                ) : (
                  <span className="apqr-form-chip-status tone-neutral">None recorded</span>
                )}
                {canEdit ? (
                  <Button
                    className="button secondary apqr-form-chip-btn"
                    onClick={() => setDelayPanelOpen(true)}
                  >
                    <ApqrIcon name="warning" />
                    Add Delay Info
                  </Button>
                ) : null}
              </div>
            </div>

            {(stabStatus === 'No Ongoing Stability' || batches === '0') ? (
              <div className="apqr-form-report-grid apqr-form-report-conditional">
                {stabStatus === 'No Ongoing Stability' ? (
                  <Field label="No Ongoing Stability Justification" required className="span-2">
                    <textarea
                      rows={3}
                      value={noStabJustification}
                      disabled={!canEdit}
                      onChange={(e) => setNoStabJustification(e.target.value)}
                    />
                  </Field>
                ) : null}
                {batches === '0' ? (
                  <Field label="Zero-Batch Explanation" required className="span-2">
                    <textarea
                      rows={2}
                      value={zeroBatchRemark}
                      disabled={!canEdit}
                      onChange={(e) => setZeroBatchRemark(e.target.value)}
                    />
                  </Field>
                ) : null}
              </div>
            ) : null}

            {showDelayPanel ? (
              <div className="apqr-form-alert apqr-form-alert-warning" role="alert">
                <ApqrIcon name="warning" />
                <div className="apqr-form-alert-body">
                  <p className="apqr-form-alert-title">
                    {showDelayPrompt ? 'Delayed delivery — justification required' : 'Delay information'}
                  </p>
                  {showDelayPrompt ? (
                    <p className="apqr-form-alert-text">
                      This APQR was delivered after its Commitment Schedule. Please provide the reason for the delayed
                      delivery before saving the record.
                    </p>
                  ) : (
                    <p className="apqr-form-alert-text">
                      Record delay category and reason for reporting and audit purposes.
                    </p>
                  )}
                  <div className="apqr-form-report-grid apqr-form-alert-grid">
                    <Field label="Delay Category" required={showDelayPrompt}>
                      <select value={delayCategory} disabled={!canEdit} onChange={(e) => setDelayCategory(e.target.value)}>
                        <option value="">Select…</option>
                        {DELAY_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Delay Reason" required={showDelayPrompt} className="span-2">
                      <textarea rows={3} value={delayReason} disabled={!canEdit} onChange={(e) => setDelayReason(e.target.value)} />
                    </Field>
                  </div>
                </div>
              </div>
            ) : null}

            {showOverdueUndelivered ? (
              <div className="apqr-form-alert apqr-form-alert-warning" role="alert">
                <ApqrIcon name="warning" />
                <div className="apqr-form-alert-body">
                  <p className="apqr-form-alert-title">Overdue and not yet delivered</p>
                  <p className="apqr-form-alert-text">
                    This APQR is overdue and not yet delivered. Provide a current status update and expected final
                    delivery date.
                  </p>
                  <div className="apqr-form-report-grid apqr-form-alert-grid">
                    <Field label="Expected Final Delivery Date" required>
                      <AppDateInput
                        value={expectedDelivery}
                        disabled={!canEdit}
                        onChange={(e) => setExpectedDelivery(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="apqr-form-remarks-wrap">
              <Field label="Remarks" className="apqr-form-remarks">
                <textarea
                  rows={4}
                  value={remarks}
                  disabled={!canEdit}
                  maxLength={REMARKS_MAX}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <span className="apqr-char-counter" aria-live="polite">
                  {remarks.length} / {REMARKS_MAX}
                </span>
              </Field>
            </div>

            {canEdit ? (
              <div className="form-actions apqr-form-save">
                <Button type="primary" className="button primary" loading={busy} onClick={() => void handleSave()}>
                  <ApqrIcon name="save" />
                  Save Changes
                </Button>
              </div>
            ) : null}
          </section>

          <section className="panel apqr-form-section" id="follow-up-history" ref={followUpSectionRef}>
            <SectionHeader
              icon="clock"
              title="Follow-Up History"
              action={
                canEdit ? (
                  <Button
                    type="primary"
                    className="button primary"
                    onClick={() => {
                      if (followUpFormOpen && !editingFollowUpId) {
                        resetFollowUpForm()
                      } else {
                        setEditingFollowUpId(null)
                        setFollowUpFormOpen(true)
                      }
                    }}
                  >
                    <ApqrIcon name="plus" />
                    Add Follow-Up
                  </Button>
                ) : null
              }
            />

            {data.record?.next_follow_up_due_date ? (
              <p className="help-text">Next follow-up due: {formatApqrDate(data.record.next_follow_up_due_date)}</p>
            ) : null}

            {followUpFormOpen && canEdit ? (
              <div
                className="apqr-form-followup-compose"
                role="region"
                aria-labelledby="follow-up-compose-title"
              >
                <div className="apqr-form-followup-compose__header">
                  <span className="apqr-form-followup-compose__header-icon" aria-hidden="true">
                    <ApqrIcon name={editingFollowUpId ? 'edit' : 'plus'} width={18} height={18} />
                  </span>
                  <div>
                    <h3 id="follow-up-compose-title" className="apqr-form-followup-compose__title">
                      {editingFollowUpId ? 'Edit Follow-Up' : 'New Follow-Up'}
                    </h3>
                    <p className="apqr-form-followup-compose__subtitle">
                      {editingFollowUpId
                        ? 'Update the date or remarks for this entry.'
                        : 'Record a follow-up date and summary remarks.'}
                    </p>
                  </div>
                </div>
                <div className="apqr-form-followup-compose__body">
                  <div className="apqr-form-followup-grid">
                    <Field label="Follow-up date" required>
                      <AppDateInput
                        id="follow-up-date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        required
                        aria-required="true"
                      />
                    </Field>
                    <Field label="Follow-up remarks" required>
                      <textarea
                        id="follow-up-remarks"
                        rows={3}
                        value={followUpRemarks}
                        onChange={(e) => setFollowUpRemarks(e.target.value)}
                        required
                        aria-required="true"
                        placeholder="Summary of discussion, actions, or next steps…"
                      />
                    </Field>
                  </div>
                  <div className="apqr-form-followup-compose__actions">
                    <Button className="button secondary" onClick={resetFollowUpForm}>
                      <ApqrIcon name="close" />
                      Cancel
                    </Button>
                    <Button
                      type="primary"
                      className="button primary"
                      disabled={busy || !followUpDate || !followUpRemarks.trim()}
                      onClick={() => void handleSaveFollowUp()}
                    >
                      <ApqrIcon name={editingFollowUpId ? 'save' : 'check'} />
                      {editingFollowUpId ? 'Update Follow-Up' : 'Save Follow-Up'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="table-scroll">
              <table className="data-table apqr-form-followup-table">
                <thead>
                  <tr>
                    <th>Follow-Up Date</th>
                    <th>Remarks</th>
                    <th>Recorded By</th>
                    <th>Recorded At</th>
                    {canEdit ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {followUps.map((fu) => (
                    <tr key={fu.id}>
                      <td>{formatApqrDate(fu.follow_up_date)}</td>
                      <td>{fu.follow_up_remarks}</td>
                      <td>{fu.recorded_by}</td>
                      <td>{formatApqrDateTime(fu.recorded_at)}</td>
                      {canEdit ? (
                        <td>
                          <div className="apqr-row-actions">
                            <button
                              type="button"
                              className="button secondary apqr-icon-btn"
                              aria-label="Edit follow-up"
                              onClick={() => startEditFollowUp(fu)}
                            >
                              <ApqrIcon name="edit" />
                            </button>
                            <button
                              type="button"
                              className="button secondary apqr-icon-btn"
                              aria-label="Delete follow-up"
                              onClick={() => void handleDeleteFollowUp(fu)}
                            >
                              <ApqrIcon name="trash" />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {followUps.length === 0 ? <p className="messages-empty">No follow-up entries recorded yet.</p> : null}
            {followUps.length > 0 ? (
              <p className="apqr-form-followup-footer">
                Showing 1 to {followUps.length} of {followUps.length} entries
              </p>
            ) : null}
          </section>
        </>
      ) : !loading && apqrId ? (
        <p className="messages-empty">No APQR record found for {apqrId}.</p>
      ) : (
        <p className="messages-empty">Search for an APQR ID or open a record from the Dashboard, Scheduler, or Database.</p>
      )}
    </ApqrPage>
  )
}

function SectionHeader({
  icon,
  title,
  action,
}: {
  icon: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="apqr-form-section-header">
      <h2>
        <ApqrIcon name={icon} />
        {title}
      </h2>
      {action ? <div className="apqr-form-section-action">{action}</div> : null}
    </div>
  )
}

function ContactValue({ raw }: { raw: string }) {
  const structured = parseContacts(raw).filter((entry) => entry.name || entry.title || entry.email)
  if (raw.trim().startsWith('[') && structured.length > 0) {
    return (
      <div className="apqr-contact-lines">
        {structured.map((entry, index) => (
          <div key={`${entry.email}-${index}`} className="apqr-contact-entry">
            {entry.name ? <span className="apqr-contact-primary">{entry.name}</span> : null}
            {entry.title ? <span className="apqr-contact-secondary">{entry.title}</span> : null}
            {entry.email ? <span className="apqr-contact-email">{entry.email}</span> : null}
          </div>
        ))}
      </div>
    )
  }

  const segments = parseContactSegments(raw)
  if (segments.length <= 1 && !CONTACT_EMAIL_RE.test(raw)) {
    return <span className="apqr-form-info-text">{raw}</span>
  }

  return (
    <div className="apqr-contact-lines">
      {segments.map((segment, index) => {
        const emailMatch = segment.match(CONTACT_EMAIL_RE)
        if (!emailMatch || emailMatch.index == null) {
          return (
            <div key={`${segment}-${index}`} className="apqr-contact-entry">
              <span className="apqr-contact-primary">{segment}</span>
            </div>
          )
        }

        const email = emailMatch[0]
        const name = segment.slice(0, emailMatch.index).trim()
        const trailing = segment.slice(emailMatch.index + email.length).trim()

        return (
          <div key={`${segment}-${index}`} className="apqr-contact-entry">
            {name ? <span className="apqr-contact-primary">{name}</span> : null}
            <span className="apqr-contact-email">{email}</span>
            {trailing ? <span className="apqr-contact-secondary">{trailing}</span> : null}
          </div>
        )
      })}
    </div>
  )
}

function InfoField({
  label,
  value,
  contact = false,
  className,
}: {
  label: string
  value: ReactNode
  contact?: boolean
  className?: string
}) {
  const isEmpty =
    value == null ||
    value === '' ||
    (typeof value === 'string' && !value.trim())

  let content: ReactNode = value
  if (!isEmpty && contact && typeof value === 'string') {
    content = <ContactValue raw={value} />
  } else if (!isEmpty && typeof value === 'string' && value.includes('\n')) {
    content = <span className="apqr-form-info-text is-multiline">{value}</span>
  } else if (!isEmpty && typeof value === 'string') {
    content = <span className="apqr-form-info-text">{value}</span>
  }

  return (
    <div className={['apqr-form-info-field', className].filter(Boolean).join(' ')}>
      <span className="apqr-field-label">{label}</span>
      <div className="apqr-form-info-value">{isEmpty ? '—' : content}</div>
    </div>
  )
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <label className={['apqr-form-field', className].filter(Boolean).join(' ')}>
      <span className="apqr-field-label">
        {label}
        {required ? <span className="apqr-required">*</span> : null}
      </span>
      {children}
    </label>
  )
}
