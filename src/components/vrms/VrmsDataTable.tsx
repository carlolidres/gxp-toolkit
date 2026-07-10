import { Button, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'

import type { RoutingDocument } from '../../types/vrms'
import { VrmsStatusBadge } from './VrmsStatusBadge'

type ColumnKey = keyof RoutingDocument

interface VrmsDataTableProps {
  rows: RoutingDocument[]
  columns: ReadonlyArray<{ key: ColumnKey; label: string }>
  onTrackerClick?: (tracker: string) => void
}

export function VrmsDataTable({ rows, columns, onTrackerClick }: VrmsDataTableProps) {
  const antdColumns: ColumnsType<RoutingDocument> = columns.map((column) => ({
    key: column.key,
    title: column.label,
    dataIndex: column.key,
    ...(column.key === 'status' ? { width: 72, align: 'center' as const } : {}),
    render: (_value, row) => {
      if (column.key === 'routingTracker' && onTrackerClick) {
        return (
          <Button type="link" className="vrms-tracker-link" onClick={() => onTrackerClick(row.routingTracker)}>
            {row.routingTracker}
          </Button>
        )
      }
      if (column.key === 'status') {
        return <VrmsStatusBadge status={row.status} />
      }
      return String(row[column.key] ?? '')
    },
  }))

  return (
    <div className="vrms-table-wrap">
      <Table<RoutingDocument>
        className="vrms-table"
        rowKey={(row) => row.routingTracker || row.docTracer}
        columns={antdColumns}
        dataSource={rows}
        pagination={false}
        size="middle"
        locale={{ emptyText: 'No records found.' }}
      />
    </div>
  )
}
