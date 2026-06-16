import { exportRows } from '../utils/exportUtils'

export const exportService = {
  toCsv<T extends object>(rows: T[], name: string): void {
    exportRows(rows as Array<Record<string, unknown>>, `${name}.csv`)
  },
  toSpreadsheet<T extends object>(rows: T[], name: string): void {
    exportRows(rows as Array<Record<string, unknown>>, `${name}-spreadsheet.csv`)
  },
}

