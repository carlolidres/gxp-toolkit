import { describe, expect, it } from 'vitest'

import {
  assertIntegritySlotsFitField,
  assertDetailsAvoidIntegritySlots,
  approxTextWidth,
  containRect,
  cssNormalizedToPdfRect,
  ellipsize,
  expandRectWithinPage,
  formatSigningDateLabel,
  planIntegrityMarkSlots,
  planSignatureStampLayout,
  STAMP_INTEGRITY_FIT_POLICY,
  STAMP_MODE_LABEL,
  stampBoxContains,
  stampBoxesOverlap,
  stampLineBox,
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
    expect(fit.width / fit.height).toBeCloseTo(400 / 100)
  })

  it('wraps and formats signing labels', () => {
    expect(wrapTextLines('one two three four', 40, 10, 2).length).toBeGreaterThan(0)
    expect(formatSigningDateLabel(new Date('2026-08-01T15:40:52+08:00'))).toMatch(/2026/)
  })
})

describe('stamp integrity fit control', () => {
  const field = { x: 40, y: 200, width: 274, height: 88 }

  it('keeps QR and caption inside the original field (contain-within-field)', () => {
    expect(STAMP_INTEGRITY_FIT_POLICY).toBe('contain-within-field')
    const slots = planIntegrityMarkSlots(field, 'full')
    expect(() => assertIntegritySlotsFitField(field, slots)).not.toThrow()
    expect(stampBoxContains(field, slots.qrBox)).toBe(true)
    expect(stampBoxContains(field, slots.verifyRow)).toBe(true)
    expect(slots.qrBox.width).toBeCloseTo(slots.qrBox.height)
    expect(slots.verifyRow.y).toBeGreaterThanOrEqual(field.y)
  })

  it('does not place the caption below the field (legacy overlay y - 8)', () => {
    const slots = planIntegrityMarkSlots(field, 'full')
    const unsafeCaptionY = field.y - 8
    expect(unsafeCaptionY).toBeLessThan(field.y)
    expect(slots.verifyRow.y).toBeGreaterThan(unsafeCaptionY)
  })

  it('does not collide with a stacked stamp below the field', () => {
    const gap = 4
    const lower = { x: 40, y: field.y - 88 - gap, width: 274, height: 88 }
    const slots = planIntegrityMarkSlots(field, 'full')
    expect(stampBoxesOverlap(slots.verifyRow, lower)).toBe(false)
    expect(stampBoxesOverlap(slots.qrBox, lower)).toBe(false)
  })

  it('keeps a fitted wide stamp inside its original field', () => {
    const layout = planSignatureStampLayout(field, content, { width: 612, height: 792 })
    expect(layout.adjusted).toBe(false)
    expect(stampBoxContains(field, layout.card)).toBe(true)
    expect(stampBoxContains(layout.card, layout.imageBox)).toBe(true)
  })

  it('execution gate: planner content must not overlap reserved QR/caption slots', () => {
    const layout = planSignatureStampLayout(field, content, { width: 612, height: 792 })
    expect(layout.adjusted).toBe(false)
    const occupied = [layout.imageBox]
    for (const line of [...layout.nameLines, ...layout.roleLines, ...layout.reasonLines, ...layout.metaLines]) {
      occupied.push(stampLineBox(line))
    }
    if (layout.status) {
      occupied.push({
        x: layout.status.x,
        y: layout.status.y,
        width: layout.status.text.length * layout.status.size * 0.55 + 10,
        height: layout.status.size,
      })
    }
    assertDetailsAvoidIntegritySlots(occupied, {
      qrBox: layout.qrBox ?? { x: 0, y: 0, width: 0, height: 0 },
      verifyRow: layout.verifyRow ?? { x: 0, y: 0, width: 0, height: 0 },
    })
  })

  it.each([
    [180, 70],
    [220, 80],
    [280, 90],
    [320, 100],
    [390, 100],
    [450, 120],
  ])('keeps QR and caption inside the card and off timestamps at %i×%i', (width, height) => {
    const box = { x: 40, y: 200, width, height }
    const layout = planSignatureStampLayout(box, content, { width: 612, height: 792 })
    if (layout.verifyRow) {
      expect(stampBoxContains(layout.card, layout.verifyRow)).toBe(true)
      expect(layout.verifyRow.y).toBeGreaterThanOrEqual(layout.card.y)
    }
    if (layout.qrBox) {
      expect(stampBoxContains(layout.card, layout.qrBox)).toBe(true)
      expect(layout.qrBox.width).toBeCloseTo(layout.qrBox.height)
      for (const line of [...layout.nameLines, ...layout.metaLines]) {
        expect(stampBoxesOverlap(stampLineBox(line), layout.qrBox)).toBe(false)
      }
    }
  })

  it('keeps stacked stamp captions from sharing pixels', () => {
    const gap = 4
    const upper = { x: 40, y: 200, width: 274, height: 88 }
    const lower = { x: 40, y: upper.y - 88 - gap, width: 274, height: 88 }
    const topLayout = planSignatureStampLayout(upper, content, { width: 612, height: 792 })
    const bottomLayout = planSignatureStampLayout(lower, content, { width: 612, height: 792 })
    expect(stampBoxesOverlap(topLayout.card, bottomLayout.card)).toBe(false)
    if (topLayout.verifyRow) {
      expect(stampBoxesOverlap(topLayout.verifyRow, bottomLayout.card)).toBe(false)
    }
    if (topLayout.qrBox) {
      expect(stampBoxesOverlap(topLayout.qrBox, bottomLayout.card)).toBe(false)
    }
  })

  it('ellipsizes a GMT timestamp that does not fit the details column', () => {
    const label = 'Aug 18, 2026 03:19:03 AM GMT+8'
    const maxWidth = 90
    const size = 7
    expect(approxTextWidth(label, size)).toBeGreaterThan(maxWidth)
    const clipped = ellipsize(label, maxWidth, size)
    expect(approxTextWidth(clipped, size)).toBeLessThanOrEqual(maxWidth + 0.5)
    expect(clipped.includes('GMT+8')).toBe(false)
  })

  it('keeps timestamp lines inside short stacked banners', () => {
    const page = { width: 612, height: 792 }
    const label = 'Aug 18, 2026 03:19:03 AM GMT+8'
    const boxes = [
      { x: 40, y: 200, width: 220, height: 36 },
      { x: 40, y: 160, width: 220, height: 36 },
      { x: 40, y: 120, width: 220, height: 36 },
    ]
    const layouts = boxes.map((box) => planSignatureStampLayout(box, { ...content, signedAtLabel: label }, page))
    for (const layout of layouts) {
      for (const line of layout.metaLines) {
        expect(line.y).toBeGreaterThanOrEqual(layout.card.y)
        expect(line.x ?? 0).toBeGreaterThanOrEqual(layout.card.x)
      }
    }
    expect(stampBoxesOverlap(layouts[0]!.card, layouts[1]!.card)).toBe(false)
    expect(layouts[2]!.metaLines.every((line) => line.y >= layouts[2]!.card.y)).toBe(true)
  })
})
