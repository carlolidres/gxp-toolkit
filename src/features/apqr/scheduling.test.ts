import { describe, expect, it } from 'vitest'

import {
  assignCommitmentPriority,
  classifyDelivery,
  commitmentMonthFromGenerationMonth,
  defaultApqrGenerationDate,
  defaultCommitmentSchedule,
  defaultStabilityPullOutDate,
  generationMonthFromCommitmentMonth,
  linkedFilterMonthsFromField,
  linkedManualFilterMonthsFromField,
  manualApqrGenerationFromCommitment,
  manualStabilityPullOutDate,
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

  it('computes manual pull-out 2 months before coverage end', () => {
    expect(manualStabilityPullOutDate('2026-12-31')).toBe('2026-10-31')
    expect(manualStabilityPullOutDate('2026-05-31')).toBe('2026-03-31')
  })

  it('computes manual generation 2 months before commitment', () => {
    expect(manualApqrGenerationFromCommitment('2027-03-31')).toBe('2027-01-31')
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

  it('manual filter: commitment change updates generation only', () => {
    expect(
      linkedManualFilterMonthsFromField('commitment', '2026-09', {
        pullout: '2026-04',
        generation: '2026-05',
        commitment: '2026-07',
      }),
    ).toEqual({
      pullout: '2026-04',
      generation: generationMonthFromCommitmentMonth('2026-09'),
      commitment: '2026-09',
    })
  })

  it('manual filter: generation change does not affect commitment', () => {
    expect(
      linkedManualFilterMonthsFromField('generation', '2026-06', {
        pullout: '2026-04',
        generation: '2026-05',
        commitment: '2026-09',
      }),
    ).toEqual({
      pullout: '2026-04',
      generation: '2026-06',
      commitment: '2026-09',
    })
  })

  it('keeps month-year slices aligned with day-based defaults', () => {
    expect(defaultApqrGenerationDate('2026-05-31').slice(0, 7)).toBe('2026-06')
    expect(defaultStabilityPullOutDate('2026-05-31').slice(0, 7)).toBe('2026-04')
    expect(defaultCommitmentSchedule('2026-05-31').slice(0, 7)).toBe('2026-08')
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
