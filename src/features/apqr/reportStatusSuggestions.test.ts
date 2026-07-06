import { afterEach, describe, expect, it } from 'vitest'

import {
  mergeReportStatusSuggestions,
  readReportStatusSuggestions,
  rememberReportStatus,
} from './reportStatusSuggestions'

const STORAGE_KEY = 'apqr-report-status-suggestions'

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY)
})

describe('reportStatusSuggestions', () => {
  it('remembers and merges unique report statuses with recent-first ordering', () => {
    rememberReportStatus('Draft Sent')
    rememberReportStatus('Pending QA Review')

    expect(readReportStatusSuggestions()).toEqual(['Pending QA Review', 'Draft Sent'])
    expect(mergeReportStatusSuggestions(['For Client Approval', 'Draft Sent'])).toEqual([
      'Pending QA Review',
      'Draft Sent',
      'For Client Approval',
    ])
  })
})
