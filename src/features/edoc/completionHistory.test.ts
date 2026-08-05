import { describe, expect, it } from 'vitest'

import {
  buildCompletionHistoryEvents,
  formatHistoryTimestamp,
  resolveTrustedClientIp,
  versionSummaryLabels,
  wrapIdentifier,
} from './completionHistory'

describe('formatHistoryTimestamp', () => {
  it('formats a readable timestamp with GMT offset', () => {
    // Fixed offset +480 (GMT+8)
    const label = formatHistoryTimestamp('2026-08-01T08:40:29.510Z', 480)
    expect(label).toBe('Aug 1, 2026, 4:40:29 PM GMT+8')
  })

  it('formats GMT+0 without minutes when whole hours', () => {
    const label = formatHistoryTimestamp('2026-08-01T08:40:29.000Z', 0)
    expect(label).toBe('Aug 1, 2026, 8:40:29 AM GMT+0')
  })
})

describe('resolveTrustedClientIp', () => {
  it('returns only the first hop from a proxy chain', () => {
    expect(resolveTrustedClientIp('136.158.78.143,136.158.78.143, 99.82.170.144')).toBe('136.158.78.143')
  })

  it('returns null for empty values', () => {
    expect(resolveTrustedClientIp(null)).toBeNull()
    expect(resolveTrustedClientIp('  ')).toBeNull()
  })
})

describe('wrapIdentifier', () => {
  it('wraps long hashes without truncating', () => {
    const hash = '7109b62fc294bcae50709e41199dba118ae8096007f5db3aabcdef0123456789'
    const lines = wrapIdentifier(hash, 32)
    expect(lines.join('')).toBe(hash)
    expect(lines.every((l) => l.length <= 32)).toBe(true)
    expect(lines.join('')).not.toContain('…')
  })
})

describe('versionSummaryLabels', () => {
  it('uses revision when present', () => {
    const labels = versionSummaryLabels({ versionId: 'dddb94c1-fb93-4345-9933-1e4049380917', versionNumber: 5 })
    expect(labels.revisionLabel).toBe('5')
    expect(labels.versionDisplay).toBe('Revision 5')
  })

  it('falls back to final signed version wording', () => {
    const labels = versionSummaryLabels({ versionId: 'dddb94c1-fb93-4345-9933-1e4049380917' })
    expect(labels.versionDisplay).toBe('Final signed version')
    expect(labels.versionIdLabel).toContain('dddb94c1')
  })
})

describe('buildCompletionHistoryEvents', () => {
  const actors = new Map([
    ['p-1', { display_name: 'Carlo Lidres', email: 'carlolidres@gmail.com', organization: 'Interphil Laboratories, Inc.' }],
  ])

  it('orders equal timestamps by lifecycle rank (created before routing)', () => {
    const same = '2026-08-01T07:58:55.577Z'
    const events = buildCompletionHistoryEvents({
      audits: [
        { id: 'a-route', event_type: 'route_started', actor_id: 'p-1', reason: null, created_at: same },
        { id: 'a-create', event_type: 'document_created', actor_id: 'p-1', reason: null, created_at: same },
      ],
      signatures: [],
      actors,
      routeCompletedAt: null,
      timeZoneOffsetMinutes: 480,
    })
    expect(events.map((e) => e.title)).toEqual(['DOCUMENT CREATED', 'ROUTING INITIATED'])
  })

  it('consolidates sign_completed with signature manifestation', () => {
    const events = buildCompletionHistoryEvents({
      audits: [
        { id: 'a1', event_type: 'document_created', actor_id: 'p-1', reason: null, created_at: '2026-08-01T07:58:55Z' },
        { id: 'a2', event_type: 'route_started', actor_id: 'p-1', reason: null, created_at: '2026-08-01T07:58:56Z' },
        { id: 'a3', event_type: 'sign_completed', actor_id: 'p-1', reason: null, created_at: '2026-08-01T08:40:29Z' },
      ],
      signatures: [
        {
          id: 's1',
          signer_display_name: 'Carlo Lidres',
          signer_email: 'carlolidres@gmail.com',
          signer_organization: 'Interphil Laboratories, Inc.',
          signature_meaning: 'I prepared this document.',
          signing_timestamp: '2026-08-01T08:40:29.307Z',
          source_ip: '136.158.78.143,99.82.170.144',
          auth_method: 'password',
          signature_appearance_type: 'image',
        },
      ],
      actors,
      routeCompletedAt: '2026-08-01T08:40:29.510Z',
      timeZoneOffsetMinutes: 480,
    })

    const titles = events.map((e) => e.title)
    expect(titles).toContain('DOCUMENT CREATED')
    expect(titles).toContain('ROUTING INITIATED')
    expect(titles).toContain('ELECTRONIC SIGNATURE APPLIED')
    expect(titles).toContain('WORKFLOW COMPLETED')
    expect(titles).not.toContain('SIGNING TASK COMPLETED')
    expect(titles.filter((t) => t === 'ELECTRONIC SIGNATURE APPLIED')).toHaveLength(1)

    const sig = events.find((e) => e.title === 'ELECTRONIC SIGNATURE APPLIED')!
    expect(sig.detailLines.some((l) => l.startsWith('Source IP: 136.158.78.143'))).toBe(true)
    expect(sig.detailLines.every((l) => !l.includes('99.82'))).toBe(true)
    expect(sig.actorLine).toContain('Carlo Lidres')
    expect(sig.timestampLabel).toMatch(/GMT\+8/)
  })

  it('consolidates review_completed with Reviewed-by signature manifestation', () => {
    const events = buildCompletionHistoryEvents({
      audits: [
        { id: 'a1', event_type: 'document_created', actor_id: 'p-1', reason: null, created_at: '2026-08-01T07:58:55Z' },
        {
          id: 'a2',
          event_type: 'review_completed',
          actor_id: 'p-1',
          reason: 'Document reviewed and electronically signed by Carlo Lidres',
          created_at: '2026-08-01T08:40:29Z',
        },
      ],
      signatures: [
        {
          id: 's1',
          signer_display_name: 'Carlo Lidres',
          signer_email: 'carlolidres@gmail.com',
          signer_organization: 'Interphil Laboratories, Inc.',
          signature_meaning: 'I reviewed this document.',
          signing_timestamp: '2026-08-01T08:40:29.307Z',
          source_ip: '136.158.78.143',
          auth_method: 'password',
          signature_appearance_type: 'image',
        },
      ],
      actors,
      routeCompletedAt: null,
      timeZoneOffsetMinutes: 480,
    })

    const titles = events.map((e) => e.title)
    expect(titles).not.toContain('REVIEW COMPLETED')
    expect(titles).toContain('Document reviewed and electronically signed by Carlo Lidres')
    const reviewSig = events.find((e) => e.title.startsWith('Document reviewed and electronically signed'))!
    expect(reviewSig.detailLines).toContain('Reason for signing: I reviewed this document.')
    expect(reviewSig.timestampLabel).toMatch(/GMT\+8/)
  })

  it('consolidates approve_completed with Approved-by signature manifestation', () => {
    const events = buildCompletionHistoryEvents({
      audits: [
        {
          id: 'a1',
          event_type: 'approve_completed',
          actor_id: 'p-1',
          reason: 'Document approved and electronically signed by Carlo Lidres',
          created_at: '2026-08-01T09:00:00Z',
        },
      ],
      signatures: [
        {
          id: 's1',
          signer_display_name: 'Carlo Lidres',
          signer_email: 'carlolidres@gmail.com',
          signer_organization: 'Interphil Laboratories, Inc.',
          signature_meaning: 'I approve this document.',
          signing_timestamp: '2026-08-01T09:00:00.100Z',
          source_ip: '136.158.78.143',
          auth_method: 'password',
          signature_appearance_type: 'image',
        },
      ],
      actors,
      routeCompletedAt: null,
      timeZoneOffsetMinutes: 480,
    })

    const titles = events.map((e) => e.title)
    expect(titles).not.toContain('APPROVAL GRANTED')
    expect(titles).toContain('Document approved and electronically signed by Carlo Lidres')
  })

  it('numbers events in chronological sequence', () => {
    const events = buildCompletionHistoryEvents({
      audits: [
        { id: 'b', event_type: 'route_started', actor_id: 'p-1', reason: null, created_at: '2026-08-01T08:00:00Z' },
        { id: 'a', event_type: 'document_created', actor_id: 'p-1', reason: null, created_at: '2026-08-01T07:00:00Z' },
      ],
      signatures: [],
      actors,
      routeCompletedAt: null,
    })
    expect(events[0]?.sequence).toBe(1)
    expect(events[0]?.title).toBe('DOCUMENT CREATED')
    expect(events[1]?.sequence).toBe(2)
  })
})
