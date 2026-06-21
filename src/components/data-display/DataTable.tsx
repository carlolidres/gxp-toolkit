import type { ReactNode } from 'react'

export interface TableColumn<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => ReactNode
}

export function DataTable<T extends { id: string }>({ rows, columns }: { rows: T[]; columns: TableColumn<T>[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((column) => <th key={String(column.key)}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => <td key={String(column.key)}>{column.render ? column.render(row) : String(row[column.key as keyof T] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PaginationControls({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  return <div className="pagination"><button disabled={page === 1} onClick={() => onChange(page - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page === pageCount} onClick={() => onChange(page + 1)}>Next</button></div>
}

export function StatusBadge({ status, tone = 'neutral' }: { status: string; tone?: string }) {
  return <span className={`status-badge ${tone}`}>{status}</span>
}

