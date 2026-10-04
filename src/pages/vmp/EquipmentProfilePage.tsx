import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useVmpApp } from '../../context/VmpAppContext'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import type { VmpMasterlistRecord } from '../../lib/vmpMasterlist'
import { formatAppDate } from '../../utils/dateUtils'
import '../../styles/equipment-profile.css'

type ColumnKey =
  | 'itemName'
  | 'assetTagNo'
  | 'department'
  | 'roomLine'
  | 'capacityQuantity'
  | 'unitOperation'
  | 'verifiedOperatingLimits'
  | 'directContactParts'
  | 'moc'
  | 'totalSurfaceArea'
  | 'mocRating'
  | 'surfaceAreaRating'
  | 'hardToReachAreaCount'
  | 'dateOfInstallation'

const columns: Array<{
  key: ColumnKey
  label: string
  lines?: string[]
  align: 'left' | 'right'
}> = [
  { key: 'itemName', label: 'Equipment', align: 'left' },
  { key: 'assetTagNo', label: 'IL-Tag', align: 'left' },
  { key: 'department', label: 'Department', align: 'left' },
  { key: 'roomLine', label: 'Section', align: 'left' },
  { key: 'capacityQuantity', label: 'Capacity / Quantity', align: 'left' },
  { key: 'unitOperation', label: 'Unit Operation', align: 'left' },
  {
    key: 'verifiedOperatingLimits',
    label: 'Verified Speed Limits / Temp. Limits',
    lines: ['Verified', 'Speed Limits /', 'Temp. Limits'],
    align: 'left',
  },
  { key: 'directContactParts', label: 'Parts with direct contact on bulk', align: 'left' },
  { key: 'moc', label: 'MOC', align: 'left' },
  { key: 'totalSurfaceArea', label: 'Total Surface Area', align: 'right' },
  { key: 'mocRating', label: 'MOC rating', align: 'right' },
  { key: 'surfaceAreaRating', label: 'Surface Area rating', align: 'right' },
  { key: 'hardToReachAreaCount', label: 'Number of hard to reach area', align: 'right' },
  { key: 'dateOfInstallation', label: 'Date of Installation', align: 'left' },
]

function cellText(record: VmpMasterlistRecord, key: ColumnKey): string {
  if (key === 'dateOfInstallation') return formatAppDate(record.dateOfInstallation, '')
  const value = record[key]
  if (value == null || value === '') return ''
  return String(value)
}

export function EquipmentProfilePage() {
  const { records, loading, error } = useVmpApp()
  const { canCreate } = useMenuPermission('vmp-masterlist')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<ColumnKey>('itemName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const equipment = records.filter((record) => record.validationArea === 'Equipment' && !record.isArchived)
    const filtered = q
      ? equipment.filter((record) => columns.some((column) => cellText(record, column.key).toLowerCase().includes(q)))
      : equipment
    const sorted = [...filtered].sort((a, b) => {
      const left = cellText(a, sortKey)
      const right = cellText(b, sortKey)
      const numeric = columns.find((column) => column.key === sortKey)?.align === 'right'
      if (numeric) {
        const delta = (Number(left) || 0) - (Number(right) || 0)
        return sortDir === 'asc' ? delta : -delta
      }
      const delta = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? delta : -delta
    })
    return sorted
  }, [records, query, sortKey, sortDir])

  function toggleSort(key: ColumnKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  return (
    <div className="page equipment-profile-page">
      <header className="equipment-profile-header">
        <p className="eyebrow">Validation Master Plan</p>
        <h1>VMP / Equipment Profile</h1>
        <p>Equipment masterlist records use the same fields as the Masterlist Form.</p>
      </header>
      <div className="eq-masterlist-toolbar">
        <label className="eq-masterlist-search">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Equipment, IL-Tag, department, section…"
          />
        </label>
        {canCreate ? (
          <Link className="vrms-btn-primary" to="/vmp/masterlist">
            New equipment record
          </Link>
        ) : null}
      </div>
      {error ? <p className="eq-banner">{error}</p> : null}
      <div className="eq-masterlist-scroll">
        <table className="eq-masterlist-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={column.align === 'right' ? 'is-number' : 'is-text'}>
                  <button type="button" onClick={() => toggleSort(column.key)}>
                    {column.lines ? column.lines.map((line) => <span key={line}>{line}</span>) : column.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="eq-masterlist-empty" colSpan={columns.length}>
                  Loading equipment records…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="eq-masterlist-empty" colSpan={columns.length}>
                  No equipment records match this view.
                </td>
              </tr>
            ) : (
              rows.map((record) => (
                <tr key={record.id}>
                  {columns.map((column) => (
                    <td key={column.key} className={column.align === 'right' ? 'is-number' : 'is-text'}>
                      {column.key === 'itemName' ? (
                        <Link to={`/vmp/masterlist?edit=${encodeURIComponent(record.recordId)}`}>
                          {cellText(record, column.key) || '—'}
                        </Link>
                      ) : (
                        cellText(record, column.key) || '—'
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
