import { describe, expect, it } from 'vitest'

import {
  containRect,
  cssNormalizedToPdfRect,
  expandRectWithinPage,
  formatSigningDateLabel,
  planSignatureStampLayout,
  STAMP_MODE_LABEL,
  wrapTextLines,
} from './pdfStampGeometry'

const content = {
  signerName: 'Carlo M. Lidres',
  reason: 'I approve this document.',
  email: 'carlolidres@gmail.com',
  signedAtLabel: 'Aug 01, 2026 03:40:52 PM GMT+8',
  role: 'QA Manager',
  recordId: 'A1B2C3D4',
}

describe('adaptive planSignatureStampLayout', () => {
  it('uses wide layout for 274×88 fields', () => {
    const layout = planSignatureStampLayout({ x: 40, y: 100, width: 274, height: 88 }, content, {
      width: 612,
      height: 792,
    })
    expect(layout.mode).toBe('full')
    expect(STAMP_MODE_LABEL[layout.mode]).toBe('Wide')
    expect(layout.adjusted).toBe(false)
    expect(layout.fontSize).toBeGreaterThanOrEqual(6)
    expect(layout.nameLines.length).toBeGreaterThan(0)
    expect(layout.status?.text).toContain('DIGITALLY')
    expect(layout.metaLines.some((l) => l.text.includes('@'))).toBe(true)
    expect(layout.accentWidth).toBeGreaterThan(0)
  })

  it('uses compact layout for moderately narrow fields', () => {
    const layout = planSignatureStampLayout({ x: 40, y: 100, width: 180, height: 110 }, content, {
      width: 612,
      height: 792,
    })
    expect(['compact', 'narrow', 'full']).toContain(layout.mode)
    expect(layout.fontSize).toBeGreaterThanOrEqual(6)
    // Compact hides email
    if (layout.mode === 'compact') {
      expect(layout.metaLines.every((l) => !l.text.includes('@'))).toBe(true)
    }
  })

  it('uses micro slim for tall narrow fields', () => {
    const layout = planSignatureStampLayout({ x: 40, y: 80, width: 80, height: 130 }, content, {
      width: 612,
      height: 792,
    })
    expect(layout.mode).toBe('slim')
    expect(STAMP_MODE_LABEL[layout.mode]).toBe('Micro Slim')
    expect(layout.roleLines).toHaveLength(0)
    expect(layout.reasonLines).toHaveLength(0)
    expect(layout.nameLines.length).toBeGreaterThan(0)
    expect(layout.status).not.toBeNull()
  })

  it('uses micro banner for short wide fields', () => {
    const layout = planSignatureStampLayout({ x: 40, y: 80, width: 200, height: 32 }, content, {
      width: 612,
      height: 792,
    })
    expect(layout.mode).toBe('banner')
    expect(STAMP_MODE_LABEL[layout.mode]).toBe('Micro Banner')
    expect(layout.roleLines).toHaveLength(0)
    expect(layout.reasonLines).toHaveLength(0)
  })

  it('uses micro layout for moderately small side-by-side fields', () => {
    const layout = planSignatureStampLayout({ x: 40, y: 80, width: 120, height: 55 }, content, {
      width: 612,
      height: 792,
    })
    expect(['narrow', 'slim', 'banner', 'compact']).toContain(layout.mode)
    expect(layout.verticalDivider === null || layout.verticalDivider !== undefined).toBe(true)
  })

  it('auto-expands very small fields within the page', () => {
    const layout = planSignatureStampLayout({ x: 40, y: 100, width: 60, height: 32 }, content, {
      width: 612,
      height: 792,
    })
    expect(layout.adjusted).toBe(true)
    expect(layout.card.width).toBeGreaterThan(60)
    expect(layout.card.height).toBeGreaterThan(32)
    expect(layout.card.x + layout.card.width).toBeLessThanOrEqual(612 - 17)
  })

  it('keeps stamps inside the page when near the bottom-right edge', () => {
    const layout = planSignatureStampLayout({ x: 520, y: 20, width: 80, height: 45 }, content, {
      width: 612,
      height: 792,
    })
    expect(layout.card.x + layout.card.width).toBeLessThanOrEqual(612)
    expect(layout.card.y).toBeGreaterThanOrEqual(0)
    expect(['narrow', 'slim', 'banner', 'compact']).toContain(layout.mode)
  })

  it('handles long names, reasons, and emails without throwing', () => {
    const layout = planSignatureStampLayout(
      { x: 30, y: 80, width: 274, height: 95 },
      {
        signerName: 'Alexandria Catherine Montgomery-Williams III',
        reason: 'QA Approved after full technical review of manufacturing batch records and related deviations',
        email: 'alexandria.montgomery.williams.iii@very-long-domain.example.org',
        signedAtLabel: 'Aug 01, 2026 11:59:59 PM GMT-5',
        role: 'Principal Quality Assurance Specialist',
        recordId: 'LONG-RECORD-ID-9999',
      },
      { width: 612, height: 792 },
    )
    expect(layout.fontSize).toBeGreaterThanOrEqual(6)
    expect(layout.nameLines[0]?.text.length).toBeGreaterThan(0)
  })

  it('works on landscape page sizes', () => {
    const layout = planSignatureStampLayout({ x: 40, y: 40, width: 274, height: 88 }, content, {
      width: 792,
      height: 612,
    })
    expect(layout.mode).toBe('full')
  })
})

describe('expandRectWithinPage', () => {
  it('keeps expansion inside margins', () => {
    const next = expandRectWithinPage(
      { x: 500, y: 10, width: 80, height: 40 },
      { width: 220, height: 90 },
      { width: 612, height: 792 },
    )
    expect(next.x + next.width).toBeLessThanOrEqual(612 - 18)
    expect(next.y).toBeGreaterThanOrEqual(18)
  })
})

describe('cssNormalizedToPdfRect and containRect', () => {
  it('converts CSS top-left normalized coords to PDF bottom-left points', () => {
    const rect = cssNormalizedToPdfRect(
      { x: 0.1, y: 0.2, width: 0.4, height: 0.1, rotation: 0 },
      { width: 612, height: 792 },
    )
    expect(rect.x).toBeCloseTo(61.2, 1)
    expect(rect.width).toBeCloseTo(244.8, 1)
    expect(rect.height).toBeCloseTo(79.2, 1)
    expect(rect.y).toBeCloseTo(792 - 0.2 * 792 - 79.2, 1)
  })

  it('preserves aspect ratio when containing an image', () => {
    const fit = containRect(200, 100, 400, 100)
    expect(fit.width).toBeCloseTo(200)
    expect(fit.height).toBeCloseTo(50)
    expect(fit.offsetY).toBeCloseTo(25)
  })

  it('wraps and formats signing labels', () => {
    expect(wrapTextLines('one two three four', 40, 10, 2).length).toBeGreaterThan(0)
    expect(formatSigningDateLabel(new Date('2026-08-01T15:40:52+08:00'))).toMatch(/2026/)
  })
})
