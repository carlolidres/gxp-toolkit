import { useState } from 'react'

import { batchesInReleaseRange, buildProfilePdf, profilePdfName, profilePrintHeading, profilePrintTable, toggleBatchSelection } from '../../features/cpv/profilePrint'
import type { EquipmentSheet } from '../../features/vmp/equipmentWorkbook'

export function ProfilePrintDialog({ sheet, section, client, productName, productCode, onClose, onError }: {
  sheet: EquipmentSheet
  section: string
  client: string
  productName: string
  productCode: string
  onClose: () => void
  onError: (message: string) => void
}) {
  const heading = profilePrintHeading({ section, client, productName, productCode })
  const table = profilePrintTable(sheet, section)
  const [appendix, setAppendix] = useState(heading.appendix)
  const [clientName, setClientName] = useState(heading.client)
  const [name, setName] = useState(heading.productName)
  const [code, setCode] = useState(heading.productCode)
  const [releasedFrom, setReleasedFrom] = useState('')
  const [releasedTo, setReleasedTo] = useState('')
  const [selected, setSelected] = useState(table.batches.map((batch) => batch.row))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const order = table.batches.map((batch) => batch.row)

  function applyDates(from: string, to: string) {
    setReleasedFrom(from)
    setReleasedTo(to)
    setSelected(batchesInReleaseRange(table.batches, from, to))
  }

  async function printReport() {
    const chosen = table.batches.filter((batch) => selected.includes(batch.row))
    if (!chosen.length) {
      setError('Choose at least one unique batch number.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const bytes = await buildProfilePdf({
        appendix,
        client: clientName,
        productName: name,
        productCode: code,
        groupTitle: heading.groupTitle,
        materials: table.materials,
        batches: chosen,
      })
      const copy = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(copy).set(bytes)
      const blob = new Blob([copy], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = profilePdfName(code, section)
      link.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The PDF could not be created.'
      setError(message)
      onError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="eq-profile-dialog eq-print-dialog"
      role="dialog"
      aria-label="Print report"
      onSubmit={(event) => {
        event.preventDefault()
        void printReport()
      }}
      onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}
    >
      <h2>Print report</h2>
      <label>
        Appendix
        <input aria-label="Appendix" value={appendix} onChange={(event) => setAppendix(event.target.value.toUpperCase())} />
      </label>
      <label>
        Client
        <input aria-label="Client" value={clientName} onChange={(event) => setClientName(event.target.value.toUpperCase())} />
      </label>
      <label>
        Product Name
        <input aria-label="Product Name" value={name} onChange={(event) => setName(event.target.value.toUpperCase())} />
      </label>
      <label>
        Product Code
        <input aria-label="Product Code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
      </label>
      <div className="eq-print-dates">
        <label>
          Released from
          <input aria-label="Released from" type="date" value={releasedFrom} onChange={(event) => applyDates(event.target.value, releasedTo)} />
        </label>
        <label>
          Released to
          <input aria-label="Released to" type="date" value={releasedTo} onChange={(event) => applyDates(releasedFrom, event.target.value)} />
        </label>
      </div>
      <p>Tick one batch, then tick another to include every batch between them. Clear a box to leave that batch out.</p>
      {table.batches.length ? (
        <ul className="eq-print-batches">
          {table.batches.map((batch) => (
            <li key={batch.row}>
              <label>
                <input
                  type="checkbox"
                  aria-label={batch.uniqueBatchNo}
                  checked={selected.includes(batch.row)}
                  onChange={(event) => setSelected(toggleBatchSelection(order, selected, batch.row, event.target.checked))}
                />
                {batch.uniqueBatchNo}
                <span>{batch.released || 'No released date'}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : <p>Add a batch before printing.</p>}
      {error ? <p className="eq-banner">{error}</p> : null}
      <div className="eq-profile-dialog-actions">
        <button type="submit" disabled={busy || table.batches.length === 0}>Print</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}
