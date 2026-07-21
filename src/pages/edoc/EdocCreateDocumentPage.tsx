import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button, Steps } from 'antd'
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileDigit,
  FileText,
  Flag,
  GitBranch,
  Hash,
  Layers,
  ListOrdered,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Type,
  Upload,
  Users,
} from 'lucide-react'

import { EdocError, EdocPage } from '../../components/edoc/EdocComponents'
import { DateInput } from '../../components/forms/FormControls'
import { edocFieldTypeLabels, fieldTypesForAction } from '../../features/edoc/fieldRules'
import { edocService } from '../../features/edoc/edocService'
import { hasPdfSignature, sha256Hex, validateEdocPdfFile } from '../../features/edoc/fileValidation'
import { useEdocProfiles } from '../../features/edoc/useEdocData'
import type {
  EdocAssignableAction,
  EdocCreateDraftInput,
  EdocFieldDraft,
  EdocFieldType,
  EdocPriority,
  EdocRouteStepDraft,
  EdocRoutingMode,
} from '../../features/edoc/types'
import { iconSize, iconStroke } from '../../theme/iconSizes'
import {
  VMP_FIELD_CLASS,
  VMP_FIELD_WIDE_CLASS,
  VMP_FORM_GRID_CLASS,
  VMP_INPUT_CLASS,
  VMP_SECTION_CARD_CLASS,
} from '../vmp/vmp-form-shared'

function WizardField({
  label,
  htmlFor,
  icon,
  wide,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  icon: ReactNode
  wide?: boolean
  hint?: string
  children: ReactNode
}) {
  const Tag = htmlFor ? 'label' : 'div'
  return (
    <Tag className={wide ? VMP_FIELD_WIDE_CLASS : VMP_FIELD_CLASS} {...(htmlFor ? { htmlFor } : {})}>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {icon}
        {label}
      </span>
      {children}
      {hint ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}
    </Tag>
  )
}

function WizardActions({
  left,
  children,
}: {
  left?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4 ${
        left ? 'justify-between' : 'justify-end'
      }`}
    >
      {left ? <div className="flex flex-wrap items-center gap-3">{left}</div> : null}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3">{children}</div>
    </div>
  )
}

const wizardSteps = ['Metadata', 'PDF upload', 'Routing setup', 'Field placement', 'Review and send']
const assignableActions: EdocAssignableAction[] = ['review', 'approve', 'sign', 'acknowledge']

function newStep(sequence: number): EdocRouteStepDraft {
  return {
    id: crypto.randomUUID(),
    groupId: `group-${sequence}`,
    sequence,
    action: 'review',
    assigneeIds: [],
    completionRule: 'all',
    minimumCount: null,
    dueAt: '',
    allowDelegation: false,
  }
}

export function EdocCreateDocumentPage() {
  const profiles = useEdocProfiles()
  const [activeStep, setActiveStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ documentId: string; routeId: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [metadata, setMetadata] = useState<EdocCreateDraftInput['metadata']>({
    documentNumber: '',
    title: '',
    description: '',
    documentType: '',
    category: '',
    department: '',
    businessUnit: '',
    confidentiality: 'internal',
    priority: 'normal',
    dueAt: '',
    tags: [],
    retentionClass: '',
  })
  const [file, setFile] = useState<EdocCreateDraftInput['file']>(null)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [routingMode, setRoutingMode] = useState<EdocRoutingMode>('sequential')
  const [steps, setSteps] = useState<EdocRouteStepDraft[]>([newStep(1)])
  const [fields, setFields] = useState<EdocFieldDraft[]>([])

  const allAssigneeDrafts = useMemo(
    () =>
      steps.flatMap((step) =>
        step.assigneeIds.map((assigneeId) => ({
          id: `${step.id}:${assigneeId}`,
          step,
          assigneeId,
          label: `${step.sequence}. ${step.action} - ${profiles.data?.find((profile) => profile.id === assigneeId)?.displayName ?? assigneeId}`,
        })),
      ),
    [profiles.data, steps],
  )

  const missingFieldLabels = allAssigneeDrafts
    .filter((assignee) => !fields.some((field) => field.assigneeDraftId === assignee.id))
    .map((assignee) => assignee.label)

  function updateMetadata(key: keyof EdocCreateDraftInput['metadata'], value: string) {
    setMetadata((current) => ({ ...current, [key]: value }))
  }

  function continueFromMetadata(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!metadata.documentNumber.trim()) return setError('Document number is required.')
    if (!metadata.title.trim()) return setError('Title is required.')
    setActiveStep(1)
  }

  async function handlePdfSelected(fileInput: File | null) {
    setError(null)
    setFile(null)
    setSelectedFileName('')
    if (!fileInput) return

    const validation = validateEdocPdfFile(fileInput)
    if (!validation.ok) return setError(validation.message)

    if (!(await hasPdfSignature(fileInput))) {
      return setError('The selected file does not have a valid PDF file signature.')
    }

    setSelectedFileName(fileInput.name)
    setFile({
      name: fileInput.name,
      sizeBytes: fileInput.size,
      mimeType: fileInput.type || 'application/pdf',
      sha256: await sha256Hex(fileInput),
    })
  }

  function updateRouteStep(stepId: string, patch: Partial<EdocRouteStepDraft>) {
    setSteps((current) => current.map((step) => (step.id === stepId ? { ...step, ...patch } : step)))
  }

  function addRouteStep() {
    setSteps((current) => [...current, newStep(current.length + 1)])
  }

  function removeRouteStep(stepId: string) {
    setSteps((current) => current.filter((step) => step.id !== stepId).map((step, index) => ({ ...step, sequence: index + 1 })))
    setFields((current) => current.filter((field) => !field.assigneeDraftId.startsWith(`${stepId}:`)))
  }

  function addField(assigneeDraftId: string, fieldType: EdocFieldType) {
    setFields((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        assigneeDraftId,
        fieldType,
        pageNumber: 1,
        x: 0.12 + (current.length % 3) * 0.22,
        y: 0.64 + (current.length % 2) * 0.12,
        width: 0.2,
        height: 0.08,
        required: true,
      },
    ])
  }

  async function sendDocument() {
    setError(null)
    if (!file) return setError('Upload and validate a PDF before sending.')
    if (steps.some((step) => step.assigneeIds.length === 0)) return setError('Every routing step requires at least one assignee.')
    if (missingFieldLabels.length > 0) return setError(`Place required fields for: ${missingFieldLabels.join(', ')}.`)

    setSubmitting(true)
    try {
      setCreated(await edocService.createAndSendDraft({
        metadata,
        file,
        routing: { mode: routingMode, steps },
        fields,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the eDoc route.')
    } finally {
      setSubmitting(false)
    }
  }

  const tealIcon = (Icon: typeof FileDigit) => (
    <Icon size={iconSize.xs} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />
  )

  return (
    <EdocPage title="Create Document" description="Prepare metadata, upload a private PDF, configure routing, place fields, and send.">
      <section className={`${VMP_SECTION_CARD_CLASS} p-5 sm:p-6`}>
        <Steps
          className="edoc-stepper"
          current={activeStep}
          items={wizardSteps.map((label) => ({ title: label }))}
          style={{ marginBottom: 20 }}
        />
        {error ? <div className="mb-4"><EdocError message={error} /></div> : null}

        {created ? (
          <div className="edoc-success space-y-4 rounded-xl border border-[color-mix(in_srgb,var(--teal)_35%,var(--border))] bg-[color-mix(in_srgb,var(--teal)_8%,var(--surface))] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={iconSize.lg} strokeWidth={iconStroke} className="mt-0.5 shrink-0 text-[var(--teal)]" aria-hidden />
              <div>
                <h2 className="m-0 text-lg font-semibold text-[var(--navy)]">Route sent</h2>
                <p className="mt-1 mb-0 text-sm text-[var(--muted)]">
                  The eDoc route was created and the first eligible assignment group was activated.
                </p>
              </div>
            </div>
            <WizardActions>
              <Link to="/edoc/inbox"><Button icon={<ListOrdered size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}>Open Inbox</Button></Link>
              <Link to="/edoc/documents">
                <Button type="primary" icon={<FileText size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}>
                  View Documents
                </Button>
              </Link>
            </WizardActions>
          </div>
        ) : null}

        {!created && activeStep === 0 ? (
          <form className="space-y-5" onSubmit={continueFromMetadata} noValidate>
            <div className={`${VMP_FORM_GRID_CLASS} !px-0 !py-0`}>
              <WizardField
                label="Document number"
                htmlFor="edoc-document-number"
                icon={tealIcon(FileDigit)}
              >
                <input
                  id="edoc-document-number"
                  className={VMP_INPUT_CLASS}
                  value={metadata.documentNumber}
                  onChange={(event) => updateMetadata('documentNumber', event.target.value)}
                  required
                  autoComplete="off"
                  placeholder="e.g. EDOC-2026-001"
                />
              </WizardField>

              <WizardField
                label="Title"
                htmlFor="edoc-title"
                icon={tealIcon(Type)}
              >
                <input
                  id="edoc-title"
                  className={VMP_INPUT_CLASS}
                  value={metadata.title}
                  onChange={(event) => updateMetadata('title', event.target.value)}
                  required
                  autoComplete="off"
                  placeholder="Document title"
                />
              </WizardField>

              <WizardField
                label="Priority"
                htmlFor="edoc-priority"
                icon={tealIcon(Flag)}
              >
                <select
                  id="edoc-priority"
                  className={VMP_INPUT_CLASS}
                  value={metadata.priority}
                  onChange={(event) => updateMetadata('priority', event.target.value as EdocPriority)}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </WizardField>

              <WizardField
                label="Due date"
                htmlFor="edoc-due-at"
                icon={tealIcon(CalendarDays)}
              >
                <DateInput
                  id="edoc-due-at"
                  value={metadata.dueAt}
                  onChange={(event) => updateMetadata('dueAt', event.target.value)}
                />
              </WizardField>

              <WizardField
                label="Description"
                htmlFor="edoc-description"
                wide
                icon={tealIcon(AlignLeft)}
              >
                <textarea
                  id="edoc-description"
                  className={`${VMP_INPUT_CLASS} min-h-[112px] resize-y leading-relaxed`}
                  value={metadata.description}
                  onChange={(event) => updateMetadata('description', event.target.value)}
                  rows={4}
                  placeholder="Brief summary of the document purpose or scope"
                />
              </WizardField>
            </div>

            <WizardActions>
              <Button
                type="primary"
                htmlType="submit"
                icon={<ArrowRight size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                iconPlacement="end"
              >
                Continue
              </Button>
            </WizardActions>
          </form>
        ) : null}

        {!created && activeStep === 1 ? (
          <div className="space-y-5">
            <div className={`${VMP_FORM_GRID_CLASS} !px-0 !py-0`}>
              <WizardField
                label="PDF file"
                wide
                icon={tealIcon(Upload)}
                hint="Private PDF only. The file is validated for type and PDF signature before routing."
              >
                <label
                  htmlFor="edoc-pdf-file"
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-8 text-center transition-[border-color,background-color] hover:border-[color-mix(in_srgb,var(--teal)_45%,var(--border))] hover:bg-[color-mix(in_srgb,var(--teal)_6%,var(--surface))] focus-within:border-[var(--teal)] focus-within:ring-2 focus-within:ring-[var(--glow-ring)]"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--teal)_14%,var(--surface))] text-[var(--teal)]">
                    <Upload size={iconSize.md} strokeWidth={iconStroke} aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-[var(--navy)]">
                    {selectedFileName || 'Choose a PDF to upload'}
                  </span>
                  <span className="text-xs text-[var(--muted)]">Click to browse · PDF only</span>
                  <input
                    id="edoc-pdf-file"
                    className="sr-only"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => void handlePdfSelected(event.target.files?.[0] ?? null)}
                  />
                </label>
              </WizardField>

              {file ? (
                <div className="md:col-span-2 flex flex-wrap items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--teal)_35%,var(--border))] bg-[color-mix(in_srgb,var(--teal)_8%,var(--surface))] px-4 py-3">
                  <ShieldCheck size={iconSize.md} strokeWidth={iconStroke} className="mt-0.5 shrink-0 text-[var(--teal)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-sm font-semibold text-[var(--navy)]">Validated PDF</p>
                    <p className="mt-1 mb-0 break-all text-xs text-[var(--muted)]">
                      {selectedFileName}
                      <span className="mx-1.5 text-[var(--border)]" aria-hidden>·</span>
                      SHA-256 {file.sha256.slice(0, 16)}…
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <WizardActions>
              <Button
                icon={<ArrowLeft size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                onClick={() => setActiveStep(0)}
              >
                Back
              </Button>
              <Button
                type="primary"
                disabled={!file}
                icon={<ArrowRight size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                iconPlacement="end"
                onClick={() => setActiveStep(2)}
              >
                Continue
              </Button>
            </WizardActions>
          </div>
        ) : null}

        {!created && activeStep === 2 ? (
          <div className="space-y-5">
            <div className={`${VMP_FORM_GRID_CLASS} !px-0 !py-0`}>
              <WizardField
                label="Routing mode"
                htmlFor="edoc-routing-mode"
                icon={tealIcon(GitBranch)}
              >
                <select
                  id="edoc-routing-mode"
                  className={VMP_INPUT_CLASS}
                  value={routingMode}
                  onChange={(event) => setRoutingMode(event.target.value as EdocRoutingMode)}
                >
                  <option value="sequential">Sequential</option>
                  <option value="parallel">Parallel</option>
                  <option value="mixed">Mixed</option>
                </select>
              </WizardField>
            </div>

            {profiles.error ? <EdocError message={profiles.error} /> : null}

            <div className="space-y-4">
              {steps.map((step) => (
                <div
                  className="edoc-route-step rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:p-5"
                  key={step.id}
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 inline-flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">
                      <ListOrdered size={iconSize.sm} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />
                      Step {step.sequence}
                    </p>
                    {steps.length > 1 ? (
                      <Button
                        danger
                        size="small"
                        icon={<Trash2 size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}
                        onClick={() => removeRouteStep(step.id)}
                      >
                        Remove step
                      </Button>
                    ) : null}
                  </div>

                  <div className={`${VMP_FORM_GRID_CLASS} !px-0 !py-0`}>
                    <WizardField
                      label="Action"
                      htmlFor={`edoc-step-action-${step.id}`}
                      icon={tealIcon(Flag)}
                    >
                      <select
                        id={`edoc-step-action-${step.id}`}
                        className={VMP_INPUT_CLASS}
                        value={step.action}
                        onChange={(event) => updateRouteStep(step.id, { action: event.target.value as EdocAssignableAction })}
                      >
                        {assignableActions.map((action) => (
                          <option value={action} key={action}>{action}</option>
                        ))}
                      </select>
                    </WizardField>

                    <WizardField
                      label="Assignees"
                      htmlFor={`edoc-step-assignees-${step.id}`}
                      icon={tealIcon(Users)}
                      hint="Hold Ctrl or Cmd to select multiple assignees."
                    >
                      <select
                        id={`edoc-step-assignees-${step.id}`}
                        className={`${VMP_INPUT_CLASS} min-h-[112px]`}
                        multiple
                        value={step.assigneeIds}
                        onChange={(event) => updateRouteStep(step.id, { assigneeIds: [...event.currentTarget.selectedOptions].map((option) => option.value) })}
                      >
                        {(profiles.data ?? []).map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.displayName} ({profile.email})
                          </option>
                        ))}
                      </select>
                    </WizardField>

                    <WizardField
                      label="Completion rule"
                      htmlFor={`edoc-step-completion-${step.id}`}
                      icon={tealIcon(Layers)}
                    >
                      <select
                        id={`edoc-step-completion-${step.id}`}
                        className={VMP_INPUT_CLASS}
                        value={step.completionRule}
                        onChange={(event) => updateRouteStep(step.id, { completionRule: event.target.value as EdocRouteStepDraft['completionRule'] })}
                      >
                        <option value="all">All</option>
                        <option value="any">Any</option>
                        <option value="majority">Majority</option>
                        <option value="minimum_count">Minimum count</option>
                      </select>
                    </WizardField>

                    <WizardField
                      label="Minimum count"
                      htmlFor={`edoc-step-minimum-${step.id}`}
                      icon={tealIcon(Hash)}
                    >
                      <input
                        id={`edoc-step-minimum-${step.id}`}
                        className={VMP_INPUT_CLASS}
                        type="number"
                        min={1}
                        value={step.minimumCount ?? ''}
                        onChange={(event) => updateRouteStep(step.id, { minimumCount: event.target.value ? Number(event.target.value) : null })}
                      />
                    </WizardField>

                    <WizardField
                      label="Due date"
                      htmlFor={`edoc-step-due-${step.id}`}
                      icon={tealIcon(CalendarDays)}
                    >
                      <DateInput
                        id={`edoc-step-due-${step.id}`}
                        value={step.dueAt}
                        onChange={(event) => updateRouteStep(step.id, { dueAt: event.target.value })}
                      />
                    </WizardField>

                    <label className={`${VMP_FIELD_CLASS} justify-center`} htmlFor={`edoc-step-delegation-${step.id}`}>
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--app-text)]">
                        <input
                          id={`edoc-step-delegation-${step.id}`}
                          className="h-4 w-4 accent-[var(--teal)]"
                          type="checkbox"
                          checked={step.allowDelegation}
                          onChange={(event) => updateRouteStep(step.id, { allowDelegation: event.target.checked })}
                        />
                        Allow delegation
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <WizardActions
              left={
                <Button
                  icon={<Plus size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                  onClick={addRouteStep}
                >
                  Add step
                </Button>
              }
            >
              <Button
                icon={<ArrowLeft size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                onClick={() => setActiveStep(1)}
              >
                Back
              </Button>
              <Button
                type="primary"
                icon={<ArrowRight size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                iconPlacement="end"
                onClick={() => setActiveStep(3)}
              >
                Continue
              </Button>
            </WizardActions>
          </div>
        ) : null}

        {!created && activeStep === 3 ? (
          <div className="space-y-5">
            <div className="edoc-placement-grid">
              <div
                className="edoc-pdf-surface rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 sm:p-5"
                aria-label="PDF field placement preview"
              >
                <div className="edoc-pdf-page">
                  <span className="document-mark">PDF PAGE 1</span>
                  <h2>{metadata.title || 'Untitled document'}</h2>
                  <p>{metadata.documentNumber}</p>
                  {fields.map((field) => (
                    <button
                      type="button"
                      key={field.id}
                      className="edoc-field-box"
                      title="Click to remove field"
                      aria-label={`Remove ${edocFieldTypeLabels[field.fieldType]} field`}
                      style={{
                        left: `${field.x * 100}%`,
                        top: `${field.y * 100}%`,
                        width: `${field.width * 100}%`,
                        height: `${field.height * 100}%`,
                      }}
                      onClick={() => setFields((current) => current.filter((candidate) => candidate.id !== field.id))}
                    >
                      {edocFieldTypeLabels[field.fieldType]}
                    </button>
                  ))}
                </div>
              </div>

              <aside className="edoc-field-panel rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-[var(--shadow)]">
                <h2 className="m-0 flex items-center gap-2 text-base font-semibold text-[var(--navy)]">
                  <Layers size={iconSize.sm} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />
                  Required fields
                </h2>
                {allAssigneeDrafts.length === 0 ? (
                  <p className="m-0 text-sm text-[var(--muted)]">
                    Add assignees in the routing step before placing fields.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {allAssigneeDrafts.map((assignee) => {
                      const allowedFields = fieldTypesForAction(assignee.step.action)
                      return (
                        <div key={assignee.id} className="edoc-field-row rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                          <strong className="text-sm text-[var(--navy)]">{assignee.label}</strong>
                          <select
                            className={VMP_INPUT_CLASS}
                            aria-label={`Add field for ${assignee.label}`}
                            onChange={(event) => {
                              addField(assignee.id, event.target.value as EdocFieldType)
                              event.currentTarget.value = ''
                            }}
                            defaultValue=""
                          >
                            <option value="" disabled>Add field</option>
                            {allowedFields.map((fieldType) => (
                              <option key={fieldType} value={fieldType}>{edocFieldTypeLabels[fieldType]}</option>
                            ))}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                )}
                <p className="m-0 text-xs leading-relaxed text-[var(--muted)]">
                  Click a placed field to remove it. Coordinates are stored as normalized page values.
                </p>
              </aside>
            </div>

            <WizardActions>
              <Button
                icon={<ArrowLeft size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                onClick={() => setActiveStep(2)}
              >
                Back
              </Button>
              <Button
                type="primary"
                icon={<ArrowRight size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                iconPlacement="end"
                onClick={() => setActiveStep(4)}
              >
                Continue
              </Button>
            </WizardActions>
          </div>
        ) : null}

        {!created && activeStep === 4 ? (
          <div className="space-y-5">
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Document review summary">
              {[
                { label: 'Document', value: metadata.documentNumber || '—', icon: FileDigit },
                { label: 'Title', value: metadata.title || '—', icon: Type },
                { label: 'Version', value: 'v1', icon: Hash },
                { label: 'Route steps', value: String(steps.length), icon: ListOrdered },
                { label: 'Assignees', value: String(allAssigneeDrafts.length), icon: Users },
                { label: 'Fields', value: String(fields.length), icon: Layers },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-[var(--stat-cell-border)] bg-[var(--stat-cell-bg)] px-4 py-3"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <item.icon size={iconSize.xs} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />
                    {item.label}
                  </span>
                  <strong className="mt-1.5 block break-words text-sm font-semibold text-[var(--navy)]">{item.value}</strong>
                </div>
              ))}
            </section>

            <WizardActions>
              <Button
                icon={<ArrowLeft size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                disabled={submitting}
                onClick={() => setActiveStep(3)}
              >
                Back
              </Button>
              <Button
                type="primary"
                loading={submitting}
                disabled={submitting}
                icon={<Send size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                iconPlacement="end"
                onClick={() => void sendDocument()}
              >
                {submitting ? 'Sending…' : 'Send document'}
              </Button>
            </WizardActions>
          </div>
        ) : null}
      </section>
    </EdocPage>
  )
}
