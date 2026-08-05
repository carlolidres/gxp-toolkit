import { describe, expect, it } from 'vitest'

import {
  clampEdocPdfZoom,
  edocPdfRenderWidth,
  EDOC_PDF_BASE_WIDTH,
  formatEdocPdfZoomPercent,
} from './pdfPreviewZoom'

describe('pdfPreviewZoom', () => {
  it('clamps zoom to supported bounds', () => {
    expect(clampEdocPdfZoom(0.1)).toBe(0.5)
    expect(clampEdocPdfZoom(3)).toBe(2)
    expect(clampEdocPdfZoom(1.25)).toBe(1.25)
  })

  it('maps zoom to render width from base', () => {
    expect(edocPdfRenderWidth(1)).toBe(EDOC_PDF_BASE_WIDTH)
    expect(edocPdfRenderWidth(1.5)).toBe(Math.round(EDOC_PDF_BASE_WIDTH * 1.5))
  })

  it('formats percent for the toolbar', () => {
    expect(formatEdocPdfZoomPercent(1)).toBe('100%')
    expect(formatEdocPdfZoomPercent(0.75)).toBe('75%')
  })
})
