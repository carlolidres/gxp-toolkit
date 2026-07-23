import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button, Steps, Tooltip } from 'antd'
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Copy,
  FileDigit,
  FileText,
  Flag,
  Hash,
  Layers,
  ListOrdered,
  Send,
  ShieldCheck,
  Type,
  Upload,
  Users,
} from 'lucide-react'

import { EdocError, EdocPage } from '../../components/edoc/EdocComponents'
import { EdocFieldPlacementEditor } from '../../components/edoc/EdocFieldPlacementEditor'
import { EdocSignatoryRoutingBuilder } from '../../components/edoc/EdocSignatoryRoutingBuilder'
import { useToast } from '../../components/feedback/ToastProvider'
import { DateInput } from '../../components/forms/FormControls'
import { edocService } from '../../features/edoc/edocService'
import { hasPdfSignature, sha256Hex, validateEdocPdfFile } from '../../features/edoc/fileValidation'
import {
  SIGNATORY_LEVEL_ACTIONS,
  SIGNATORY_LEVEL_LABELS,
  ROUTING_MODE_INBOX_SUMMARY,
  compileSignatoryLevelsToRouteSteps,
  defaultSignatoryLevels,
  resolveCurrentUserProfileId,
  validateSignatoryRouting,
  type EdocSignatoryLevelDraft,
} from '../../features/edoc/signatoryLevels'
import { useEdocProfiles } from '../../features/edoc/useEdocData'
import type {
  EdocCreateDraftInput,
  EdocFieldDraft,
  EdocPriority,
  EdocRoutingMode,
} from '../../features/edoc/types'
import { useAuth } from '../../hooks/useAuth'
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

export function EdocCreateDocumentPage() {
  const profiles = useEdocProfiles()
  const { user } = useAuth()
  const { notify } = useToast()
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
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [routingMode, setRoutingMode] = useState<EdocRoutingMode>('sequential')
  const [noSignatories, setNoSignatories] = useState(false)
  const [levels, setLevels] = useState<EdocSignatoryLevelDraft[]>([])
  const [levelErrors, setLevelErrors] = useState<Partial<Record<EdocSignatoryLevelDraft['kind'], string>>>({})
  const [fields, setFields] = useState<EdocFieldDraft[]>([])
  const [seededCurrentUser, setSeededCurrentUser] = useState(false)

  const currentUserProfileId = useMemo(
    () => resolveCurrentUserProfileId(profiles.data ?? [], user),
    [profiles.data, user],
  )

  useEffect(() => {
    if (seededCurrentUser || noSignatories) return
    if (!profiles.data) return
    setLevels(defaultSignatoryLevels(currentUserProfileId))
    setSeededCurrentUser(true)
  }, [currentUserProfileId, noSignatories, profiles.data, seededCurrentUser])

  useEffect(() => {
    if (!currentUserProfileId || noSignatories) return
    setLevels((current) => {
      if (current.length === 0) return current
      return current.map((level) => {
        if (level.kind !== 'prepared_by') return level
        if (level.assigneeIds.includes(currentUserProfileId)) return level
        return { ...level, assigneeIds: [currentUserProfileId, ...level.assigneeIds] }
      })
    })
  }, [currentUserProfileId, noSignatories])

  const allAssigneeDrafts = useMemo(
    () =>
      noSignatories
        ? []
        : levels.flatMap((level) =>
            level.assigneeIds.map((assigneeId) => ({
              id: `${level.id}:${assigneeId}`,
              level,
              assigneeId,
              action: SIGNATORY_LEVEL_ACTIONS[level.kind],
              label: `${SIGNATORY_LEVEL_LABELS[level.kind]} — ${
                profiles.data?.find((profile) => profile.id === assigneeId)?.displayName ?? assigneeId
              }`,
            })),
          ),
    [levels, noSignatories, profiles.data],
  )

  const missingFieldLabels = allAssigneeDrafts
    .filter((assignee) => !fields.some((field) => field.assigneeDraftId === assignee.id))
    .map((assignee) => assignee.label)

  const compiledRoute = useMemo(
    () =>
      compileSignatoryLevelsToRouteSteps({
        mode: routingMode,
        levels,
        noSignatories,
      }),
    [levels, noSignatories, routingMode],
  )

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
    setPdfBytes(null)
    setSelectedFileName('')
    setFields([])
    if (!fileInput) return

    const validation = validateEdocPdfFile(fileInput)
    if (!validation.ok) return setError(validation.message)

    if (!(await hasPdfSignature(fileInput))) {
      return setError('The selected file does not have a valid PDF file signature.')
    }

    setSelectedFileName(fileInput.name)
    setPdfBytes(await fileInput.arrayBuffer())
    setFile({
      name: fileInput.name,
      sizeBytes: fileInput.size,
      mimeType: fileInput.type || 'application/pdf',
      sha256: await sha256Hex(fileInput),
    })
  }

  function continueFromRouting() {
    setError(null)
    const validation = validateSignatoryRouting({ noSignatories, levels })
    setLevelErrors(validation.levelErrors)
    if (!validation.ok) {
      setError(validation.message)
      return
    }
    const validAssigneeIds = new Set(allAssigneeDrafts.map((assignee) => assignee.id))
    setFields((current) => current.filter((field) => validAssigneeIds.has(field.assigneeDraftId)))
    setActiveStep(3)
  }

  function handleLevelsChange(nextLevels: EdocSignatoryLevelDraft[]) {
    setLevels(nextLevels)
    setLevelErrors({})
  }

  function handleNoSignatoriesChange(value: boolean) {
    setNoSignatories(value)
    setLevelErrors({})
    setError(null)
    if (value) {
      setFields([])
      return
    }
    if (levels.length === 0) {
      setLevels(defaultSignatoryLevels(currentUserProfileId))
    }
  }

  async function sendDocument() {
    setError(null)
    if (!file) return setError('Upload and validate a PDF before sending.')

    const validation = validateSignatoryRouting({ noSignatories, levels })
    setLevelErrors(validation.levelErrors)
    if (!validation.ok) return setError(validation.message)

    if (!noSignatories && missingFieldLabels.length > 0) {
      return setError(`Place required fields for: ${missingFieldLabels.join(', ')}.`)
    }

    const routing = compileSignatoryLevelsToRouteSteps({
      mode: routingMode,
      levels,
      noSignatories,
    })

    setSubmitting(true)
    try {
      setCreated(await edocService.createAndSendDraft({
        metadata,
        file,
        routing,
        fields: noSignatories ? [] : fields,
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
                  {noSignatories
                    ? 'The document was created without a signatory route.'
                    : 'The route was started. Signatories will see it in My Inbox only when their turn is active for the selected routing mode.'}
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
                <div
                  role="status"
                  aria-live="polite"
                  className="md:col-span-2 rounded-xl border border-[color-mix(in_srgb,var(--teal)_32%,var(--border))] bg-[color-mix(in_srgb,var(--teal)_8%,var(--surface))] px-4 py-4 sm:px-5"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--teal)_16%,var(--surface))] text-[var(--teal)]">
                      <ShieldCheck size={iconSize.lg} strokeWidth={iconStroke} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--teal)]">
                          Validated PDF
                        </p>
                        <p className="mt-1 mb-0 text-sm text-[var(--muted)]">
                          File passed type and signature checks and is ready for routing.
                        </p>
                      </div>

                      <dl className="m-0 grid gap-2.5 sm:grid-cols-2">
                        <div className="min-w-0 rounded-lg bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] px-3 py-2.5">
                          <dt className="m-0 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                            <FileText size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                            Filename
                          </dt>
                          <dd className="mt-1 mb-0 truncate text-sm font-medium text-[var(--navy)]" title={selectedFileName}>
                            {selectedFileName}
                          </dd>
                        </div>

                        <div className="min-w-0 rounded-lg bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] px-3 py-2.5">
                          <dt className="m-0 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                            <Hash size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                            SHA-256
                          </dt>
                          <dd className="mt-1 mb-0 flex items-center gap-1.5">
                            <code
                              className="min-w-0 flex-1 truncate font-mono text-[0.8rem] font-medium text-[var(--navy)]"
                              title={file.sha256}
                            >
                              {file.sha256.slice(0, 16)}…
                            </code>
                            <Tooltip title="Copy full SHA-256 hash">
                              <Button
                                type="text"
                                size="small"
                                className="shrink-0"
                                aria-label="Copy full SHA-256 hash"
                                icon={<Copy size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}
                                onClick={() => {
                                  void navigator.clipboard.writeText(file.sha256).then(
                                    () => notify('SHA-256 hash copied to clipboard.', 'success'),
                                    () => notify('Could not copy hash to clipboard.', 'error'),
                                  )
                                }}
                              />
                            </Tooltip>
                          </dd>
                        </div>
                      </dl>
                    </div>
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
            <EdocSignatoryRoutingBuilder
              mode={routingMode}
              levels={levels}
              noSignatories={noSignatories}
              profiles={profiles.data ?? []}
              profilesLoading={profiles.loading}
              profilesError={profiles.error}
              currentUserProfileId={currentUserProfileId}
              levelErrors={levelErrors}
              onModeChange={setRoutingMode}
              onLevelsChange={handleLevelsChange}
              onNoSignatoriesChange={handleNoSignatoriesChange}
            />

            <WizardActions>
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
                onClick={continueFromRouting}
              >
                Continue
              </Button>
            </WizardActions>
          </div>
        ) : null}

        {!created && activeStep === 3 ? (
          <div className="space-y-5">
            <EdocFieldPlacementEditor
              pdfBytes={pdfBytes}
              fields={fields}
              signatories={allAssigneeDrafts.map((assignee) => ({
                id: assignee.id,
                label: assignee.label,
                action: assignee.action,
                displayName:
                  profiles.data?.find((profile) => profile.id === assignee.assigneeId)?.displayName
                  ?? assignee.label,
              }))}
              emptyMessage={
                noSignatories
                  ? 'No signatories required — field placement is skipped for this document.'
                  : undefined
              }
              onChange={setFields}
            />

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
                {
                  label: 'Route',
                  value: noSignatories
                    ? 'No signatories'
                    : `${compiledRoute.steps.length} step${compiledRoute.steps.length === 1 ? '' : 's'} · ${routingMode}`,
                  icon: ListOrdered,
                },
                { label: 'Assignees', value: noSignatories ? 'None' : String(allAssigneeDrafts.length), icon: Users },
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

            <section
              className="rounded-xl border border-[color-mix(in_srgb,var(--teal)_30%,var(--border))] bg-[color-mix(in_srgb,var(--teal)_6%,var(--surface))] p-4 sm:p-5"
              aria-label="Inbox routing behavior"
            >
              <h2 className="m-0 text-sm font-semibold text-[var(--navy)]">Inbox routing after send</h2>
              {noSignatories ? (
                <p className="mt-2 mb-0 text-sm leading-relaxed text-[var(--muted)]">
                  No signatories are required. The document completes without appearing in signatory inboxes.
                </p>
              ) : (
                <div className="mt-2 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
                  <p className="m-0 font-medium text-[var(--navy)]">{ROUTING_MODE_INBOX_SUMMARY[routingMode]}</p>
                  <ul className="m-0 list-disc space-y-1 pl-5">
                    <li>
                      <strong className="font-semibold text-[var(--navy)]">Sequential:</strong> one signatory at a time in sequence; forwarded only after the current signatory completes.
                    </li>
                    <li>
                      <strong className="font-semibold text-[var(--navy)]">Parallel:</strong> same-level signatories may sign together; next level waits until the current level finishes.
                    </li>
                    <li>
                      <strong className="font-semibold text-[var(--navy)]">Mixed:</strong> all designated signatories may sign at any time, regardless of level.
                    </li>
                  </ul>
                  <p className="m-0">
                    The document appears in a user’s inbox only when it is available for that user to act.
                  </p>
                </div>
              )}
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
