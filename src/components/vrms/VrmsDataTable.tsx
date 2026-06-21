import type { RoutingDocument } from '../../types/vrms'
import { VrmsStatusBadge } from './VrmsStatusBadge'

type ColumnKey = keyof RoutingDocument

interface VrmsDataTableProps {
  rows: RoutingDocument[]
  columns: ReadonlyArray<{ key: ColumnKey; label: string }>
  onTrackerClick?: (tracker: string) => void
}

export function VrmsDataTable({ rows, columns, onTrackerClick }: VrmsDataTableProps) {
  return (
    <div className="vrms-table-wrap">
      <table className="vrms-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>No records found.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.routingTracker || row.docTracer}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.key === 'routingTracker' && onTrackerClick ? (
                      <button type="button" className="vrms-tracker-link" onClick={() => onTrackerClick(row.routingTracker)}>
                        {row.routingTracker}
                      </button>
                    ) : column.key === 'status' ? (
                      <VrmsStatusBadge status={row.status} />
                    ) : (
                      String(row[column.key] ?? '')
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
