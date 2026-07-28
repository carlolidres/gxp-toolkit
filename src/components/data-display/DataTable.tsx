import type { ReactNode } from 'react'
import { Button, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'

export interface TableColumn<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => ReactNode
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onRowClick,
}: {
  rows: T[]
  columns: TableColumn<T>[]
  onRowClick?: (row: T) => void
}) {
  const antdColumns: ColumnsType<T> = columns.map((column) => ({
    key: String(column.key),
    title: column.label,
    dataIndex: column.key as string,
    render: (_value, row) =>
      column.render ? column.render(row) : String(row[column.key as keyof T] ?? ''),
  }))

  return (
    <div className="table-wrap">
      <Table<T>
        rowKey="id"
        columns={antdColumns}
        dataSource={rows}
        pagination={false}
        size="middle"
        locale={{ emptyText: 'No records found.' }}
        rowClassName={onRowClick ? 'data-table-row-clickable' : undefined}
        onRow={
          onRowClick
            ? (row) => ({
                onClick: () => onRowClick(row),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onRowClick(row)
                  }
                },
                tabIndex: 0,
                role: 'link',
                'aria-label': 'View document',
              })
            : undefined
        }
      />
    </div>
  )
}

export function PaginationControls({
  page,
  pageCount,
  onChange,
}: {
  page: number
  pageCount: number
  onChange: (page: number) => void
}) {
  return (
    <div className="pagination">
      <Space>
        <Button disabled={page === 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <span>
          Page {page} of {pageCount}
        </span>
        <Button disabled={page === pageCount} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </Space>
    </div>
  )
}

export function StatusBadge({ status, tone = 'neutral' }: { status: string; tone?: string }) {
  const color =
    tone === 'success'
      ? 'success'
      : tone === 'warning'
        ? 'warning'
        : tone === 'danger'
          ? 'error'
          : tone === 'info'
            ? 'processing'
            : 'default'

  return (
    <Tag className={`status-badge ${tone}`} color={color}>
      {status}
    </Tag>
  )
}
