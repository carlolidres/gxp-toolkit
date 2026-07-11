import { describe, expect, it } from 'vitest'

import {
  addCalendarDays,
  assignCommitmentPriority,
  classifyDelivery,
  commitmentMonthFromGenerationMonth,
  defaultApqrGenerationDate,
  defaultCommitmentSchedule,
  defaultStabilityPullOutDate,
  expectedStabilityTabulationCompletionDate,
  linkedFilterMonthsFromField,
} from './scheduling'

describe('apqr scheduling', () => {
  it('computes default stability pull-out 60 days before coverage end', () => {
    expect(defaultStabilityPullOutDate('2026-12-31')).toBe('2026-11-01')
  })

  it('computes APQR generation date 30 days after coverage end', () => {
    expect(defaultApqrGenerationDate('2026-12-31')).toBe('2027-01-30')
  })

  it('computes commitment schedule 90 days after coverage end', () => {
    expect(defaultCommitmentSchedule('2026-12-31')).toBe('2027-03-31')
  })

  it('keeps auto-compute commitment month exactly 2 months after generation', () => {
    expect(commitmentMonthFromGenerationMonth('2026-07')).toBe('2026-09')
    expect(commitmentMonthFromGenerationMonth('2026-11')).toBe('2027-01')
  })

  it('syncs linked month filters with commitment = generation + 2 months', () => {
    expect(linkedFilterMonthsFromField('generation', '2026-07')).toEqual({
      pullout: '2026-04',
      generation: '2026-07',
      commitment: '2026-09',
    })
  })

  it('syncs linked month filters from a pullout month', () => {
    const linked = linkedFilterMonthsFromField('pullout', '2026-04')
    expect(linked?.pullout).toBe('2026-04')
    expect(linked?.commitment).toBe(commitmentMonthFromGenerationMonth(linked!.generation))
  })

  it('syncs linked month filters from a commitment month as generation − 2', () => {
    expect(linkedFilterMonthsFromField('commitment', '2026-09')).toEqual({
      pullout: '2026-04',
      generation: '2026-07',
      commitment: '2026-09',
    })
  })

  it('computes per-record generation month from review coverage end', () => {
    expect(defaultApqrGenerationDate('2026-05-31').slice(0, 7)).toBe('2026-06')
    expect(defaultStabilityPullOutDate('2026-05-31').slice(0, 7)).toBe('2026-04')
    expect(defaultCommitmentSchedule('2026-05-31').slice(0, 7)).toBe('2026-08')
  })

  it('computes expected stability tabulation completion', () => {
    expect(expectedStabilityTabulationCompletionDate('2026-11-01')).toBe(addCalendarDays('2026-11-01', 90))
  })

  it('classifies on-time and overdue delivery', () => {
    expect(classifyDelivery('2027-03-31', '2027-03-30')).toBe('Delivered On Time')
    expect(classifyDelivery('2027-03-31', '2027-04-01')).toBe('Delivered Overdue')
    expect(classifyDelivery('2027-03-31', null, '2027-04-01')).toBe('Currently Overdue and Undelivered')
  })

  it('returns NA delivery and low priority for cancelled report status', () => {
    expect(classifyDelivery('2027-03-31', null, '2027-04-01', 'Cancelled')).toBe('NA')
    expect(
      assignCommitmentPriority({
        commitment_schedule: '2027-03-31',
        final_apqr_delivery_date: null,
        date_client_signed: null,
        apqr_report_status: 'Cancelled',
        commitment_schedule_status: 'Planned',
        department: null,
        number_of_batches: null,
        apr_reference_number: null,
        billing_reference_number: null,
        apqr_package: 'Billable',
      }),
    ).toBe('Low Priority')
  })
})
