import { Button, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'

import type { RoutingDocument } from '../../types/vrms'
import { VrmsStatusBadge } from './VrmsStatusBadge'

type ColumnKey = keyof RoutingDocument

interface VrmsDataTableProps {
  rows: RoutingDocument[]
  columns: ReadonlyArray<{ key: ColumnKey; label: string; width?: string | number }>
  onTrackerClick?: (tracker: string) => void
}

const DEFAULT_WIDTHS: Partial<Record<ColumnKey, string | number>> = {
  routingTracker: '12%',
  docTracer: '14%',
  equipmentProduct: '22%',
  category: '9%',
  ilTag: '7%',
  status: 72,
  sentRoutingTo: '12%',
  email: '12%',
}

export function VrmsDataTable({ rows, columns, onTrackerClick }: VrmsDataTableProps) {
  const antdColumns: ColumnsType<RoutingDocument> = columns.map((column) => ({
    key: column.key,
    title: column.label,
    dataIndex: column.key,
    ellipsis: column.key !== 'status',
    width: column.width ?? DEFAULT_WIDTHS[column.key],
    ...(column.key === 'status' ? { align: 'center' as const } : {}),
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
        tableLayout="fixed"
        style={{ width: '100%' }}
        locale={{ emptyText: 'No records found.' }}
      />
    </div>
  )
}
