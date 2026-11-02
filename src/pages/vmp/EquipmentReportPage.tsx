import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { listCpvProducts, reloadCpvStoreFromSession } from '../../features/cpv/cpvService'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { logEquipmentReportField } from '../../features/vmp/equipmentAudit'
import {
  cleanabilityRating,
  equipmentAgeYears,
  equipmentProductUsers,
  equipmentReportKey,
  findEquipmentRecord,
  HTC_CRITERIA,
  HTR_CRITERIA,
  htrAssessment,
  loadEquipmentReport,
  MOC_OPTIONS,
  newReportId,
  overallCleanability,
  ratingLabel,
  saveEquipmentReport,
  type CleanPart,
  type EquipmentReportDetails,
  type OperatingParameter,
  type Rating,
} from '../../features/vmp/equipmentReport'
import { formatMasterlistDate, loadEquipmentMasterlist, parseMasterlistDate } from '../../features/vmp/equipmentMasterlist'
import '../../styles/equipment-profile.css'

function DateField({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  const parsed = parseMasterlistDate(value)
  return (
    <label className="eq-date-field">
      {label}
      <input
        type="date"
        aria-label={label}
        disabled={disabled}
        value={parsed?.iso ?? ''}
        onClick={(event) => event.currentTarget.showPicker?.()}
        onChange={(event) => onChange(event.target.value ? formatMasterlistDate(event.target.value) : '')}
      />
      <span className={value ? '' : 'is-empty'}>{value || 'DD MMM YYYY'}</span>
    </label>
  )
}

function ratingValue(value: string): Rating | null {
  const number = Number(value)
  return number === 1 || number === 2 || number === 3 ? number : null
}

function reportSummary(details: EquipmentReportDetails): Record<string, string> {
  return {
    'Date Installed': details.dateInstalled,
    'Loading Capacity': details.loadingCapacity,
    'Operating Capacity': details.parameters.map((item) => `${item.name}: ${item.min}–${item.max} ${item.unit}`).join('; '),
    'Bulk Product-Contact Parts': details.parts.map((item) => `${item.name} (${item.moc || 'MOC not set'})`).join('; '),
    'Total Surface Area': details.surfaceArea,
    'PECSP No.': details.pecsp,
    'Cleanability Assessment': details.parts.map((part) => {
      const htr = htrAssessment(part)
      return `${part.name}: HTC ${ratingLabel(part.htc)}; HTR ${htr.score == null ? 'Not Assessed' : `${htr.score}/15 ${ratingLabel(htr.rating)}`}; Cleanability ${ratingLabel(cleanabilityRating(part))}`
    }).join('; '),
  }
}

export function EquipmentReportPage() {
  const { canEdit } = useMenuPermission('vmp-equipment')
  const [params] = useSearchParams()
  const sheet = params.get('sheet') ?? ''
  const department = params.get('department') ?? ''
  const no = params.get('no') ?? ''
  const record = useMemo(() => findEquipmentRecord(loadEquipmentMasterlist(), sheet, department, no), [sheet, department, no])
  const key = record ? equipmentReportKey(sheet, record) : ''
  const [saved, setSaved] = useState<EquipmentReportDetails | null>(() => (key ? loadEquipmentReport(key) : null))
  const [details, setDetails] = useState<EquipmentReportDetails>(() => (key ? loadEquipmentReport(key) : {
    dateInstalled: '', loadingCapacity: '', parameters: [], contactParts: [], surfaceArea: '', parts: [], pecsp: '',
  }))
  const [notice, setNotice] = useState('')
  const [productNames, setProductNames] = useState<Map<string, string>>(() => new Map())
  const productUsers = useMemo(
    () => (record ? equipmentProductUsers(record.equipment, record.ilTag, productNames) : []),
    [record, productNames],
  )

  useEffect(() => {
    reloadCpvStoreFromSession()
    let gone = false
    void listCpvProducts().then((rows) => {
      if (!gone) setProductNames(new Map(rows.map((row) => [row.product_code.toUpperCase(), row.product_name])))
    })
    return () => { gone = true }
  }, [])

  if (!record || !saved) {
    return (
      <div className="page equipment-report-page">
        <p>This equipment record could not be found.</p>
        <Link to="/vmp/equipment">Back to Equipment</Link>
      </div>
    )
  }

  const label = `${record.equipment} (${record.ilTag || 'no IL Tag'})`
  const overall = overallCleanability(details.parts)
  const facts = [
    ['Equipment', record.equipment],
    ['IL Tag No.', record.ilTag],
    ['Section', record.section],
    ['Protocol No.', record.protocol],
    ['Report No.', record.report],
    ['Report Approval Date', record.approval],
    ['Next Review Date', record.nextReview],
  ]

  function updatePart(id: string, patch: Partial<CleanPart>) {
    setDetails((current) => ({ ...current, parts: current.parts.map((part) => part.id === id ? { ...part, ...patch } : part) }))
  }

  function save() {
    const missing = details.parts.find((part) => !part.name.trim() || part.htc == null || !part.htcJustification.trim())
    if (missing) {
      setNotice('Each hard-to-clean part needs a name, an HTC rating, and a justification.')
      return
    }
    const before = reportSummary(saved)
    const after = reportSummary(details)
    Object.keys(after).forEach((field) => {
      logEquipmentReportField(label, field, before[field] ?? '', after[field] ?? '')
    })
    const stored = { ...details, contactParts: details.parts.map((part) => ({ id: part.id, name: part.name, moc: part.moc })) }
    saveEquipmentReport(key, stored)
    setSaved(stored)
    setNotice('Equipment report saved.')
  }

  return (
    <div className="page equipment-report-page">
      <p><Link to="/vmp/equipment">Back to Equipment</Link></p>
      <h1>{record.equipment}</h1>
      <p className="equipment-report-meta">{record.department} · No. {record.sourceNo} · {sheet}</p>
      <dl className="equipment-report-facts">
        {facts.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>

      <section>
        <DateField label="Date Installed" value={details.dateInstalled} disabled={!canEdit} onChange={(dateInstalled) => setDetails({ ...details, dateInstalled })} />
        <p>Equipment age: <strong>{equipmentAgeYears(details.dateInstalled) || '—'}</strong></p>
      </section>

      <section>
        <label>
          <span className="eq-field-label">
            Loading Capacity
            <button type="button" className="eq-field-info" title="Loading capacity of the equipment, such as a 3000-L tank or a mixer that can mix 50-kg bulk." aria-label="Loading capacity is the amount the equipment is built to hold or process, such as a 3000-L tank or a mixer that can mix 50-kg bulk.">i</button>
          </span>
          <input aria-label="Loading Capacity" value={details.loadingCapacity} disabled={!canEdit} onChange={(event) => setDetails({ ...details, loadingCapacity: event.target.value })} />
        </label>
      </section>

      <section>
        <h2>Operating Capacity</h2>
        {details.parameters.map((item) => (
          <div className="equipment-report-row" key={item.id}>
            <input aria-label="Parameter" placeholder="Parameter" value={item.name} disabled={!canEdit} onChange={(event) => setDetails({ ...details, parameters: details.parameters.map((row) => row.id === item.id ? { ...row, name: event.target.value } : row) })} />
            <input aria-label="Unit" placeholder="Unit" value={item.unit} disabled={!canEdit} onChange={(event) => setDetails({ ...details, parameters: details.parameters.map((row) => row.id === item.id ? { ...row, unit: event.target.value } : row) })} />
            <input aria-label="Minimum" placeholder="Minimum" value={item.min} disabled={!canEdit} onChange={(event) => setDetails({ ...details, parameters: details.parameters.map((row) => row.id === item.id ? { ...row, min: event.target.value } : row) })} />
            <input aria-label="Maximum" placeholder="Maximum" value={item.max} disabled={!canEdit} onChange={(event) => setDetails({ ...details, parameters: details.parameters.map((row) => row.id === item.id ? { ...row, max: event.target.value } : row) })} />
            {canEdit ? <button type="button" onClick={() => setDetails({ ...details, parameters: details.parameters.filter((row) => row.id !== item.id) })}>Remove</button> : null}
          </div>
        ))}
        {canEdit ? <button type="button" onClick={() => setDetails({ ...details, parameters: [...details.parameters, { id: newReportId(), name: '', unit: '', min: '', max: '' } satisfies OperatingParameter] })}>Add parameter</button> : null}
      </section>

      <section>
        <h2>Products that use this equipment</h2>
        {productUsers.length ? (
          <ul>
            {productUsers.map((item) => (
              <li key={`${item.productCode}:${item.processes}`}>{item.productName ? `${item.productName} (${item.productCode})` : item.productCode} — {item.processes}</li>
            ))}
          </ul>
        ) : <p>No product profile has selected this equipment yet.</p>}
      </section>

      <section>
        <label>
          Total Surface Area (cm²)
          <input aria-label="Total Surface Area" value={details.surfaceArea} disabled={!canEdit} onChange={(event) => setDetails({ ...details, surfaceArea: event.target.value })} />
        </label>
      </section>

      <section>
        <h2>Bulk Product-Contact Parts</h2>
        <p>Each product-contact part is assessed for hard-to-clean and hard-to-reach.</p>
        <table className="equipment-report-criteria">
          <tbody>
            {HTC_CRITERIA.map(([score, name, text]) => (
              <tr key={score}><th>{score} – {name}</th><td>{text}</td></tr>
            ))}
          </tbody>
        </table>
        {details.parts.map((part) => {
          const htr = htrAssessment(part)
          return (
            <div className="equipment-report-part" key={part.id}>
              <input aria-label="Product-contact part" placeholder="Product-contact part" value={part.name} disabled={!canEdit} onChange={(event) => updatePart(part.id, { name: event.target.value })} />
              <select aria-label="MOC" value={part.moc} disabled={!canEdit} onChange={(event) => updatePart(part.id, { moc: event.target.value as CleanPart['moc'] })}>
                <option value="">MOC</option>
                {MOC_OPTIONS.map((moc) => <option key={moc} value={moc}>{moc}</option>)}
              </select>
              <select aria-label="HTC Rating" value={part.htc ?? ''} disabled={!canEdit} onChange={(event) => updatePart(part.id, { htc: ratingValue(event.target.value) })}>
                <option value="">HTC rating</option>
                <option value="1">1 – Low</option>
                <option value="2">2 – Medium</option>
                <option value="3">3 – High</option>
              </select>
              <textarea aria-label="HTC justification" placeholder="Justification" value={part.htcJustification} disabled={!canEdit} onChange={(event) => updatePart(part.id, { htcJustification: event.target.value })} />
              <h3>Hard-to-Reach</h3>
              {HTR_CRITERIA.map(([field, name, low, medium, high]) => (
                <label key={field}>
                  {name}
                  <select aria-label={`${part.name || 'Part'} ${name}`} value={part[field] ?? ''} disabled={!canEdit} onChange={(event) => updatePart(part.id, { [field]: ratingValue(event.target.value) })}>
                    <option value="">Not assessed</option>
                    <option value="1">1 – Low: {low}</option>
                    <option value="2">2 – Medium: {medium}</option>
                    <option value="3">3 – High: {high}</option>
                  </select>
                </label>
              ))}
              <p>HTR score: {htr.score == null ? 'Not Assessed' : `${htr.score}/15`} · HTR rating: {ratingLabel(htr.rating)} · Cleanability: {ratingLabel(cleanabilityRating(part))}</p>
              {part.sampling === 3 ? <p>Limited swab access. Document an alternative sampling strategy, such as validated rinse sampling.</p> : null}
              {canEdit ? <button type="button" onClick={() => setDetails({ ...details, parts: details.parts.filter((row) => row.id !== part.id) })}>Remove part</button> : null}
            </div>
          )
        })}
        {canEdit ? <button type="button" onClick={() => setDetails({ ...details, parts: [...details.parts, { id: newReportId(), name: '', moc: '', htc: null, htcJustification: '', physical: null, disassembly: null, visual: null, cleaning: null, sampling: null }] })}>Add product-contact part</button> : null}
      </section>

      <section>
        <h2>Cleanability Rating</h2>
        <p>Calculated as the higher of the hard-to-clean and hard-to-reach ratings. A High rating is a priority for cleaning-validation assessment. It does not by itself mean the cleaning is inadequate.</p>
        {details.parts.map((part) => (
          <p key={part.id}>{part.name || 'Unnamed part'}: {ratingLabel(cleanabilityRating(part))}</p>
        ))}
        <p>Overall equipment cleanability: <strong>{ratingLabel(overall)}</strong></p>
      </section>

      <section>
        <label>
          PECSP No.
          <input aria-label="PECSP No." value={details.pecsp} disabled={!canEdit} onChange={(event) => setDetails({ ...details, pecsp: event.target.value })} />
        </label>
      </section>

      {notice ? <p>{notice}</p> : null}
      {canEdit ? <button type="button" onClick={save}>Save report</button> : null}
    </div>
  )
}
