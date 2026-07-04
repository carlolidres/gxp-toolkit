import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { EdocError, EdocPage } from '../../components/edoc/EdocComponents'
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
  const [tagDraft, setTagDraft] = useState('')
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
    if (!metadata.department.trim()) return setError('Department is required.')
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

  function addTag() {
    const tag = tagDraft.trim()
    if (!tag) return
    setMetadata((current) => ({ ...current, tags: [...new Set([...current.tags, tag])] }))
    setTagDraft('')
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

  return (
    <EdocPage title="Create Document" description="Prepare metadata, upload a private PDF, configure routing, place fields, and send.">
      <section className="panel">
        <div className="stepper edoc-stepper">
          {wizardSteps.map((label, index) => (
            <div key={label} className={index < activeStep ? 'step approved' : index === activeStep ? 'step in-progress' : 'step'}>
              <span className="step-marker">{index + 1}</span>
              <div>
                <strong>{label}</strong>
                <small>{index < activeStep ? 'Complete' : index === activeStep ? 'Current' : 'Pending'}</small>
              </div>
            </div>
          ))}
        </div>
        {error ? <EdocError message={error} /> : null}

        {created ? (
          <div className="edoc-success">
            <h2>Route sent</h2>
            <p>The eDoc route was created and the first eligible assignment group was activated.</p>
            <div className="button-row">
              <Link className="button" to="/edoc/inbox">Open Inbox</Link>
              <Link className="button primary" to="/edoc/documents">View Documents</Link>
            </div>
          </div>
        ) : null}

        {!created && activeStep === 0 ? (
          <form className="form-grid" onSubmit={continueFromMetadata}>
            <label>Document number<input value={metadata.documentNumber} onChange={(event) => updateMetadata('documentNumber', event.target.value)} required /></label>
            <label>Title<input value={metadata.title} onChange={(event) => updateMetadata('title', event.target.value)} required /></label>
            <label>Document type<input value={metadata.documentType} onChange={(event) => updateMetadata('documentType', event.target.value)} /></label>
            <label>Category<input value={metadata.category} onChange={(event) => updateMetadata('category', event.target.value)} /></label>
            <label>Department<input value={metadata.department} onChange={(event) => updateMetadata('department', event.target.value)} required /></label>
            <label>Business unit<input value={metadata.businessUnit} onChange={(event) => updateMetadata('businessUnit', event.target.value)} /></label>
            <label>Access classification<input value={metadata.confidentiality} onChange={(event) => updateMetadata('confidentiality', event.target.value)} /></label>
            <label>Priority<select value={metadata.priority} onChange={(event) => updateMetadata('priority', event.target.value as EdocPriority)}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select></label>
            <label>Due date<input type="date" value={metadata.dueAt} onChange={(event) => updateMetadata('dueAt', event.target.value)} /></label>
            <label>Retention class<input value={metadata.retentionClass} onChange={(event) => updateMetadata('retentionClass', event.target.value)} /></label>
            <label className="span-2">Description<textarea value={metadata.description} onChange={(event) => updateMetadata('description', event.target.value)} /></label>
            <div className="span-2 edoc-tag-row">
              <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="Add tag" />
              <button className="button" type="button" onClick={addTag}>Add tag</button>
              <span>{metadata.tags.join(', ')}</span>
            </div>
            <div className="button-row span-2"><button className="button primary" type="submit">Continue</button></div>
          </form>
        ) : null}

        {!created && activeStep === 1 ? (
          <div className="form-grid">
            <label className="span-2">PDF file<input type="file" accept="application/pdf,.pdf" onChange={(event) => void handlePdfSelected(event.target.files?.[0] ?? null)} /></label>
            {file ? <p className="span-2">Validated: {selectedFileName} · SHA-256 {file.sha256.slice(0, 16)}...</p> : null}
            <div className="button-row span-2">
              <button className="button" type="button" onClick={() => setActiveStep(0)}>Back</button>
              <button className="button primary" type="button" disabled={!file} onClick={() => setActiveStep(2)}>Continue</button>
            </div>
          </div>
        ) : null}

        {!created && activeStep === 2 ? (
          <div className="form-grid">
            <label>Routing mode<select value={routingMode} onChange={(event) => setRoutingMode(event.target.value as EdocRoutingMode)}>
              <option value="sequential">Sequential</option><option value="parallel">Parallel</option><option value="mixed">Mixed</option>
            </select></label>
            {profiles.error ? <EdocError message={profiles.error} /> : null}
            {steps.map((step) => (
              <div className="span-2 form-grid edoc-route-step" key={step.id}>
                <label>Action<select value={step.action} onChange={(event) => updateRouteStep(step.id, { action: event.target.value as EdocAssignableAction })}>
                  {assignableActions.map((action) => <option value={action} key={action}>{action}</option>)}
                </select></label>
                <label>Assignees<select multiple value={step.assigneeIds} onChange={(event) => updateRouteStep(step.id, { assigneeIds: [...event.currentTarget.selectedOptions].map((option) => option.value) })}>
                  {(profiles.data ?? []).map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName} ({profile.email})</option>)}
                </select></label>
                <label>Completion rule<select value={step.completionRule} onChange={(event) => updateRouteStep(step.id, { completionRule: event.target.value as EdocRouteStepDraft['completionRule'] })}>
                  <option value="all">All</option><option value="any">Any</option><option value="majority">Majority</option><option value="minimum_count">Minimum count</option>
                </select></label>
                <label>Minimum count<input type="number" min="1" value={step.minimumCount ?? ''} onChange={(event) => updateRouteStep(step.id, { minimumCount: event.target.value ? Number(event.target.value) : null })} /></label>
                <label>Due date<input type="date" value={step.dueAt} onChange={(event) => updateRouteStep(step.id, { dueAt: event.target.value })} /></label>
                <label className="edoc-inline-check"><input type="checkbox" checked={step.allowDelegation} onChange={(event) => updateRouteStep(step.id, { allowDelegation: event.target.checked })} /> Allow delegation</label>
                {steps.length > 1 ? <button className="button" type="button" onClick={() => removeRouteStep(step.id)}>Remove step</button> : null}
              </div>
            ))}
            <div className="button-row span-2">
              <button className="button" type="button" onClick={addRouteStep}>Add step</button>
              <button className="button" type="button" onClick={() => setActiveStep(1)}>Back</button>
              <button className="button primary" type="button" onClick={() => setActiveStep(3)}>Continue</button>
            </div>
          </div>
        ) : null}

        {!created && activeStep === 3 ? (
          <div className="edoc-placement-grid">
            <div className="edoc-pdf-surface" aria-label="PDF field placement preview">
              <div className="edoc-pdf-page">
                <span className="document-mark">PDF PAGE 1</span>
                <h2>{metadata.title || 'Untitled document'}</h2>
                <p>{metadata.documentNumber}</p>
                {fields.map((field) => (
                  <button
                    type="button"
                    key={field.id}
                    className="edoc-field-box"
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
            <div className="panel edoc-field-panel">
              <h2>Required fields</h2>
              {allAssigneeDrafts.map((assignee) => {
                const allowedFields = fieldTypesForAction(assignee.step.action)
                return (
                  <div key={assignee.id} className="edoc-field-row">
                    <strong>{assignee.label}</strong>
                    <select onChange={(event) => addField(assignee.id, event.target.value as EdocFieldType)} defaultValue="">
                      <option value="" disabled>Add field</option>
                      {allowedFields.map((fieldType) => <option key={fieldType} value={fieldType}>{edocFieldTypeLabels[fieldType]}</option>)}
                    </select>
                  </div>
                )
              })}
              <small>Click a placed field to remove it. Coordinates are stored as normalized page values.</small>
            </div>
            <div className="button-row span-2">
              <button className="button" type="button" onClick={() => setActiveStep(2)}>Back</button>
              <button className="button primary" type="button" onClick={() => setActiveStep(4)}>Continue</button>
            </div>
          </div>
        ) : null}

        {!created && activeStep === 4 ? (
          <div className="form-grid">
            <section className="span-2 review-summary">
              <div><span>Document</span><strong>{metadata.documentNumber}</strong></div>
              <div><span>Title</span><strong>{metadata.title}</strong></div>
              <div><span>Version</span><strong>v1</strong></div>
              <div><span>Route steps</span><strong>{steps.length}</strong></div>
              <div><span>Assignees</span><strong>{allAssigneeDrafts.length}</strong></div>
              <div><span>Fields</span><strong>{fields.length}</strong></div>
            </section>
            <div className="button-row span-2">
              <button className="button" type="button" onClick={() => setActiveStep(3)} disabled={submitting}>Back</button>
              <button className="button primary" type="button" disabled={submitting} onClick={() => void sendDocument()}>
                {submitting ? 'Sending...' : 'Send document'}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </EdocPage>
  )
}

