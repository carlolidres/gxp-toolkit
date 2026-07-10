import { useCallback, useEffect, useId, useMemo, useRef } from 'react'

import { ApqrIcon } from './ApqrComponents'
import { AppDateInput } from '../forms/AppDateInput'
import {
  appendRemark,
  computedScheduleDates,
  formatOverrideRemark,
  PRODUCT_STATUS_OPTIONS,
  reviewCoverageNeedsReason,
  SCHEDULE_STATUS_UI,
  stabilityTabulationConflict,
  type ScheduleRowDraft,
} from '../../features/apqr/schedulerForm'
import { formatApqrDate } from '../../features/apqr/apqrService'
import { formatAppDate } from '../../utils/dateUtils'
import type { CommitmentScheduleStatus } from '../../features/apqr/types'

type AutoField = 'stability_pull_out_date' | 'commitment_schedule' | 'apqr_generation_date'

const AUTO_FIELD_LABELS: Record<AutoField, string> = {
  stability_pull_out_date: 'Stability Pull-Out Date',
  commitment_schedule: 'Commitment Date',
  apqr_generation_date: 'APQR Generation Report Date',
}

function SchedulerFormField({
  label,
  htmlFor,
  hint,
  children,
  className,
  computed,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
  className?: string
  computed?: boolean
}) {
  return (
    <div
      className={`apqr-form-field apqr-scheduler-field${computed ? ' is-computed' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="apqr-scheduler-field-label-row">
        <label htmlFor={htmlFor}>{label}</label>
        {computed ? (
          <span className="apqr-scheduler-computed-badge" title="System-calculated; editable with documented reason">
            Auto
          </span>
        ) : null}
      </div>
      {children}
      {hint ? <p className="help-text">{hint}</p> : null}
    </div>
  )
}

export function ApqrSchedulerFormPanel({
  form,
  clientName,
  productSuggestions,
  editable,
  busy,
  modeLabel,
  onChange,
  onSubmit,
  onClear,
  actorName,
}: {
  form: ScheduleRowDraft
  clientName: string
  productSuggestions: string[]
  editable: boolean
  busy: boolean
  modeLabel: string
  onChange: (patch: Partial<ScheduleRowDraft>) => void
  onSubmit: () => void
  onClear: () => void
  actorName: string
}) {
  const productListId = useId()
  const manualDatesId = useId()
  const manualDates = Boolean(form.manual_calculated_dates)
  const systemDates = useMemo(
    () => computedScheduleDates(form.review_coverage_end),
    [form.review_coverage_end],
  )
  const displayCommitment = manualDates
    ? (form.commitment_schedule ?? '')
    : form.commitment_schedule || systemDates.commitment_schedule
  const displayStability = manualDates
    ? form.stability_pull_out_date
    : form.stability_pull_out_date || systemDates.stability_pull_out_date
  const displayGeneration = manualDates
    ? (form.apqr_generation_date ?? '')
    : form.apqr_generation_date || systemDates.apqr_generation_date
  const stabConflict =
    Boolean(displayStability) &&
    Boolean(displayCommitment) &&
    stabilityTabulationConflict(displayStability, displayCommitment)
  const remarks = form.scheduler_remarks?.length ? form.scheduler_remarks : ['']
  const coverageNeedsReason = reviewCoverageNeedsReason(
    form.review_coverage_start,
    form.review_coverage_end,
  )

  const confirmOverride = useCallback(
    (field: AutoField, nextValue: string, systemValue: string): Partial<ScheduleRowDraft> | null => {
      if (nextValue === systemValue) {
        if (field === 'stability_pull_out_date') {
          return { stability_pull_out_adjustment_reason: undefined }
        }
        if (field === 'commitment_schedule') {
          return { commitment_schedule_adjustment_reason: undefined }
        }
        if (field === 'apqr_generation_date') {
          return { apqr_generation_adjustment_reason: undefined }
        }
        return {}
      }

      const confirmed = window.confirm(
        `You are overriding a system-generated ${AUTO_FIELD_LABELS[field]}.\n\nSystem value: ${formatAppDate(systemValue)}\nYour value: ${formatAppDate(nextValue)}\n\nContinue?`,
      )
      if (!confirmed) return null

      const reason = window.prompt(`Enter a reason for changing ${AUTO_FIELD_LABELS[field]}:`)?.trim()
      if (!reason) return null

      const remark = formatOverrideRemark(
        AUTO_FIELD_LABELS[field],
        systemValue,
        nextValue,
        reason,
        actorName,
      )

      const patch: Partial<ScheduleRowDraft> = {
        scheduler_remarks: appendRemark(remarks, remark),
      }

      if (field === 'stability_pull_out_date') {
        patch.stability_pull_out_date = nextValue
        patch.stability_pull_out_adjustment_reason = reason
      } else if (field === 'commitment_schedule') {
        patch.commitment_schedule = nextValue
        patch.commitment_schedule_adjustment_reason = reason
      } else if (field === 'apqr_generation_date') {
        patch.apqr_generation_date = nextValue
        patch.apqr_generation_adjustment_reason = reason
      }

      return patch
    },
    [actorName, remarks],
  )

  function applyCalculatedDates(reviewCoverageEnd: string, includeEnd = false) {
    const dates = computedScheduleDates(reviewCoverageEnd)
    onChange({
      ...(includeEnd ? { review_coverage_end: reviewCoverageEnd } : {}),
      stability_pull_out_date: dates.stability_pull_out_date,
      commitment_schedule: dates.commitment_schedule,
      apqr_generation_date: dates.apqr_generation_date,
      stability_pull_out_adjustment_reason: undefined,
      commitment_schedule_adjustment_reason: undefined,
      apqr_generation_adjustment_reason: undefined,
    })
  }

  function handleManualDatesToggle(checked: boolean) {
    if (!checked) {
      const dates = computedScheduleDates(form.review_coverage_end)
      onChange({
        manual_calculated_dates: false,
        stability_pull_out_date: dates.stability_pull_out_date,
        commitment_schedule: dates.commitment_schedule,
        apqr_generation_date: dates.apqr_generation_date,
        stability_pull_out_adjustment_reason: undefined,
        commitment_schedule_adjustment_reason: undefined,
        apqr_generation_adjustment_reason: undefined,
      })
      return
    }
    onChange({
      manual_calculated_dates: true,
      commitment_schedule: displayCommitment,
      stability_pull_out_date: displayStability,
      apqr_generation_date: displayGeneration,
    })
  }

  function handleCoverageEndChange(nextEnd: string) {
    if (manualDates) {
      onChange({ review_coverage_end: nextEnd })
      return
    }
    applyCalculatedDates(nextEnd, true)
  }

  function handleCoverageStartChange(nextStart: string) {
    onChange({ review_coverage_start: nextStart })
    if (reviewCoverageNeedsReason(nextStart, form.review_coverage_end)) {
      const reason = form.review_coverage_adjustment_reason?.trim()
      if (!reason) {
        const entered = window.prompt('Review Coverage differs from standard one-year period. Enter adjustment reason:')
        if (entered?.trim()) {
          onChange({ review_coverage_adjustment_reason: entered.trim() })
        }
      }
    }
  }

  function handleManualDateChange(field: AutoField, nextValue: string) {
    const patch: Partial<ScheduleRowDraft> = { [field]: nextValue }
    const systemValue = systemDates[field]
    if (!nextValue || nextValue === systemValue) {
      if (field === 'stability_pull_out_date') patch.stability_pull_out_adjustment_reason = undefined
      if (field === 'commitment_schedule') patch.commitment_schedule_adjustment_reason = undefined
      if (field === 'apqr_generation_date') patch.apqr_generation_adjustment_reason = undefined
    } else {
      if (field === 'stability_pull_out_date') {
        patch.stability_pull_out_adjustment_reason =
          form.stability_pull_out_adjustment_reason?.trim() || 'Manual date entry'
      }
      if (field === 'commitment_schedule') {
        patch.commitment_schedule_adjustment_reason =
          form.commitment_schedule_adjustment_reason?.trim() || 'Manual date entry'
      }
      if (field === 'apqr_generation_date') {
        patch.apqr_generation_adjustment_reason =
          form.apqr_generation_adjustment_reason?.trim() || 'Manual date entry'
      }
    }
    onChange(patch)
  }

  function handleAutoFieldChange(field: AutoField, nextValue: string) {
    if (manualDates) {
      handleManualDateChange(field, nextValue)
      return
    }
    const systemValue = systemDates[field]
    const patch = confirmOverride(field, nextValue, systemValue)
    if (patch) onChange(patch)
  }

  function updateRemark(index: number, value: string) {
    const next = [...remarks]
    next[index] = value
    onChange({ scheduler_remarks: next })
  }

  function addRemarkField() {
    onChange({ scheduler_remarks: [...remarks, ''] })
  }

  function removeRemarkField(index: number) {
    if (remarks.length <= 1) return
    if (!window.confirm('Remove this APQR remark field? This cannot be undone until you save.')) return
    onChange({ scheduler_remarks: remarks.filter((_, i) => i !== index) })
  }

  return (
    <section className="panel apqr-scheduler-form-panel" aria-labelledby="apqr-scheduler-form-title">
      <header className="apqr-scheduler-form-header">
        <div className="apqr-scheduler-form-header-text">
          <h2 id="apqr-scheduler-form-title">
            <ApqrIcon name="calendar" />
            APQR Schedule Form
          </h2>
          <p className="help-text">
            Register product review coverage, commitment dates, and schedule status. Calculated dates auto-fill from coverage unless manual entry is enabled.
          </p>
        </div>
        <span
          className={`apqr-scheduler-mode-badge${form.id ? ' is-edit' : ''}`}
          role="status"
          aria-live="polite"
        >
          <ApqrIcon name={form.id ? 'edit' : 'plus'} />
          {modeLabel}
        </span>
      </header>

      <div className="apqr-scheduler-form-body">
        <section className="apqr-scheduler-form-section" aria-labelledby="apqr-sched-product-heading">
          <h3 id="apqr-sched-product-heading" className="apqr-scheduler-section-heading">
            <ApqrIcon name="package" />
            Product details
          </h3>
          <div className="apqr-scheduler-form-grid apqr-scheduler-form-grid--product">
            <SchedulerFormField label="Client Name" htmlFor="apqr-sched-client-name" className="apqr-scheduler-field--wide">
              <input
                id="apqr-sched-client-name"
                className="apqr-form-readonly"
                value={clientName || form.client_name || ''}
                readOnly
                aria-readonly="true"
              />
            </SchedulerFormField>

            <SchedulerFormField label="Product Name" htmlFor="apqr-sched-product-name">
              <input
                id="apqr-sched-product-name"
                list={productListId}
                value={form.product_name}
                disabled={!editable}
                placeholder="Enter product name"
                onChange={(e) => onChange({ product_name: e.target.value })}
              />
              <datalist id={productListId}>
                {productSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </SchedulerFormField>

            <SchedulerFormField label="Product Code" htmlFor="apqr-sched-product-code">
              <input
                id="apqr-sched-product-code"
                value={form.product_code}
                disabled={!editable}
                placeholder="e.g. PRD-001"
                onChange={(e) => onChange({ product_code: e.target.value.toUpperCase() })}
              />
            </SchedulerFormField>

            <SchedulerFormField label="Product Status" htmlFor="apqr-sched-product-status">
              <select
                id="apqr-sched-product-status"
                value={form.product_status ?? 'Active'}
                disabled={!editable}
                onChange={(e) => onChange({ product_status: e.target.value as ScheduleRowDraft['product_status'] })}
              >
                {PRODUCT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </SchedulerFormField>
          </div>
        </section>

        <section className="apqr-scheduler-form-section" aria-labelledby="apqr-sched-coverage-heading">
          <h3 id="apqr-sched-coverage-heading" className="apqr-scheduler-section-heading">
            <ApqrIcon name="calendar" />
            Review coverage
          </h3>
          <div className="apqr-scheduler-form-grid apqr-scheduler-form-grid--coverage">
            <SchedulerFormField label="Review Coverage From" htmlFor="apqr-sched-coverage-start">
              <AppDateInput
                id="apqr-sched-coverage-start"
                value={form.review_coverage_start}
                disabled={!editable}
                required
                aria-required="true"
                onChange={(e) => handleCoverageStartChange(e.target.value)}
              />
            </SchedulerFormField>

            <SchedulerFormField label="Review Coverage To" htmlFor="apqr-sched-coverage-end">
              <AppDateInput
                id="apqr-sched-coverage-end"
                value={form.review_coverage_end}
                disabled={!editable}
                required
                aria-required="true"
                onChange={(e) => handleCoverageEndChange(e.target.value)}
              />
              {coverageNeedsReason && !form.review_coverage_adjustment_reason ? (
                <p className="form-error" role="alert">
                  Non-standard coverage requires an adjustment reason before save.
                </p>
              ) : null}
            </SchedulerFormField>
          </div>
        </section>

        <section
          className="apqr-scheduler-form-section apqr-scheduler-form-section--computed"
          aria-labelledby="apqr-sched-dates-heading"
        >
          <div className="apqr-scheduler-computed-header">
            <div className="apqr-scheduler-computed-header-text">
              <h3 id="apqr-sched-dates-heading" className="apqr-scheduler-section-heading">
                <ApqrIcon name="clock" />
                Calculated dates
              </h3>
              <p className="apqr-scheduler-section-lead help-text">
                {manualDates
                  ? 'Manual entry enabled. Set Commitment, Stability Pull-Out, and APQR Generation dates before submit.'
                  : 'Derived from review coverage. Dates stay blank until coverage end is set, then auto-calculate.'}
              </p>
            </div>
            <label className="apqr-scheduler-manual-toggle" htmlFor={manualDatesId}>
              <input
                id={manualDatesId}
                type="checkbox"
                checked={manualDates}
                disabled={!editable}
                onChange={(e) => handleManualDatesToggle(e.target.checked)}
              />
              Manual date entry
            </label>
          </div>
          <div className="apqr-scheduler-form-grid apqr-scheduler-form-grid--dates">
            <SchedulerFormField
              label="Commitment Date"
              htmlFor="apqr-sched-commitment"
              hint="90 calendar days from review coverage end."
              computed={!manualDates}
            >
              <AppDateInput
                id="apqr-sched-commitment"
                value={displayCommitment}
                disabled={!editable || !manualDates}
                readOnly={!manualDates}
                onChange={(e) => handleAutoFieldChange('commitment_schedule', e.target.value)}
              />
            </SchedulerFormField>

            <SchedulerFormField
              label="Stability Pull-Out Date"
              htmlFor="apqr-sched-stability"
              hint="60 calendar days before review coverage end."
              computed={!manualDates}
            >
              <AppDateInput
                id="apqr-sched-stability"
                value={displayStability}
                disabled={!editable || !manualDates}
                readOnly={!manualDates}
                onChange={(e) => handleAutoFieldChange('stability_pull_out_date', e.target.value)}
              />
              {stabConflict ? (
                <p className="form-error" role="alert">
                  Expected stability tabulation completion exceeds commitment date.
                </p>
              ) : null}
            </SchedulerFormField>

            <SchedulerFormField
              label="APQR Generation Report Date"
              htmlFor="apqr-sched-generation"
              hint="Auto-calculated from review coverage end."
              computed={!manualDates}
            >
              <AppDateInput
                id="apqr-sched-generation"
                value={displayGeneration}
                disabled={!editable || !manualDates}
                readOnly={!manualDates}
                onChange={(e) => handleAutoFieldChange('apqr_generation_date', e.target.value)}
              />
            </SchedulerFormField>
          </div>
        </section>

        <section className="apqr-scheduler-form-section" aria-labelledby="apqr-sched-status-heading">
          <h3 id="apqr-sched-status-heading" className="apqr-scheduler-section-heading">
            <ApqrIcon name="check" />
            Schedule status
          </h3>
          <div className="apqr-scheduler-form-grid apqr-scheduler-form-grid--status">
            <SchedulerFormField label="Schedule Status" htmlFor="apqr-sched-status">
              <select
                id="apqr-sched-status"
                value={form.commitment_schedule_status}
                disabled={!editable}
                onChange={(e) =>
                  onChange({
                    commitment_schedule_status: e.target.value as CommitmentScheduleStatus,
                    schedule_status_date: new Date().toISOString().slice(0, 10),
                  })
                }
              >
                {SCHEDULE_STATUS_UI.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </SchedulerFormField>

            <SchedulerFormField label="Schedule Status Date" htmlFor="apqr-sched-status-date">
              <input
                id="apqr-sched-status-date"
                className="apqr-form-readonly"
                value={formatAppDate(form.schedule_status_date ?? '', '—')}
                readOnly
                aria-readonly="true"
              />
            </SchedulerFormField>
          </div>
        </section>

        <fieldset className="apqr-scheduler-remarks-fieldset">
          <legend>
            <ApqrIcon name="document" />
            APQR Remarks
          </legend>
          <p className="apqr-scheduler-section-lead help-text">
            Optional notes for scheduling decisions, overrides, and follow-ups.
          </p>
          <div className="apqr-scheduler-remarks-list">
            {remarks.map((remark, index) => (
              <div key={`remark-${index}`} className="apqr-scheduler-remark-row">
                <label className="sr-only" htmlFor={`apqr-sched-remark-${index}`}>
                  APQR remark {index + 1}
                </label>
                <textarea
                  id={`apqr-sched-remark-${index}`}
                  rows={2}
                  value={remark}
                  disabled={!editable}
                  placeholder="Enter scheduling remark…"
                  onChange={(e) => updateRemark(index, e.target.value)}
                />
                {editable && remarks.length > 1 ? (
                  <button
                    type="button"
                    className="button secondary apqr-icon-btn"
                    aria-label={`Remove remark ${index + 1}`}
                    onClick={() => removeRemarkField(index)}
                  >
                    <ApqrIcon name="minus" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {editable ? (
            <button type="button" className="button secondary apqr-scheduler-add-remark" onClick={addRemarkField}>
              <ApqrIcon name="plus" />
              Add remark
            </button>
          ) : null}
        </fieldset>
      </div>

      {editable ? (
        <div className="form-actions apqr-scheduler-form-actions">
          <button type="button" className="button primary" disabled={busy} onClick={onSubmit}>
            <ApqrIcon name="check" />
            {busy ? 'Submitting…' : 'Submit'}
          </button>
          <button type="button" className="button secondary" disabled={busy} onClick={onClear}>
            <ApqrIcon name="clear" />
            Clear
          </button>
        </div>
      ) : null}
    </section>
  )
}

export function ApqrSchedulerViewDialog({
  row,
  clientName,
  open,
  onClose,
}: {
  row: ScheduleRowDraft | null
  clientName: string
  open: boolean
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && row) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open, row])

  if (!row) return null

  const statusLabel =
    SCHEDULE_STATUS_UI.find((item) => item.value === row.commitment_schedule_status)?.label ??
    row.commitment_schedule_status

  return (
    <dialog ref={dialogRef} className="apqr-scheduler-view-dialog" onClose={onClose}>
      <header className="apqr-scheduler-view-dialog-header">
        <h3>
          <ApqrIcon name="eye" />
          APQR Schedule — {row.product_name || 'Product'}
        </h3>
        <button type="button" className="apqr-banner-close" aria-label="Close schedule view" onClick={onClose}>
          <ApqrIcon name="close" />
        </button>
      </header>
      <dl className="apqr-scheduler-view-dialog-grid">
        <div><dt>Client</dt><dd>{clientName}</dd></div>
        <div><dt>APQR ID</dt><dd>{row.apqr_id ?? '—'}</dd></div>
        <div><dt>Product Name</dt><dd>{row.product_name}</dd></div>
        <div><dt>Product Code</dt><dd>{row.product_code}</dd></div>
        <div><dt>Product Status</dt><dd>{row.product_status ?? 'Active'}</dd></div>
        <div><dt>Review Coverage</dt><dd>{formatApqrDate(row.review_coverage_start)} to {formatApqrDate(row.review_coverage_end)}</dd></div>
        <div><dt>Stability Pull-Out</dt><dd>{formatApqrDate(row.stability_pull_out_date)}</dd></div>
        <div><dt>APQR Generation</dt><dd>{formatApqrDate(row.apqr_generation_date)}</dd></div>
        <div><dt>Commitment Date</dt><dd>{formatApqrDate(row.commitment_schedule)}</dd></div>
        <div><dt>Schedule Status</dt><dd>{statusLabel}</dd></div>
        <div><dt>Schedule Status Date</dt><dd>{formatApqrDate(row.schedule_status_date)}</dd></div>
        <div className="apqr-scheduler-view-remarks">
          <dt>APQR Remarks</dt>
          <dd>
            {(row.scheduler_remarks ?? []).filter(Boolean).length ? (
              <ul>
                {(row.scheduler_remarks ?? []).filter(Boolean).map((remark, index) => (
                  <li key={`view-remark-${index}`}>{remark}</li>
                ))}
              </ul>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>
    </dialog>
  )
}
