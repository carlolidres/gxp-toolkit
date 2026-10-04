import type { CpvCppMonitoring, CpvCppStep } from './types'
import { parseAppDate } from '../../utils/dateUtils'

export function emptyCppMonitoring(): CpvCppMonitoring {
  return { vmp_report_no: '', issued_date: '', steps: [] }
}

export function hasCppEntries(value: CpvCppMonitoring | null | undefined): boolean {
  if (!value) return false
  return Boolean(value.vmp_report_no.trim() || value.issued_date.trim() || value.steps.length)
}

export function normalizeCppMonitoring(input: {
  vmp_report_no: string
  issued_date: string
  steps: Array<{ step_no: string; description: string; cpp: string }>
}): CpvCppMonitoring {
  const steps: CpvCppStep[] = input.steps.flatMap((row) => {
    const step_no = row.step_no.trim()
    const description = row.description.trim()
    const cpp = row.cpp.trim()
    if (!step_no && !description && !cpp) return []
    if (!step_no || !description || !cpp) {
      throw new Error('Process Step No., Process Description, and CPP are required.')
    }
    return [{ step_no, description, cpp }]
  })
  const issuedText = input.issued_date.trim()
  const issued_date = issuedText ? parseAppDate(issuedText) : ''
  if (issuedText && !issued_date) throw new Error('Issued Date must use dd Mmm YYYY.')
  return { vmp_report_no: input.vmp_report_no.trim(), issued_date: issued_date ?? '', steps }
}
