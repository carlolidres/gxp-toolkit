import { useState } from 'react'

import { FormInput, VmpIcon } from './VmpFormFields'
import type { VmpQcInstrument } from '../../lib/vmpQcInstruments'
import {
  createEmptyQcInstrument,
  findDuplicateInstrumentName,
  hasPopulatedInstruments,
  normalizeInstrumentName,
} from '../../lib/vmpQcInstruments'

const REMOVE_CONFIRM =
  'Remove this instrument entry? The information entered in this field will be discarded.'

export function VmpQcInstrumentsSection({
  instruments,
  actor,
  onChange,
  errors,
}: {
  instruments: VmpQcInstrument[]
  actor: string
  onChange: (next: VmpQcInstrument[]) => void
  errors?: Record<string, string>
}) {
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)
  const active = instruments.filter((row) => row.isActive)
  const rows = active.length > 0 ? active : [createEmptyQcInstrument(actor)]

  function updateRow(id: string, name: string) {
    const trimmed = normalizeInstrumentName(name)
    const duplicate = findDuplicateInstrumentName(trimmed, rows, id)
    if (duplicate && trimmed) return

    const next = rows.map((row) =>
      row.id === id
        ? { ...row, instrumentName: name, updatedAt: new Date().toISOString(), updatedBy: actor }
        : row,
    )
    onChange(next)
  }

  function addRow(afterId: string) {
    const index = rows.findIndex((row) => row.id === afterId)
    const next = [...rows]
    next.splice(index + 1, 0, createEmptyQcInstrument(actor, index + 1))
    onChange(next.map((row, order) => ({ ...row, displayOrder: order })))
  }

  function requestRemove(id: string) {
    const row = rows.find((item) => item.id === id)
    if (!row) return
    if (rows.length <= 1) return
    if (normalizeInstrumentName(row.instrumentName)) {
      setPendingRemoveId(id)
      return
    }
    removeRow(id)
  }

  function removeRow(id: string) {
    if (rows.length <= 1) return
    const next = rows.filter((row) => row.id !== id).map((row, order) => ({ ...row, displayOrder: order }))
    onChange(next.length > 0 ? next : [createEmptyQcInstrument(actor)])
    setPendingRemoveId(null)
  }

  return (
    <div className="vmp-qc-instruments wide">
      <h3 className="vmp-qc-instruments-title">Associated QC Instruments</h3>
      <ul className="vmp-qc-instruments-list">
        {rows.map((row) => {
          const trimmed = normalizeInstrumentName(row.instrumentName)
          const duplicate = trimmed ? findDuplicateInstrumentName(trimmed, rows, row.id) : null
          const error = errors?.[row.id] ?? (duplicate ? 'Duplicate instrument entries are not allowed.' : undefined)

          return (
            <li key={row.id} className="vmp-qc-instrument-row">
              <FormInput
                label="Instrument Name / Identifier"
                required
                value={row.instrumentName}
                onChange={(value) => updateRow(row.id, value)}
                placeholder="HPLC 1"
              />
              <div className="vmp-qc-instrument-actions">
                <button
                  type="button"
                  className="vmp-icon-btn"
                  title="Add another instrument"
                  aria-label="Add another instrument"
                  onClick={() => addRow(row.id)}
                >
                  <VmpIcon name="plus" />
                </button>
                <button
                  type="button"
                  className="vmp-icon-btn"
                  title="Remove instrument"
                  aria-label="Remove instrument"
                  disabled={rows.length <= 1}
                  onClick={() => requestRemove(row.id)}
                >
                  <VmpIcon name="minus" />
                </button>
              </div>
              {error ? (
                <small className="vmp-field-error" role="alert">
                  {error}
                </small>
              ) : null}
            </li>
          )
        })}
      </ul>

      {pendingRemoveId ? (
        <div className="vmp-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="qc-remove-title">
          <p id="qc-remove-title">{REMOVE_CONFIRM}</p>
          <div className="vmp-form-actions-inline">
            <button type="button" className="vrms-btn-danger" onClick={() => removeRow(pendingRemoveId)}>
              Remove
            </button>
            <button type="button" className="vrms-btn-secondary" onClick={() => setPendingRemoveId(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {!hasPopulatedInstruments(rows) ? (
        <small className="vmp-field-helper">Enter at least one instrument identifier.</small>
      ) : null}
    </div>
  )
}
